import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { capacidadeObrigatoriaEntrada } from "@/lib/bpm/campos-formulario-publicado";
import { obterErroProximoContatoParaEntrada } from "@/lib/bpm/em-tratativa";
import { sincronizarProximoContatoAgenda } from "@/lib/bpm/proximo-contato-agenda";

describe("Sem viabilidade — Próximo Contato configurável", () => {
  it("segue a obrigação publicada no formulário", async () => {
    const findFirst = vi.fn().mockResolvedValueOnce({ configJson: '{"obrigatorioEntrada":true}' })
      .mockResolvedValueOnce({ configJson: '{"obrigatorioEntrada":false}' })
      .mockResolvedValueOnce(null);
    const client = { bpmFormularioComponente: { findFirst } } as never;
    expect(await capacidadeObrigatoriaEntrada("etapa", "FOLLOW_UP_SCHEDULER", client)).toBe(true);
    expect(await capacidadeObrigatoriaEntrada("etapa", "FOLLOW_UP_SCHEDULER", client)).toBe(false);
    expect(await capacidadeObrigatoriaEntrada("etapa", "FOLLOW_UP_SCHEDULER", client)).toBe(false);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ capability: "FOLLOW_UP_SCHEDULER", secao: { formulario: { ativo: true, etapaId: "etapa" } } }),
    }));
  });

  it("rejeita ausência ou data inválida e aceita valor informado", () => {
    const etapaDestinoNome = "Sem viabilidade";
    expect(obterErroProximoContatoParaEntrada({ etapaDestinoNome, proximoContatoEm: null })).toContain("Próximo Contato");
    expect(obterErroProximoContatoParaEntrada({ etapaDestinoNome, proximoContatoEm: "inválido" })).toContain("Próximo Contato");
    expect(obterErroProximoContatoParaEntrada({ etapaDestinoNome, proximoContatoEm: new Date("2026-10-01T12:00:00Z") })).toBeNull();
  });

  it("mantém lembrete único mesmo em etapa final e atualiza responsável/data", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ prazo: new Date("2026-10-01T12:00:00Z"), responsavelId: 7, status: "PENDENTE", descricao: "Retorno do CRM — Sem viabilidade." })
      .mockResolvedValueOnce({ prazo: new Date("2026-10-01T12:00:00Z"), responsavelId: 7, status: "PENDENTE", descricao: "Retorno do CRM — Sem viabilidade." });
    const upsert = vi.fn();
    const updateMany = vi.fn();
    const tx = { bpmTarefa: { findUnique, upsert, updateMany } } as never;
    const base = { cardId: "card", etapaNome: "Sem viabilidade", status: "CONCLUIDO",
      proximoContatoEm: new Date("2026-10-01T12:00:00Z"), responsavelId: 7, empresaNome: "Empresa" };
    await sincronizarProximoContatoAgenda(base, tx);
    await sincronizarProximoContatoAgenda(base, tx);
    await sincronizarProximoContatoAgenda({ ...base, responsavelId: 8 }, tx);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({ create: { responsavelId: 7, status: "PENDENTE", tipo: "CRM_PROXIMO_CONTATO" } });
    expect(upsert.mock.calls[1]?.[0]).toMatchObject({ update: { responsavelId: 8 } });
    await sincronizarProximoContatoAgenda({ ...base, proximoContatoEm: null }, tx);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "crm-proximo-contato:card", status: "PENDENTE" } }));
  });
});
