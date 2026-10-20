import { expect, it, vi } from "vitest";
import { materializarExecucoesEventosBpm } from "@/lib/bpm/automacoes/eventos";

it.each(["ENTRAR_COLUNA", "SAIR_COLUNA"])("replay ignora evento de reposicionamento livre em %s", async (gatilhoTipo) => {
  const create = vi.fn().mockResolvedValue({ id: "exec" });
  const client = {
    bpmAutomacaoVersao: { findMany: vi.fn().mockResolvedValue([{
      id: "versao", automacaoId: "automacao", gatilhoTipo,
      gatilhoConfigJson: '{"escopo":"GLOBAL_PIPELINE"}', automacao: { etapaId: "destino", pipelineId: "pipeline" },
    }]) },
    bpmEventoDominio: { findMany: vi.fn().mockResolvedValue([{
      id: "evento", tipo: "CARD_MOVIDO", cardId: "card", correlationId: "corr", causationId: null,
      profundidade: 0, valorAnteriorJson: '{"etapaId":"origem"}',
      valorNovoJson: '{"etapaId":"destino","automacoesSuprimidas":true}', card: { etapaId: "destino" },
    }]) },
    bpmAutomacaoExecucao: { findFirst: vi.fn().mockResolvedValue(null), create },
  };
  expect(await materializarExecucoesEventosBpm(10, client as never)).toMatchObject({ criadas: 0 });
  expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "IGNORADA" }) });
});
