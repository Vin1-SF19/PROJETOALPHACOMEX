import { describe, expect, it } from "vitest";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import type { ContextoAvaliacao, GrupoCondicao } from "@/lib/bpm/regras/types";
import configuracao from "./fixtures/financeiro-pagamento-ativo-v11.json";

type No = {
  id: string;
  tipo: string;
  condicao?: GrupoCondicao;
  entaoId?: string;
  senaoId?: string;
  acaoTipo?: string;
  parametros?: { campoId?: string; valor?: string; tipo?: string; naoDuplicarTipo?: boolean };
  proximoId?: string;
};

function executar(grafo: { inicioId: string; nos: No[] }, contexto: ContextoAvaliacao) {
  const nos = new Map(grafo.nos.map((no) => [no.id, no]));
  const acoes: No[] = [];
  let id = grafo.inicioId;
  for (let passo = 0; passo < grafo.nos.length + 1; passo++) {
    const no = nos.get(id);
    if (!no) throw new Error(`Nó ausente: ${id}`);
    if (no.tipo === "FIM") return acoes;
    if (no.tipo === "CONDICAO") {
      id = avaliarGrupo(no.condicao!, contexto) ? no.entaoId! : no.senaoId!;
      continue;
    }
    acoes.push(no);
    if (no.acaoTipo === "ALTERAR_CAMPO" && no.parametros?.campoId) {
      contexto.camposDinamicos![no.parametros.campoId] = no.parametros.valor;
    }
    id = no.proximoId!;
  }
  throw new Error("Grafo não terminou");
}

function contexto(assinado: boolean, pago: boolean): ContextoAvaliacao {
  return { card: {}, agora: { data: "2026-09-29" }, contratacao: { dataExito: null }, camposDinamicos: {
    "alpha.pagamento.confirmado": pago ? "Sim" : "Não",
    "alpha.financeiro.status.contrato.assinatura": assinado ? "Assinado" : "Aguardando assinatura",
    "alpha.data.da.assinatura": assinado ? "2026-09-28T12:00:00.000Z" : null,
    "alpha.contrato.assinado.anexo": assinado ? "anexo-contrato" : null,
    "alpha.valor.esperado": "97.50", "alpha.valor.recebido": pago ? "97.50" : null,
    "alpha.financeiro.valor.liquido.pagamento": "97.50",
    "alpha.financeiro.valor.bruto.contrato": "100.00", "alpha.total.retencoes": "2.50",
    "alpha.data.do.pagamento": pago ? "2026-09-29T12:00:00.000Z" : null,
    "alpha.financeiro.forma.pagamento.utilizada": pago ? "Pix" : null,
    "alpha.status.financeiro": "Aguardando pagamento", "alpha.pagamento.no.exito": "Não",
    "alpha.vencimento": "2026-09-28",
  } };
}

describe("grafo ensaiado do Financeiro ativo v11", () => {
  it.each([
    [false, false, "Aguardando assinatura e pagamento"],
    [true, false, "Aguardando pagamento"],
    [false, true, "Aguardando assinatura"],
    [true, true, "Contratação concluída"],
  ])("deriva o estado com assinatura=%s e pagamento=%s", (assinado, pago, esperado) => {
    const acoes = executar(configuracao.edicao.grafo as unknown as { inicioId: string; nos: No[] }, contexto(assinado, pago));
    const status = acoes.find((no) => no.parametros?.campoId === "alpha.financeiro.status.contratacao");
    expect(status?.parametros?.valor).toBe(esperado);
    const tarefas = acoes.filter((no) => no.acaoTipo === "CRIAR_TAREFA");
    expect(tarefas.map((no) => no.parametros?.tipo)).toEqual(pago ? ["EMISSAO_NF"] : []);
    if (pago) expect(tarefas[0].parametros?.naoDuplicarTipo).toBe(true);
  });

  it("não cobra no êxito sem evento registrado", () => {
    const pendente = contexto(false, false);
    pendente.camposDinamicos!["alpha.pagamento.no.exito"] = "Sim";
    expect(avaliarGrupo(configuracao.cobranca.condicao as GrupoCondicao, pendente)).toBe(false);
    pendente.contratacao!.dataExito = "2026-09-28";
    expect(avaliarGrupo(configuracao.cobranca.condicao as GrupoCondicao, pendente)).toBe(true);
    pendente.camposDinamicos!["alpha.pagamento.no.exito"] = null;
    expect(avaliarGrupo(configuracao.cobranca.condicao as GrupoCondicao, pendente)).toBe(false);
  });

  it("copia o valor líquido antes do bruto", () => {
    const c = contexto(false, false);
    const acoes = executar(configuracao.entrada.grafo as unknown as { inicioId: string; nos: No[] }, c);
    expect(acoes[0].parametros?.valor).toBe("{{campo.alpha.financeiro.valor.liquido.pagamento}}");
  });
});
