import { z } from "zod";

export const TAMANHO_MAX_FONTE_PERSONALIZADA_BYTES = 10 * 1024 * 1024;
export const LIMITE_FONTES_PERSONALIZADAS = 50;

export const formatoFontePersonalizadaSchema = z.enum(["woff2", "woff", "truetype", "opentype"]);

export const nomeFontePersonalizadaSchema = z.string().trim().min(1, "Informe um nome para a fonte").max(80, "O nome pode ter no máximo 80 caracteres").refine(
  (nome) => !/[\u0000-\u001f\u007f]/.test(nome),
  "Nome da fonte inválido",
);

export const fontePersonalizadaSchema = z.object({
  id: z.string().uuid(),
  nome: nomeFontePersonalizadaSchema,
  url: z.string().url(),
  formato: formatoFontePersonalizadaSchema,
  mimeType: z.enum(["font/woff2", "font/woff", "font/ttf", "font/otf"]),
  nomeOriginal: z.string().min(1).max(255),
  tamanhoBytes: z.number().int().positive().max(TAMANHO_MAX_FONTE_PERSONALIZADA_BYTES),
  criadoEm: z.string().datetime(),
});

export const fontesPersonalizadasSchema = z.array(fontePersonalizadaSchema).max(LIMITE_FONTES_PERSONALIZADAS);

export type FontePersonalizada = z.infer<typeof fontePersonalizadaSchema>;
export type FormatoFontePersonalizada = z.infer<typeof formatoFontePersonalizadaSchema>;

const CONFIGURACOES_POR_EXTENSAO = {
  woff2: { formato: "woff2", mimeType: "font/woff2" },
  woff: { formato: "woff", mimeType: "font/woff" },
  ttf: { formato: "truetype", mimeType: "font/ttf" },
  otf: { formato: "opentype", mimeType: "font/otf" },
} as const satisfies Record<string, { formato: FormatoFontePersonalizada; mimeType: FontePersonalizada["mimeType"] }>;

export function normalizarFontesPersonalizadas(valor: unknown): FontePersonalizada[] {
  const resultado = fontesPersonalizadasSchema.safeParse(valor);
  return resultado.success ? resultado.data : [];
}

export function configuracaoDaFontePorNomeArquivo(nomeArquivo: string) {
  const extensao = nomeArquivo.split(".").pop()?.toLowerCase();
  return extensao && extensao in CONFIGURACOES_POR_EXTENSAO
    ? CONFIGURACOES_POR_EXTENSAO[extensao as keyof typeof CONFIGURACOES_POR_EXTENSAO]
    : null;
}

export function assinaturaConfereComFormato(bytes: Uint8Array, formato: FormatoFontePersonalizada): boolean {
  if (bytes.length < 4) return false;
  const assinaturaAscii = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (formato === "woff") return assinaturaAscii === "wOFF";
  if (formato === "woff2") return assinaturaAscii === "wOF2";
  if (formato === "opentype") return assinaturaAscii === "OTTO";
  return (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00)
    || assinaturaAscii === "true";
}

export function nomeFonteJaExiste(fontes: FontePersonalizada[], nome: string): boolean {
  const nomeNormalizado = nome.trim().toLocaleLowerCase("pt-BR");
  return fontes.some((fonte) => fonte.nome.toLocaleLowerCase("pt-BR") === nomeNormalizado);
}

function stringCssSegura(valor: string): string {
  // Evita delimitadores HTML literais mesmo se o <style> for renderizado no servidor.
  return JSON.stringify(valor).replace(/</g, "\\3c ").replace(/>/g, "\\3e ");
}

/** Gera CSS sem interpolar tokens livres: strings passam por JSON.stringify antes de entrar no @font-face. */
export function cssDasFontesPersonalizadas(fontes: FontePersonalizada[]): string {
  return fontes.map((fonte) => [
    "@font-face {",
    `  font-family: ${stringCssSegura(fonte.nome)};`,
    `  src: url(${stringCssSegura(fonte.url)}) format(${stringCssSegura(fonte.formato)});`,
    "  font-style: normal;",
    "  font-weight: 100 900;",
    "  font-display: swap;",
    "}",
  ].join("\n")).join("\n");
}

export function removerFontesDoPacoteDoSlide<T extends { fontesPersonalizadas?: FontePersonalizada[] }>(dados: T): Omit<T, "fontesPersonalizadas"> {
  const { fontesPersonalizadas: _fontes, ...restante } = dados;
  void _fontes;
  return restante;
}
