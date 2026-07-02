import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

export const DATA_DIR = path.join(process.cwd(), "data");
export const PERSONAS_DIR = path.join(DATA_DIR, "personas");
export const OUTPUT_DIR = path.join(DATA_DIR, "output");
export const COMPETITORS_DIR = path.join(DATA_DIR, "competitors");

export function ensureDataDirs(): void {
  for (const dir of [DATA_DIR, PERSONAS_DIR, OUTPUT_DIR, COMPETITORS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDataDirs();

/**
 * Resolve um caminho relativo a `data/` para absoluto, validando que
 * não escape do sandbox.
 */
export function resolveDataPath(relPath: string): string {
  const abs = path.resolve(DATA_DIR, relPath);
  if (!abs.startsWith(DATA_DIR + path.sep) && abs !== DATA_DIR) {
    throw new Error("Path traversal blocked");
  }
  return abs;
}

export function toRelative(abs: string): string {
  return path.relative(DATA_DIR, abs).split(path.sep).join("/");
}

export function detectMime(buffer: Buffer): string {
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // WebP: 52 49 46 46 .. .. .. .. 57 45 42 50
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return "application/octet-stream";
}

export function extFromMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

/**
 * Lê um arquivo de imagem do disco e retorna como data URL base64.
 * Usado para enviar refs ao G-Labs / Gemini.
 */
export async function readImageAsDataUrl(absPath: string): Promise<string> {
  const buf = await fsp.readFile(absPath);
  const mime = detectMime(buf);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function writeBuffer(absPath: string, buffer: Buffer): Promise<void> {
  await fsp.mkdir(path.dirname(absPath), { recursive: true });
  await fsp.writeFile(absPath, buffer);
}

export async function deleteIfExists(absPath: string): Promise<void> {
  try {
    await fsp.rm(absPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
