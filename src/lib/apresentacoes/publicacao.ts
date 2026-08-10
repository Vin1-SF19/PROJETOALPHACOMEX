const PADRAO_SLUG_PUBLICO = /^[a-f0-9]{32}$/;

export function gerarSlugPublico(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function slugPublicoEhValido(slug: string): boolean {
  return PADRAO_SLUG_PUBLICO.test(slug);
}

export function apresentacaoPublicaDisponivel(input: {
  status: string;
  expiraEm: Date | string | null;
}, agora = new Date()): boolean {
  if (input.status !== "PUBLICADA") return false;
  if (!input.expiraEm) return true;
  const expiracao = input.expiraEm instanceof Date ? input.expiraEm : new Date(input.expiraEm);
  return Number.isFinite(expiracao.getTime()) && expiracao.getTime() > agora.getTime();
}
