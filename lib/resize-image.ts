/**
 * Redimensiona imagens de referência no navegador, antes do upload.
 *
 * As faces de persona cadastradas tinham 6–7 MB — foto de celular em resolução
 * cheia. Para uma thumbnail de 1920×1080 isso é ordens de grandeza além do
 * necessário, e cobra caro em toda a cadeia: sobe mais lento, vira base64 33%
 * maior a cada geração, e a extensão do ChatGPT estourou o timeout de 300s
 * tentando anexar uma dessas.
 *
 * Roda no cliente de propósito: redimensionar no servidor exigiria uma
 * dependência nativa de imagem no Docker, que já sofre para compilar o
 * better-sqlite3.
 */

/** Lado maior em pixels. 1080p é folgado para referência de thumbnail. */
const MAX_LADO = 1920;
/** Abaixo disto não vale reprocessar — só perderia qualidade à toa. */
const TAMANHO_OK = 1_500_000;
const QUALIDADE = 0.85;

export interface ResizeResult {
  file: File;
  original: number;
  final: number;
  redimensionada: boolean;
}

export async function resizeForUpload(file: File): Promise<ResizeResult> {
  const original = file.size;

  if (!file.type.startsWith("image/")) {
    return { file, original, final: original, redimensionada: false };
  }

  let bitmap: ImageBitmap;
  try {
    // `from-image` respeita a orientação EXIF — sem isso, foto de celular
    // tirada na vertical chega deitada.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Formato que o navegador não decodifica: sobe como veio.
    return { file, original, final: original, redimensionada: false };
  }

  const maiorLado = Math.max(bitmap.width, bitmap.height);
  if (maiorLado <= MAX_LADO && original <= TAMANHO_OK) {
    bitmap.close();
    return { file, original, final: original, redimensionada: false };
  }

  const escala = Math.min(1, MAX_LADO / maiorLado);
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { file, original, final: original, redimensionada: false };
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALIDADE)
  );
  if (!blob || blob.size >= original) {
    // Reprocessar não compensou (imagem já otimizada, ou PNG pequeno).
    return { file, original, final: original, redimensionada: false };
  }

  const nome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return {
    file: new File([blob], nome, { type: "image/jpeg" }),
    original,
    final: blob.size,
    redimensionada: true,
  };
}

/** "7.0 MB → 412 KB" para o toast. */
export function descreverReducao(r: ResizeResult): string {
  const fmt = (n: number) =>
    n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
  return `${fmt(r.original)} → ${fmt(r.final)}`;
}
