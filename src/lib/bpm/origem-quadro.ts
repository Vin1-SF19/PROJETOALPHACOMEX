import { campoEhOrigemCliente } from "@/lib/bpm/origem-cliente";
import { ORIGENS_LEAD_PADRAO } from "@/lib/comercial/origens-lead";

export type FiltroOrigemQuadro = string | null | undefined;
export const TODAS_ORIGENS_QUADRO = "__alpha_origem_todas__";
export const SEM_ORIGEM_QUADRO = "__alpha_origem_ausente__";
const PREFIXO_ORIGEM = "origem:";

const chaveTexto = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
const rotulosPadrao = new Map(ORIGENS_LEAD_PADRAO.map((origem) => [chaveTexto(origem), origem]));

/** Normaliza somente apresentação/comparação; não altera o cadastro ou os valores persistidos. */
export function normalizarOrigemQuadro(valor: string | null | undefined): string | null {
  const texto = valor?.trim().replace(/\s+/g, " ");
  if (!texto) return null;
  const chave = chaveTexto(texto);
  if (chave === "instagram") return "Instagram";
  if (chave === "site" || chave === "website" || chave === "noloss" || chave === "no loss") return "Site";
  return rotulosPadrao.get(chave) ?? texto;
}

export function origemCorrespondeFiltro(origem: string | null | undefined, filtro: FiltroOrigemQuadro): boolean {
  if (filtro === undefined) return true;
  const valor = normalizarOrigemQuadro(origem);
  return filtro === null ? valor === null : valor !== null && chaveTexto(valor) === chaveTexto(normalizarOrigemQuadro(filtro) ?? "");
}

export function origensDisponiveisQuadro(entradas: readonly { origem?: string | null }[]): Array<string | null> {
  const valores = new Map<string, string>();
  let semOrigem = false;
  for (const entrada of entradas) {
    const origem = normalizarOrigemQuadro(entrada.origem);
    if (origem === null) { semOrigem = true; continue; }
    const chave = chaveTexto(origem);
    const anterior = valores.get(chave);
    if (!anterior || origem.localeCompare(anterior, "pt-BR", { sensitivity: "variant" }) < 0) valores.set(chave, origem);
  }
  const origens: Array<string | null> = [...valores.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (semOrigem) origens.push(null);
  return origens;
}

export function valorSelectOrigemQuadro(origem: FiltroOrigemQuadro): string {
  const normalizada = normalizarOrigemQuadro(origem);
  return origem === undefined ? TODAS_ORIGENS_QUADRO : normalizada === null ? SEM_ORIGEM_QUADRO : PREFIXO_ORIGEM + encodeURIComponent(normalizada);
}

export function filtroDoSelectOrigemQuadro(valor: string): FiltroOrigemQuadro {
  if (valor === SEM_ORIGEM_QUADRO) return null;
  if (!valor.startsWith(PREFIXO_ORIGEM)) return undefined;
  try { return normalizarOrigemQuadro(decodeURIComponent(valor.slice(PREFIXO_ORIGEM.length))) ?? undefined; }
  catch { return undefined; }
}

export function corOrigemQuadro(origem: string | null): { fundo: string; borda: string; texto: string; ponto: string } {
  const chave = chaveTexto(normalizarOrigemQuadro(origem) ?? "Sem origem");
  let hue = chave === "instagram" ? 270 : chave === "site" || chave === "website" ? 217 : 0;
  if (chave !== "instagram" && chave !== "site" && chave !== "website") {
    let hash = 2166136261;
    for (const letra of chave) { hash ^= letra.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    hue = ((hash >>> 0) % 360_000) / 1000;
    if (hue >= 205 && hue <= 228 || hue >= 260 && hue <= 283) hue = (hue + 47) % 360;
  }
  return { fundo: `hsl(${hue} 88% 55% / 0.18)`, borda: `hsl(${hue} 88% 65% / 0.65)`, texto: `hsl(${hue} 90% 88%)`, ponto: `hsl(${hue} 90% 68%)` };
}

type ContextoOrigem = { clienteId: number; origemLead?: string | null; canalAquisicao?: string | null };
export type CardComOrigemQuadro = {
  empresaId: number;
  campoValores?: readonly { valor: string | null; campo: { nome: string; chave?: string | null; ativo?: boolean } }[];
  servicoContexto?: { clienteServico?: ContextoOrigem | null; contratoComercial?: ContextoOrigem | null } | null;
};

function origemUnivoca(valores: readonly (string | null | undefined)[]): { origem: string | null; conflito: boolean } {
  const origens = origensDisponiveisQuadro(valores.map((origem) => ({ origem }))).filter((origem): origem is string => origem !== null);
  return { origem: origens.length === 1 ? origens[0] : null, conflito: origens.length > 1 };
}

/** Origem do próprio negócio; nunca procura o último serviço/contrato da empresa. */
export function origemNativaQuadro(card: CardComOrigemQuadro): string | null {
  const propria = origemUnivoca((card.campoValores ?? []).filter((item) => item.campo.ativo !== false && campoEhOrigemCliente(item.campo)).map((item) => item.valor));
  if (propria.origem || propria.conflito) return propria.origem;
  const contextos = [card.servicoContexto?.clienteServico, card.servicoContexto?.contratoComercial].filter((contexto): contexto is ContextoOrigem => Boolean(contexto));
  if (contextos.some((contexto) => contexto.clienteId !== card.empresaId)) return null;
  return origemUnivoca(contextos.flatMap((contexto) => [contexto.origemLead, contexto.canalAquisicao])).origem;
}

export function origemNolossQuadro(lead: { utmSource?: string | null; utmMedium?: string | null }): string {
  return normalizarOrigemQuadro(lead.utmSource?.trim() || lead.utmMedium?.trim() || "Site")!;
}
