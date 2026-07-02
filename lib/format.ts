export function formatRelative(timestamp: number | null | undefined): string {
  if (!timestamp) return "—";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h atrás`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} d atrás`;
  return new Date(timestamp).toLocaleDateString("pt-BR");
}

/**
 * Data absoluta no formato dd/mm/yyyy. Usado no histórico onde o usuário
 * prefere ver a data direta em vez de "18h atrás".
 */
export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fileUrl(relPath: string | null | undefined): string {
  if (!relPath) return "";
  return `/api/files/${relPath.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Gera um nome de arquivo amigável pra download a partir de um título livre.
 * Mantém letras com acento (NFKD → ASCII), troca espaços por -, lowercase,
 * limita a 60 chars. Retorna null se o título for vazio/inválido.
 */
export function slugifyTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s.length > 0 ? s : null;
}

/**
 * Remove caracteres proibidos em nomes de arquivo (Windows é o mais
 * restritivo: < > : " / \ | ? *). Mantém acentos, espaços e capitalização.
 */
function sanitizeForFilename(s: string): string {
  return s
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Monta o nome de download no formato:
 *   "{persona} - {titulo} {N}.png"
 *
 * O sufixo numérico " {N}" só aparece quando o batch tem múltiplas
 * variantes (totalVariants > 1). Pra batch com 1 variante o nome fica
 * limpo: "Dr. Ethan Scott - gato no sofá.png".
 *
 * Se faltar persona OU título, ajusta o template:
 *   só persona  → "{persona}[ {N}].png"
 *   só título   → "{titulo}[ {N}].png"
 *   nenhum      → null (caller usa fallback)
 *
 * `variantIndex` é 0-indexed, vira 1-indexed no sufixo.
 */
export function buildDownloadName(
  personaName: string | null | undefined,
  title: string | null | undefined,
  variantIndex: number,
  totalVariants: number,
  ext: string = "png"
): string | null {
  const persona = personaName?.trim() ? sanitizeForFilename(personaName) : null;
  const t = title?.trim() ? sanitizeForFilename(title) : null;
  const suffix = totalVariants > 1 ? ` ${variantIndex + 1}` : "";

  let base: string | null = null;
  if (persona && t) base = `${persona} - ${t}${suffix}`;
  else if (persona) base = `${persona}${suffix}`;
  else if (t) base = `${t}${suffix}`;

  return base ? `${base}.${ext}` : null;
}
