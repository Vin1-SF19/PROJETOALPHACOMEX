import { beforeEach, describe, expect, it, vi } from "vitest";

const googleTasksMock = vi.hoisted(() => ({
  atualizar: vi.fn(),
  concluir: vi.fn(),
  criar: vi.fn(),
  listarListas: vi.fn(),
}));
const obterUsuarioMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  googleCalendarTaskSchedule: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  googleCalendarTaskCache: { update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/google-calendar/tasks", () => ({
  atualizarTarefaGoogleTasks: googleTasksMock.atualizar,
  concluirTarefaGoogleTasks: googleTasksMock.concluir,
  criarTarefaGoogleTasks: googleTasksMock.criar,
  listarListasGoogleTasks: googleTasksMock.listarListas,
}));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivo: obterUsuarioMock,
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { concluirTarefaAgendadaDoChamado } from "@/lib/chamados/tarefa-agendada";

const CONCLUIDO_EM = new Date("2026-09-09T19:24:35.000Z");

describe("concluirTarefaAgendadaDoChamado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.googleCalendarTaskSchedule.findUnique.mockResolvedValue({
      id: "agenda-chamado-10",
      chamadoId: 10,
      tarefaCacheId: "task-cache-10",
      usuarioAgendaId: 3,
      status: "EM_ATENDIMENTO",
      tarefaCache: {
        googleTaskId: "google-task-10",
        notas: "Chamado #10\n\nHorário de início: 09/09/2026, 15:00",
        taskList: { googleTaskListId: "lista-google-1" },
      },
    });
    obterUsuarioMock.mockResolvedValue({
      ok: true,
      conexaoId: "conexao-3",
      emailUsuario: "tecnico@alphacomex.com",
    });
    googleTasksMock.concluir.mockResolvedValue({
      googleTaskId: "google-task-10",
      titulo: "Chamado #10 — Falha no acesso",
      notas: "Chamado #10\n\nHorário de início: 09/09/2026, 15:00",
      status: "completed",
      vencimentoEm: new Date("2026-09-09T18:00:00.000Z"),
      concluidaEm: CONCLUIDO_EM,
      excluida: false,
      oculta: false,
      parentGoogleTaskId: null,
      posicao: "0001",
      atualizadoGoogleEm: CONCLUIDO_EM,
    });
    googleTasksMock.atualizar.mockResolvedValue({
      googleTaskId: "google-task-10",
      titulo: "Chamado #10 — Falha no acesso",
      notas: "Chamado #10\n\nHorário de início: 09/09/2026, 15:00\n\nHorário de conclusão: 09/09/2026, 16:24",
      status: "completed",
      vencimentoEm: new Date("2026-09-09T18:00:00.000Z"),
      concluidaEm: CONCLUIDO_EM,
      excluida: false,
      oculta: false,
      parentGoogleTaskId: null,
      posicao: "0001",
      atualizadoGoogleEm: CONCLUIDO_EM,
    });
    prismaMock.googleCalendarTaskCache.update.mockReturnValue({ operacao: "cache" });
    prismaMock.googleCalendarTaskSchedule.update.mockReturnValue({ operacao: "agendamento" });
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it("aceita a grafia T.I, conclui no Google e persiste o fim real", async () => {
    await concluirTarefaAgendadaDoChamado({
      chamadoId: 10,
      concluidoEm: CONCLUIDO_EM,
      tecnicoId: 3,
      tecnicoRole: "T.I",
    });

    expect(googleTasksMock.concluir).toHaveBeenCalledWith({
      emailUsuario: "tecnico@alphacomex.com",
      taskListId: "lista-google-1",
      taskId: "google-task-10",
    });
    expect(googleTasksMock.atualizar).toHaveBeenCalledWith(expect.objectContaining({
      notas: expect.stringContaining("Horário de conclusão: 09/09/2026, 16:24"),
    }));
    expect(prismaMock.googleCalendarTaskSchedule.update).toHaveBeenCalledWith({
      where: { id: "agenda-chamado-10" },
      data: { status: "CONCLUIDO", fimConcluidoEm: CONCLUIDO_EM },
    });
    expect(prismaMock.googleCalendarTaskCache.update).toHaveBeenNthCalledWith(1, {
      where: { id: "task-cache-10" },
      data: expect.objectContaining({
        status: "completed",
        concluidaEm: CONCLUIDO_EM,
        notas: expect.stringContaining("Horário de conclusão: 09/09/2026, 16:24"),
      }),
    });
  });

  it("mantém o fim real e o estado concluído no cache local quando o Google falha", async () => {
    googleTasksMock.concluir.mockRejectedValueOnce(new Error("Google indisponível"));

    await expect(concluirTarefaAgendadaDoChamado({
      chamadoId: 10,
      concluidoEm: CONCLUIDO_EM,
      tecnicoId: 3,
      tecnicoRole: "TI",
    })).rejects.toThrow("Google indisponível");

    expect(prismaMock.googleCalendarTaskSchedule.update).toHaveBeenCalledWith({
      where: { id: "agenda-chamado-10" },
      data: { status: "CONCLUIDO", fimConcluidoEm: CONCLUIDO_EM },
    });
    expect(prismaMock.googleCalendarTaskCache.update).toHaveBeenCalledWith({
      where: { id: "task-cache-10" },
      data: expect.objectContaining({ status: "completed", concluidaEm: CONCLUIDO_EM }),
    });
  });

  it("não permite concluir a tarefa de uma agenda pertencente a outro técnico", async () => {
    await concluirTarefaAgendadaDoChamado({
      chamadoId: 10,
      concluidoEm: CONCLUIDO_EM,
      tecnicoId: 8,
      tecnicoRole: "TI",
    });

    expect(obterUsuarioMock).not.toHaveBeenCalled();
    expect(googleTasksMock.concluir).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
