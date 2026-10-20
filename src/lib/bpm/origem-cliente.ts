import { ORIGENS_LEAD_PADRAO } from "@/lib/comercial/origens-lead";
import { CANAL_INDICACAO_PARCEIRO } from "@/lib/comercial/parceiro-nao-cadastrado";

type CampoOrigem = { nome: string; chave?: string | null };
export type ParceiroOrigemBpm = { campoId: string; parceiroId: number | null };

export function campoEhOrigemCliente(campo: CampoOrigem): boolean {
  const nome = campo.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return campo.chave === "alpha.canal.origem.do.cliente"
    || ["origem do cliente", "canal/origem do cliente", "canal de origem", "origem do lead"].includes(nome);
}

export function origemEhParceiro(origem: string): boolean {
  return [CANAL_INDICACAO_PARCEIRO, "Parceiro", "Indicação de parceiros"].includes(origem);
}

export function origemClienteValida(origem: string, opcoesLegadas: readonly string[] = []): boolean {
  return (ORIGENS_LEAD_PADRAO as readonly string[]).includes(origem) || opcoesLegadas.includes(origem);
}

// Envelope exclusivo do rascunho: extraído antes de enviar para as actions.
// O campo persistido e os contextos de regras continuam contendo texto simples.
export function criarRascunhoOrigem(origem: string, parceiroId: number | null): string {
  return JSON.stringify({ tipo: "ORIGEM_CLIENTE_RASCUNHO", origem, parceiroId });
}

export function lerRascunhoOrigem(valor: string): { origem: string; parceiroId: number | null } | null {
  try {
    const parsed = JSON.parse(valor);
    if (parsed?.tipo !== "ORIGEM_CLIENTE_RASCUNHO" || typeof parsed.origem !== "string"
      || !(parsed.parceiroId === null || Number.isSafeInteger(parsed.parceiroId) && parsed.parceiroId > 0)) return null;
    return { origem: parsed.origem, parceiroId: parsed.parceiroId };
  } catch { return null; }
}

export function valorInicialCampo(campo: CampoOrigem & { valor?: string | null; parceiroOrigemId?: number | null }): string {
  const valor = campo.valor ?? "";
  return campoEhOrigemCliente(campo)
    ? criarRascunhoOrigem(valor, origemEhParceiro(valor) ? campo.parceiroOrigemId ?? null : null)
    : valor;
}

export function extrairPayloadOrigem(valores: Record<string, string>) {
  const camposValores: Record<string, string> = {};
  let parceiroOrigem: ParceiroOrigemBpm | undefined;
  for (const [campoId, valor] of Object.entries(valores)) {
    const rascunho = lerRascunhoOrigem(valor);
    camposValores[campoId] = rascunho?.origem ?? valor;
    if (rascunho) {
      const parceiroId = origemEhParceiro(rascunho.origem) ? rascunho.parceiroId : null;
      if (origemEhParceiro(rascunho.origem) && !parceiroId) throw new Error("Selecione o parceiro que indicou.");
      if (parceiroOrigem && parceiroOrigem.parceiroId !== parceiroId) throw new Error("Informe a mesma origem e parceiro nos campos do card.");
      parceiroOrigem = { campoId, parceiroId };
    }
  }
  return { camposValores, ...(parceiroOrigem ? { parceiroOrigem } : {}) };
}
