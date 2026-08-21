export function normalizeAlphaSeoDomain(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    throw new Error("Informe um domínio válido, como exemplo.com");
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || !url.hostname) {
    throw new Error("Informe um domínio HTTP(S) válido");
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!hostname.includes(".") || hostname.length > 253) {
    throw new Error("Informe um domínio válido, como exemplo.com");
  }
  return hostname;
}

export function normalizeAlphaSeoEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}
