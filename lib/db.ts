import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

import type {
  Persona,
  Generation,
  GenerationVariant,
  EngineId,
  GenerationStatus,
  GenerationMode,
  GenerationSwaps,
  VariantStatus,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "thumbnails.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      channel TEXT,
      face_path TEXT NOT NULL,
      style_paths TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      persona_id TEXT REFERENCES personas(id) ON DELETE CASCADE,
      headline_top TEXT,
      headline_main_white TEXT,
      headline_main_yellow TEXT,
      concept TEXT NOT NULL,
      competitor_url TEXT,
      competitor_path TEXT,
      prompt_final TEXT NOT NULL,
      engine_requested TEXT NOT NULL,
      variant_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS generation_variants (
      id TEXT PRIMARY KEY,
      generation_id TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
      variant_index INTEGER NOT NULL,
      engine_used TEXT NOT NULL,
      task_id TEXT,
      output_path TEXT,
      status TEXT NOT NULL,
      error_detail TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_gen_persona_created ON generations(persona_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gen_created ON generations(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_var_gen ON generation_variants(generation_id, variant_index);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Trilha de eventos do app. Não tem FK para generations de propósito:
    -- apagar uma geração não pode apagar o log de que ela existiu e falhou.
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      level TEXT NOT NULL,
      scope TEXT NOT NULL,
      message TEXT NOT NULL,
      detail TEXT,
      generation_id TEXT,
      variant_id TEXT,
      engine TEXT,
      task_id TEXT,
      error_code INTEGER,
      -- Quem originou: "sessão (joel)" ou "API: Hermes Agent". Sem isso não dá
      -- para distinguir o que veio da tela do que veio de um sistema externo.
      actor TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_level_ts ON logs(level, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_gen ON logs(generation_id);

    -- Chaves de API para consumo externo. Guarda o HASH, nunca a chave: quem
    -- ler o banco não consegue usar nenhuma delas.
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      -- Chave cifrada (AES-256-GCM com segredo derivado de AUTH_SECRET), para
      -- o usuário poder copiá-la de novo. O hash acima continua sendo o que
      -- autentica; este campo existe só para exibição sob sessão.
      key_cipher TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
  `);

  // Migrações idempotentes — adicionam colunas se ainda não existem.
  applyMigrations(_db);

  return _db;
}

function applyMigrations(db: Database.Database): void {
  // logs.actor chegou depois: bancos criados antes não têm a coluna.
  const logCols = db.prepare("PRAGMA table_info(logs)").all() as Array<{
    name: string;
  }>;
  if (logCols.length > 0 && !logCols.some((c) => c.name === "actor")) {
    db.exec("ALTER TABLE logs ADD COLUMN actor TEXT");
  }

  // api_keys.key_cipher chegou depois: bancos criados antes não têm a coluna.
  const apiKeyCols = db.prepare("PRAGMA table_info(api_keys)").all() as Array<{
    name: string;
  }>;
  if (
    apiKeyCols.length > 0 &&
    !apiKeyCols.some((c) => c.name === "key_cipher")
  ) {
    db.exec("ALTER TABLE api_keys ADD COLUMN key_cipher TEXT");
  }

  const cols = db.prepare("PRAGMA table_info(generations)").all() as Array<{
    name: string;
    notnull: number;
  }>;
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has("mode")) {
    db.exec(
      "ALTER TABLE generations ADD COLUMN mode TEXT NOT NULL DEFAULT 'from-scratch'"
    );
  }
  if (!colNames.has("swaps_json")) {
    db.exec("ALTER TABLE generations ADD COLUMN swaps_json TEXT");
  }
  if (!colNames.has("title")) {
    db.exec("ALTER TABLE generations ADD COLUMN title TEXT");
  }

  // Migration: persona_id used to be NOT NULL; allow NULL so users can
  // generate "from absolute scratch" without picking a persona.
  const personaIdCol = cols.find((c) => c.name === "persona_id");
  if (personaIdCol && personaIdCol.notnull === 1) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN TRANSACTION;
      CREATE TABLE generations_new (
        id TEXT PRIMARY KEY,
        persona_id TEXT REFERENCES personas(id) ON DELETE CASCADE,
        headline_top TEXT,
        headline_main_white TEXT,
        headline_main_yellow TEXT,
        concept TEXT NOT NULL,
        competitor_url TEXT,
        competitor_path TEXT,
        prompt_final TEXT NOT NULL,
        engine_requested TEXT NOT NULL,
        variant_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'from-scratch',
        swaps_json TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      INSERT INTO generations_new
        (id, persona_id, headline_top, headline_main_white, headline_main_yellow,
         concept, competitor_url, competitor_path, prompt_final, engine_requested,
         variant_count, status, mode, swaps_json, created_at, completed_at)
      SELECT
        id, persona_id, headline_top, headline_main_white, headline_main_yellow,
        concept, competitor_url, competitor_path, prompt_final, engine_requested,
        variant_count, status, mode, swaps_json, created_at, completed_at
      FROM generations;
      DROP TABLE generations;
      ALTER TABLE generations_new RENAME TO generations;
      CREATE INDEX IF NOT EXISTS idx_gen_persona_created ON generations(persona_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_gen_created ON generations(created_at DESC);
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  }
}

// ─── Row Mappers ──────────────────────────────────────────────────────

interface PersonaRow {
  id: string;
  name: string;
  channel: string | null;
  face_path: string;
  style_paths: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}

function rowToPersona(row: PersonaRow): Persona {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    facePath: row.face_path,
    stylePaths: JSON.parse(row.style_paths) as string[],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  };
}

interface GenerationRow {
  id: string;
  persona_id: string | null;
  title: string | null;
  headline_top: string | null;
  headline_main_white: string | null;
  headline_main_yellow: string | null;
  concept: string;
  competitor_url: string | null;
  competitor_path: string | null;
  prompt_final: string;
  engine_requested: string;
  variant_count: number;
  status: string;
  mode: string | null;
  swaps_json: string | null;
  created_at: number;
  completed_at: number | null;
}

function rowToGeneration(row: GenerationRow): Generation {
  let swaps: GenerationSwaps | null = null;
  if (row.swaps_json) {
    try {
      swaps = JSON.parse(row.swaps_json) as GenerationSwaps;
    } catch {
      swaps = null;
    }
  }
  return {
    id: row.id,
    personaId: row.persona_id,
    title: row.title,
    headlineTop: row.headline_top,
    headlineMainWhite: row.headline_main_white,
    headlineMainYellow: row.headline_main_yellow,
    concept: row.concept,
    competitorUrl: row.competitor_url,
    competitorPath: row.competitor_path,
    promptFinal: row.prompt_final,
    engineRequested: row.engine_requested as EngineId,
    variantCount: row.variant_count,
    status: row.status as GenerationStatus,
    mode: (row.mode as GenerationMode) ?? "from-scratch",
    swaps,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

interface VariantRow {
  id: string;
  generation_id: string;
  variant_index: number;
  engine_used: string;
  task_id: string | null;
  output_path: string | null;
  status: string;
  error_detail: string | null;
  created_at: number;
  completed_at: number | null;
}

function rowToVariant(row: VariantRow): GenerationVariant {
  return {
    id: row.id,
    generationId: row.generation_id,
    variantIndex: row.variant_index,
    engineUsed: row.engine_used as EngineId,
    taskId: row.task_id,
    outputPath: row.output_path,
    status: row.status as VariantStatus,
    errorDetail: row.error_detail,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

// ─── Persona Queries ──────────────────────────────────────────────────

export const personasRepo = {
  list(): Persona[] {
    const rows = getDb()
      .prepare("SELECT * FROM personas ORDER BY COALESCE(last_used_at, updated_at) DESC")
      .all() as PersonaRow[];
    return rows.map(rowToPersona);
  },

  get(id: string): Persona | null {
    const row = getDb()
      .prepare("SELECT * FROM personas WHERE id = ?")
      .get(id) as PersonaRow | undefined;
    return row ? rowToPersona(row) : null;
  },

  create(p: {
    id: string;
    name: string;
    channel?: string;
    facePath: string;
    stylePaths?: string[];
    notes?: string;
  }): Persona {
    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO personas (id, name, channel, face_path, style_paths, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        p.id,
        p.name,
        p.channel ?? null,
        p.facePath,
        JSON.stringify(p.stylePaths ?? []),
        p.notes ?? null,
        now,
        now
      );
    return personasRepo.get(p.id)!;
  },

  update(
    id: string,
    patch: Partial<{
      name: string;
      channel: string | null;
      facePath: string;
      stylePaths: string[];
      notes: string | null;
    }>
  ): Persona | null {
    const existing = personasRepo.get(id);
    if (!existing) return null;
    const merged = {
      name: patch.name ?? existing.name,
      channel: patch.channel === undefined ? existing.channel : patch.channel,
      facePath: patch.facePath ?? existing.facePath,
      stylePaths: patch.stylePaths ?? existing.stylePaths,
      notes: patch.notes === undefined ? existing.notes : patch.notes,
    };
    getDb()
      .prepare(
        `UPDATE personas SET name=?, channel=?, face_path=?, style_paths=?, notes=?, updated_at=? WHERE id=?`
      )
      .run(
        merged.name,
        merged.channel,
        merged.facePath,
        JSON.stringify(merged.stylePaths),
        merged.notes,
        Date.now(),
        id
      );
    return personasRepo.get(id);
  },

  touchLastUsed(id: string): void {
    getDb()
      .prepare("UPDATE personas SET last_used_at=? WHERE id=?")
      .run(Date.now(), id);
  },

  delete(id: string): void {
    getDb().prepare("DELETE FROM personas WHERE id = ?").run(id);
  },
};

// ─── Generation Queries ───────────────────────────────────────────────

export const generationsRepo = {
  create(g: {
    id: string;
    personaId: string | null;
    title: string | null;
    headlineTop: string | null;
    headlineMainWhite: string | null;
    headlineMainYellow: string | null;
    concept: string;
    competitorUrl: string | null;
    competitorPath: string | null;
    promptFinal: string;
    engineRequested: EngineId;
    variantCount: number;
    mode: GenerationMode;
    swaps: GenerationSwaps | null;
  }): Generation {
    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO generations
          (id, persona_id, title, headline_top, headline_main_white, headline_main_yellow,
           concept, competitor_url, competitor_path, prompt_final, engine_requested,
           variant_count, status, mode, swaps_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
      )
      .run(
        g.id,
        g.personaId,
        g.title,
        g.headlineTop,
        g.headlineMainWhite,
        g.headlineMainYellow,
        g.concept,
        g.competitorUrl,
        g.competitorPath,
        g.promptFinal,
        g.engineRequested,
        g.variantCount,
        g.mode,
        g.swaps ? JSON.stringify(g.swaps) : null,
        now
      );
    return generationsRepo.get(g.id)!;
  },

  get(id: string): Generation | null {
    const row = getDb()
      .prepare("SELECT * FROM generations WHERE id = ?")
      .get(id) as GenerationRow | undefined;
    return row ? rowToGeneration(row) : null;
  },

  list(opts: { personaId?: string; limit?: number; cursor?: number } = {}): Generation[] {
    const limit = opts.limit ?? 50;
    let rows: GenerationRow[];
    if (opts.personaId && opts.cursor) {
      rows = getDb()
        .prepare(
          "SELECT * FROM generations WHERE persona_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?"
        )
        .all(opts.personaId, opts.cursor, limit) as GenerationRow[];
    } else if (opts.personaId) {
      rows = getDb()
        .prepare(
          "SELECT * FROM generations WHERE persona_id = ? ORDER BY created_at DESC LIMIT ?"
        )
        .all(opts.personaId, limit) as GenerationRow[];
    } else if (opts.cursor) {
      rows = getDb()
        .prepare(
          "SELECT * FROM generations WHERE created_at < ? ORDER BY created_at DESC LIMIT ?"
        )
        .all(opts.cursor, limit) as GenerationRow[];
    } else {
      rows = getDb()
        .prepare("SELECT * FROM generations ORDER BY created_at DESC LIMIT ?")
        .all(limit) as GenerationRow[];
    }
    return rows.map(rowToGeneration);
  },

  updateStatus(id: string, status: GenerationStatus, completedAt: number | null = null): void {
    getDb()
      .prepare("UPDATE generations SET status=?, completed_at=? WHERE id=?")
      .run(status, completedAt, id);
  },

  delete(id: string): void {
    // generation_variants tem ON DELETE CASCADE, então as variants somem juntas.
    getDb().prepare("DELETE FROM generations WHERE id = ?").run(id);
  },
};

// ─── Variant Queries ──────────────────────────────────────────────────

export const variantsRepo = {
  create(v: {
    id: string;
    generationId: string;
    variantIndex: number;
    engineUsed: EngineId;
  }): GenerationVariant {
    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO generation_variants
          (id, generation_id, variant_index, engine_used, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`
      )
      .run(v.id, v.generationId, v.variantIndex, v.engineUsed, now);
    return variantsRepo.get(v.id)!;
  },

  get(id: string): GenerationVariant | null {
    const row = getDb()
      .prepare("SELECT * FROM generation_variants WHERE id = ?")
      .get(id) as VariantRow | undefined;
    return row ? rowToVariant(row) : null;
  },

  listForGeneration(generationId: string): GenerationVariant[] {
    const rows = getDb()
      .prepare(
        "SELECT * FROM generation_variants WHERE generation_id = ? ORDER BY variant_index ASC"
      )
      .all(generationId) as VariantRow[];
    return rows.map(rowToVariant);
  },

  setTaskId(id: string, taskId: string, engineUsed: EngineId): void {
    getDb()
      .prepare(
        "UPDATE generation_variants SET task_id=?, engine_used=?, status='running' WHERE id=?"
      )
      .run(taskId, engineUsed, id);
  },

  setStatus(id: string, status: VariantStatus): void {
    getDb()
      .prepare("UPDATE generation_variants SET status=? WHERE id=?")
      .run(status, id);
  },

  setCompleted(id: string, outputPath: string): void {
    getDb()
      .prepare(
        "UPDATE generation_variants SET status='completed', output_path=?, completed_at=? WHERE id=?"
      )
      .run(outputPath, Date.now(), id);
  },

  setFailed(id: string, errorDetail: string): void {
    getDb()
      .prepare(
        "UPDATE generation_variants SET status='failed', error_detail=?, completed_at=? WHERE id=?"
      )
      .run(errorDetail, Date.now(), id);
  },

  delete(id: string): void {
    getDb().prepare("DELETE FROM generation_variants WHERE id = ?").run(id);
  },
};

// ─── Settings Repo ────────────────────────────────────────────────────

interface SettingsRow {
  key: string;
  value: string;
  updated_at: number;
}

export const settingsRepo = {
  get(key: string): string | null {
    const row = getDb()
      .prepare("SELECT * FROM settings WHERE key = ?")
      .get(key) as SettingsRow | undefined;
    return row?.value ?? null;
  },

  getAll(): Record<string, string> {
    const rows = getDb().prepare("SELECT * FROM settings").all() as SettingsRow[];
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },

  set(key: string, value: string): void {
    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
      )
      .run(key, value, now);
  },

  delete(key: string): void {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  },
};

// ─── Logs ─────────────────────────────────────────────────────────────

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  scope: string;
  message: string;
  detail: string | null;
  generationId: string | null;
  variantId: string | null;
  engine: string | null;
  taskId: string | null;
  errorCode: number | null;
  /** Quem originou: "sessão (joel)" ou "API: Hermes Agent". */
  actor: string | null;
}

interface LogRow {
  id: number;
  ts: number;
  level: string;
  scope: string;
  message: string;
  detail: string | null;
  generation_id: string | null;
  variant_id: string | null;
  engine: string | null;
  task_id: string | null;
  error_code: number | null;
  actor: string | null;
}

function mapLog(r: LogRow): LogEntry {
  return {
    id: r.id,
    ts: r.ts,
    level: r.level as LogLevel,
    scope: r.scope,
    message: r.message,
    detail: r.detail,
    generationId: r.generation_id,
    variantId: r.variant_id,
    engine: r.engine,
    taskId: r.task_id,
    errorCode: r.error_code,
    actor: r.actor,
  };
}

/**
 * Teto de linhas. O volume do Coolify é compartilhado com as imagens
 * geradas, então a trilha não pode crescer sem limite.
 */
const LOG_MAX_ROWS = 5000;

export const logsRepo = {
  insert(entry: {
    level: LogLevel;
    scope: string;
    message: string;
    detail?: string | null;
    generationId?: string | null;
    variantId?: string | null;
    engine?: string | null;
    taskId?: string | null;
    errorCode?: number | null;
    actor?: string | null;
  }): void {
    getDb()
      .prepare(
        `INSERT INTO logs (ts, level, scope, message, detail, generation_id, variant_id, engine, task_id, error_code, actor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Date.now(),
        entry.level,
        entry.scope,
        entry.message,
        entry.detail ?? null,
        entry.generationId ?? null,
        entry.variantId ?? null,
        entry.engine ?? null,
        entry.taskId ?? null,
        entry.errorCode ?? null,
        entry.actor ?? null
      );
  },

  /** Descarta as linhas mais antigas acima do teto. */
  prune(): number {
    const info = getDb()
      .prepare(
        `DELETE FROM logs WHERE id NOT IN (
           SELECT id FROM logs ORDER BY id DESC LIMIT ?
         )`
      )
      .run(LOG_MAX_ROWS);
    return info.changes;
  },

  list(opts: {
    level?: LogLevel;
    scope?: string;
    generationId?: string;
    search?: string;
    limit: number;
    before?: number;
  }): LogEntry[] {
    const where: string[] = [];
    const args: unknown[] = [];

    if (opts.level) {
      where.push("level = ?");
      args.push(opts.level);
    }
    if (opts.scope) {
      where.push("scope = ?");
      args.push(opts.scope);
    }
    if (opts.generationId) {
      where.push("generation_id = ?");
      args.push(opts.generationId);
    }
    if (opts.search) {
      where.push("(message LIKE ? OR detail LIKE ?)");
      args.push(`%${opts.search}%`, `%${opts.search}%`);
    }
    if (opts.before) {
      where.push("id < ?");
      args.push(opts.before);
    }

    const sql =
      "SELECT * FROM logs" +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      " ORDER BY id DESC LIMIT ?";
    args.push(opts.limit);

    return (getDb().prepare(sql).all(...args) as LogRow[]).map(mapLog);
  },

  counts(): { total: number; errors: number; warns: number } {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN level='error' THEN 1 ELSE 0 END) AS errors,
                SUM(CASE WHEN level='warn'  THEN 1 ELSE 0 END) AS warns
         FROM logs`
      )
      .get() as { total: number; errors: number | null; warns: number | null };
    return {
      total: row.total,
      errors: row.errors ?? 0,
      warns: row.warns ?? 0,
    };
  },

  clear(): void {
    getDb().prepare("DELETE FROM logs").run();
  },
};

// ─── Chaves de API ────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  /** Início da chave, para identificar visualmente sem expor o segredo. */
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  key_hash: string;
  key_cipher: string | null;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

function mapApiKey(r: ApiKeyRow): ApiKey {
  return {
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    revokedAt: r.revoked_at,
  };
}

export const apiKeysRepo = {
  create(entry: {
    id: string;
    name: string;
    prefix: string;
    keyHash: string;
    keyCipher: string | null;
  }): ApiKey {
    getDb()
      .prepare(
        `INSERT INTO api_keys (id, name, prefix, key_hash, key_cipher, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.id,
        entry.name,
        entry.prefix,
        entry.keyHash,
        entry.keyCipher,
        Date.now()
      );
    return this.get(entry.id)!;
  },

  /** Só para revelar sob sessão — nunca sai numa listagem. */
  getCipher(id: string): string | null {
    const row = getDb()
      .prepare("SELECT key_cipher FROM api_keys WHERE id = ?")
      .get(id) as { key_cipher: string | null } | undefined;
    return row?.key_cipher ?? null;
  },

  get(id: string): ApiKey | null {
    const row = getDb()
      .prepare("SELECT * FROM api_keys WHERE id = ?")
      .get(id) as ApiKeyRow | undefined;
    return row ? mapApiKey(row) : null;
  },

  list(): ApiKey[] {
    return (
      getDb()
        .prepare("SELECT * FROM api_keys ORDER BY created_at DESC")
        .all() as ApiKeyRow[]
    ).map(mapApiKey);
  },

  /** Busca pelo hash. Só devolve chave ativa — revogada não autentica. */
  findActiveByHash(keyHash: string): ApiKey | null {
    const row = getDb()
      .prepare("SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL")
      .get(keyHash) as ApiKeyRow | undefined;
    return row ? mapApiKey(row) : null;
  },

  touchLastUsed(id: string): void {
    getDb()
      .prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
      .run(Date.now(), id);
  },

  /** Revogação é marcação, não exclusão: preserva o rastro de quem usou o quê. */
  revoke(id: string): boolean {
    const info = getDb()
      .prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
      .run(Date.now(), id);
    return info.changes > 0;
  },
};

// ─── Aggregate helpers ────────────────────────────────────────────────

export function recomputeGenerationStatus(generationId: string): GenerationStatus {
  const variants = variantsRepo.listForGeneration(generationId);
  if (variants.length === 0) return "pending";
  const allDone = variants.every(
    (v) => v.status === "completed" || v.status === "failed"
  );
  const someCompleted = variants.some((v) => v.status === "completed");
  const allFailed = variants.every((v) => v.status === "failed");
  let status: GenerationStatus;
  if (!allDone) {
    status = "pending";
  } else if (allFailed) {
    status = "failed";
  } else if (someCompleted && variants.some((v) => v.status === "failed")) {
    status = "partial";
  } else {
    status = "completed";
  }
  generationsRepo.updateStatus(generationId, status, allDone ? Date.now() : null);
  return status;
}
