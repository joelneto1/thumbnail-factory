/**
 * Camada de settings — lê primeiro do SQLite, fallback pra env var.
 * Permite que o usuário configure via UI sem reiniciar o server.
 */
import { settingsRepo } from "./db";

export const SETTING_KEYS = {
  GLABS_BASE_URL: "glabs_base_url",
  GLABS_API_KEY: "glabs_api_key",
  CLI_PROXY_BASE_URL: "cli_proxy_base_url",
  CLI_PROXY_API_KEY: "cli_proxy_api_key",
  CLI_PROXY_MODEL: "cli_proxy_model",
  CLI_PROXY_REASONING_EFFORT: "cli_proxy_reasoning_effort",
} as const;

const DEFAULT_GLABS_BASE_URL = "http://127.0.0.1:8765";
const DEFAULT_CLI_PROXY_BASE_URL = "http://cli-proxyllm.rotaclubs.com/v1";
const DEFAULT_CLI_PROXY_MODEL = "claude-opus-4-8";
const DEFAULT_CLI_PROXY_REASONING = "high";

/**
 * Lê uma chave preferindo o que está no DB. Se vazio/nulo, cai pro env.
 * String vazia conta como "não definido".
 */
function readSetting(dbKey: string, envKey: string): string | null {
  const fromDb = settingsRepo.get(dbKey);
  if (fromDb && fromDb.trim()) return fromDb.trim();
  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return null;
}

export function getGlabsBaseUrl(): string {
  return (
    readSetting(SETTING_KEYS.GLABS_BASE_URL, "GLABS_BASE_URL") ??
    DEFAULT_GLABS_BASE_URL
  );
}

export function getGlabsApiKey(): string {
  return readSetting(SETTING_KEYS.GLABS_API_KEY, "GLABS_API_KEY") ?? "";
}

// ─── CLI Proxy (Claude Opus 4.8, OpenAI-compatible) ───────────────────

export function getCliProxyBaseUrl(): string {
  return (
    readSetting(SETTING_KEYS.CLI_PROXY_BASE_URL, "CLI_PROXY_BASE_URL") ??
    DEFAULT_CLI_PROXY_BASE_URL
  );
}

export function getCliProxyApiKey(): string {
  return readSetting(SETTING_KEYS.CLI_PROXY_API_KEY, "CLI_PROXY_API_KEY") ?? "";
}

export function getCliProxyModel(): string {
  return (
    readSetting(SETTING_KEYS.CLI_PROXY_MODEL, "CLI_PROXY_MODEL") ??
    DEFAULT_CLI_PROXY_MODEL
  );
}

export function getCliProxyReasoningEffort(): string {
  return (
    readSetting(
      SETTING_KEYS.CLI_PROXY_REASONING_EFFORT,
      "CLI_PROXY_REASONING_EFFORT"
    ) ?? DEFAULT_CLI_PROXY_REASONING
  );
}

export function isClaudeConfigured(): boolean {
  return !!getCliProxyApiKey();
}

/**
 * Lê o status de "fonte" de cada setting — usado pela UI pra mostrar
 * "vem do .env" vs "salvo no DB" vs "não configurado".
 */
export function getSettingsStatus() {
  return {
    glabsBaseUrl: classifySource(
      SETTING_KEYS.GLABS_BASE_URL,
      "GLABS_BASE_URL",
      DEFAULT_GLABS_BASE_URL
    ),
    glabsApiKey: classifySource(
      SETTING_KEYS.GLABS_API_KEY,
      "GLABS_API_KEY",
      undefined,
      true
    ),
    cliProxyBaseUrl: classifySource(
      SETTING_KEYS.CLI_PROXY_BASE_URL,
      "CLI_PROXY_BASE_URL",
      DEFAULT_CLI_PROXY_BASE_URL
    ),
    cliProxyApiKey: classifySource(
      SETTING_KEYS.CLI_PROXY_API_KEY,
      "CLI_PROXY_API_KEY",
      undefined,
      true
    ),
    cliProxyModel: classifySource(
      SETTING_KEYS.CLI_PROXY_MODEL,
      "CLI_PROXY_MODEL",
      DEFAULT_CLI_PROXY_MODEL
    ),
    cliProxyReasoningEffort: classifySource(
      SETTING_KEYS.CLI_PROXY_REASONING_EFFORT,
      "CLI_PROXY_REASONING_EFFORT",
      DEFAULT_CLI_PROXY_REASONING
    ),
  };
}

/**
 * `secret: true` omite o texto puro do `value`, deixando só o mascarado.
 *
 * GET /api/settings devolvia as chaves do G-Labs e do CLI Proxy em texto puro.
 * Passava despercebido enquanto só a interface consumia a rota; com chaves de
 * API, uma chave vazada exporia as outras duas. A tela não usa `value` nesses
 * campos — lê do `masked` —, então omitir não quebra nada.
 */
function classifySource(
  dbKey: string,
  envKey: string,
  defaultValue?: string,
  secret = false
): {
  value: string;
  masked: string;
  source: "db" | "env" | "default" | "missing";
} {
  const build = (
    raw: string,
    source: "db" | "env" | "default"
  ) => ({
    value: secret ? "" : raw,
    masked: source === "default" ? raw : maskSecret(raw),
    source,
  });

  const fromDb = settingsRepo.get(dbKey);
  if (fromDb && fromDb.trim()) return build(fromDb.trim(), "db");

  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.trim()) return build(fromEnv.trim(), "env");

  if (defaultValue) return build(defaultValue, "default");

  return { value: "", masked: "", source: "missing" };
}

function maskSecret(s: string): string {
  if (!s) return "";
  if (s.startsWith("http")) return s; // URLs não são secret
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 4)}${"•".repeat(Math.min(20, s.length - 8))}${s.slice(-4)}`;
}

export function setSetting(dbKey: string, value: string): void {
  if (!value) {
    settingsRepo.delete(dbKey);
    return;
  }
  settingsRepo.set(dbKey, value);
}
