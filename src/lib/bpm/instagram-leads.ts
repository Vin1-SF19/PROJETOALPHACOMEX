import { z } from "zod";
import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";

export const INSTAGRAM_SPREADSHEET_ID = "1vzyEobII90qd6txFhPBu5IwUZ9sISGs-6jYODaVmWsI";
export const INSTAGRAM_SHEET_ID = 0;
export const INSTAGRAM_ENDPOINT_SLUG = "instagram-leads-planilha";
export const INSTAGRAM_COLUNAS = {
  radar: "qual_a_modalidade_atual_da_sua_empresa_no_radar_siscomex?_",
  volume: "qual_o_valor_pretendido_de_importações_pelos_próximos_12_meses?",
  prazo: "em_quanto_tempo_você_precisa_do_novo_limite_de_radar?",
  telefone: "por_qual_número_de__whastapp_podemos_entrar_em_contato_com_você?_exemplo:__(ddd)_9_xxxx-xxxx",
  cnpj: "para_fazermos_a_pré-análise_do_radar_da_sua_empresa,_preencha_o_campo_abaixo_com_o_seu_cnpj:",
} as const;

const texto = z.string().trim().max(2000).nullish();
export const instagramLinhaSchema = z.object({
  id: z.string().trim().min(1).max(120),
  created_time: z.iso.datetime({ offset: true }),
  full_name: z.string().trim().min(1).max(200),
  email: texto,
  platform: z.enum(["ig", "instagram", ""]).nullish(),
  ad_id: texto, ad_name: texto, adset_id: texto, adset_name: texto,
  campaign_id: texto, campaign_name: texto, form_id: texto, form_name: texto,
  is_organic: z.union([z.boolean(), z.enum(["true", "false", ""]) ]).nullish(),
  lead_status: texto,
  [INSTAGRAM_COLUNAS.radar]: texto,
  [INSTAGRAM_COLUNAS.volume]: texto,
  [INSTAGRAM_COLUNAS.prazo]: texto,
  [INSTAGRAM_COLUNAS.telefone]: texto,
  [INSTAGRAM_COLUNAS.cnpj]: texto,
});

export const instagramIngestSchema = z.object({
  spreadsheetId: z.literal(INSTAGRAM_SPREADSHEET_ID),
  sheetId: z.literal(INSTAGRAM_SHEET_ID),
  lead: instagramLinhaSchema,
  dryRun: z.boolean().default(false),
}).strict();

export type InstagramLinha = z.infer<typeof instagramLinhaSchema>;
export type InstagramLeadDados = {
  versao: 1;
  externalId: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  cnpjOriginal: string | null;
  telefoneOriginal: string | null;
  captadoEm: string;
  radarOriginal: string | null;
  radarPretendido: string | null;
  volume: string | null;
  prazo: string | null;
  campanha: string | null;
  linha: InstagramLinha;
};

export function textoInstagram(valor: string | null | undefined): string {
  return (valor ?? "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/_/g, " ").trim();
}

/** Coluna M -> Radar pretendido, conforme decisão do usuário. N não participa. */
export function radarInstagram(valor: string | null | undefined): string | null {
  const normalizado = textoInstagram(valor).toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  const opcoes: Record<string, string> = {
    "ilimitado": "Revisão de Radar Ilimitado",
    "limitada usd 50k semestrais": "Habilitação de Radar 50k",
    "limitada usd 150k semestrais": "Revisão de Radar Limitado a USD150k",
    "habilitação de radar 50k": "Habilitação de Radar 50k",
    "revisão de radar limitado a usd150k": "Revisão de Radar Limitado a USD150k",
    "revisão de radar ilimitado": "Revisão de Radar Ilimitado",
  };
  return opcoes[normalizado] ?? null;
}

export function leadInstagramEhTeste(linha: InstagramLinha): boolean {
  return Object.values(linha).some((v) => typeof v === "string" && /<test lead:|dummy data for/i.test(v));
}

export function prepararLeadInstagram(linha: InstagramLinha): InstagramLeadDados {
  const telefoneOriginal = linha[INSTAGRAM_COLUNAS.telefone] || null;
  const digitos = telefoneOriginal?.replace(/\D/g, "") ?? "";
  const cnpjOriginal = linha[INSTAGRAM_COLUNAS.cnpj] || null;
  const radarOriginal = linha[INSTAGRAM_COLUNAS.radar] || null;
  return {
    versao: 1, externalId: linha.id, nome: linha.full_name,
    email: linha.email && z.email().safeParse(linha.email).success ? linha.email : null,
    telefone: digitos.length >= 10 && digitos.length <= 15 ? digitos : null,
    cnpj: cnpjEhValido(cnpjOriginal) ? normalizarCNPJ(cnpjOriginal) : null,
    cnpjOriginal, telefoneOriginal,
    captadoEm: linha.created_time,
    radarOriginal, radarPretendido: radarInstagram(radarOriginal),
    volume: textoInstagram(linha[INSTAGRAM_COLUNAS.volume]) || null,
    prazo: textoInstagram(linha[INSTAGRAM_COLUNAS.prazo]) || null,
    campanha: linha.campaign_name || null,
    linha,
  };
}

export function lerLeadInstagram(json: string | null): InstagramLeadDados | null {
  try {
    const envelope = JSON.parse(json ?? "null");
    if (envelope?.versao !== 1) return null;
    const parsed = instagramLinhaSchema.safeParse(envelope.linha);
    return parsed.success ? prepararLeadInstagram(parsed.data) : null;
  } catch { return null; }
}

export function chaveLeadInstagram(externalId: string): string {
  return `instagram:${INSTAGRAM_SPREADSHEET_ID}:${INSTAGRAM_SHEET_ID}:${externalId}`;
}

export function anotacaoLeadInstagram(dados: InstagramLeadDados): string {
  const linha = dados.linha;
  return [
    "Lead recebido do Instagram — Google Sheets",
    `ID do lead: ${dados.externalId}`,
    `Captado em: ${dados.captadoEm}`,
    `Nome do contato: ${dados.nome}`,
    `E-mail informado: ${linha.email || "Não informado"}`,
    `WhatsApp informado: ${dados.telefoneOriginal || "Não informado"}`,
    `CNPJ informado: ${dados.cnpjOriginal || "Não informado"}`,
    `Radar pretendido (coluna M): ${textoInstagram(dados.radarOriginal) || "Não informado"}`,
    `Volume pretendido em 12 meses: ${dados.volume || "Não informado"}`,
    `Prazo desejado: ${dados.prazo || "Não informado"}`,
    `Campanha: ${linha.campaign_name || "—"} / ${linha.campaign_id || "—"}`,
    `Anúncio: ${linha.ad_name || "—"} / ${linha.ad_id || "—"}`,
    `Conjunto: ${linha.adset_name || "—"} / ${linha.adset_id || "—"}`,
    `Formulário: ${linha.form_name || "—"} / ${linha.form_id || "—"}`,
    `Orgânico: ${String(linha.is_organic ?? "Não informado")}`,
    `Status na origem: ${linha.lead_status || "Não informado"}`,
  ].join("\n");
}
