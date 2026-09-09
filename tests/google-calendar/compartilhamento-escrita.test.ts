import { beforeEach, describe, expect, it, vi } from "vitest";

const acessoMock = vi.hoisted(() => vi.fn());
const criarEventoMock = vi.hoisted(() => vi.fn());
const listarCalendariosMock = vi.hoisted(() => vi.fn());
const criarTarefaMock = vi.hoisted(() => vi.fn());
const auditoriaMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  usuarios: { findUnique: vi.fn() },
  googleCalendarColegaVisivel: { findUnique: vi.fn() },
  googleCalendarTaskListCache: { findFirst: vi.fn() },
  googleCalendarTaskCache: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/google-calendar/autorizacao", () => ({
  verificarAcessoCalendarioAlpha: acessoMock,
}));
vi.mock("@/lib/google-calendar/auditoria", () => ({
  registrarAuditoriaCalendarioAlpha: auditoriaMock,
}));
vi.mock("@/lib/google-calendar/client", () => ({
  listarCalendarios: listarCalendariosMock,
  criarEvento: criarEventoMock,
  atualizarEventoParcial: vi.fn(),
  cancelarEvento: vi.fn(),
  obterEvento: vi.fn(),
  responderConvite: vi.fn(),
}));
vi.mock("@/lib/google-calendar/tasks", () => ({
  criarTarefaGoogleTasks: criarTarefaMock,
  atualizarTarefaGoogleTasks: vi.fn(),
  concluirTarefaGoogleTasks: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  criarEventoParaColega,
  criarTarefaParaColega,
} from "@/actions/google-calendar-admin";

const eventoValido = {
  calendarId: "colega@alpha.com",
  titulo: "Planejamento compartilhado",
  timezone: "America/Sao_Paulo",
  diaInteiro: false,
  inicio: new Date("2026-09-10T13:00:00.000Z"),
  fim: new Date("2026-09-10T14:00:00.000Z"),
  participantes: [],
  criarMeet: false,
  eventType: "default" as const,
  visibilidade: "default" as const,
  transparencia: "opaque" as const,
  lembretesMinutos: [],
};

describe("escrita em agendas compartilhadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acessoMock.mockResolvedValue({ autorizado: true, userId: 7 });
    prismaMock.usuarios.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
      where.id === 7
        ? Promise.resolve({ role: "USER" })
        : Promise.resolve({
            email: "colega@alpha.com",
            status: "ATIVO",
            googleCalendarConexao: { status: "ATIVA" },
          }),
    );
  });

  it("permite ao vínculo EDITOR criar evento usando a identidade resolvida no servidor", async () => {
    prismaMock.googleCalendarColegaVisivel.findUnique.mockResolvedValue({ papel: "EDITOR" });
    listarCalendariosMock.mockResolvedValue([{
      googleCalendarId: "colega@alpha.com",
      papelAcesso: "owner",
      timezone: "America/Sao_Paulo",
    }]);
    criarEventoMock.mockResolvedValue({ googleEventId: "evt-1" });

    const resultado = await criarEventoParaColega(8, eventoValido);

    expect(resultado).toEqual({ success: true, data: { googleEventId: "evt-1" } });
    expect(criarEventoMock).toHaveBeenCalledWith(expect.objectContaining({
      emailUsuario: "colega@alpha.com",
      calendarId: "colega@alpha.com",
    }));
  });

  it("bloqueia escrita quando o vínculo é somente VISUALIZADOR", async () => {
    prismaMock.googleCalendarColegaVisivel.findUnique.mockResolvedValue({ papel: "VISUALIZADOR" });

    const resultado = await criarEventoParaColega(8, eventoValido);

    expect(resultado).toEqual({
      success: false,
      error: "Você não tem permissão de edição nesta agenda compartilhada.",
    });
    expect(criarEventoMock).not.toHaveBeenCalled();
  });

  it("não cria bypass de compartilhamento quando não existe vínculo EDITOR", async () => {
    prismaMock.googleCalendarColegaVisivel.findUnique.mockResolvedValue(null);

    const resultado = await criarEventoParaColega(8, eventoValido);

    expect(resultado.success).toBe(false);
    expect(criarEventoMock).not.toHaveBeenCalled();
  });

  it("cria tarefa apenas em lista pertencente ao colega autorizado", async () => {
    prismaMock.googleCalendarColegaVisivel.findUnique.mockResolvedValue({ papel: "EDITOR" });
    prismaMock.googleCalendarTaskListCache.findFirst.mockResolvedValue({
      id: "lista-cache-8",
      googleTaskListId: "lista-google-8",
    });
    criarTarefaMock.mockResolvedValue({
      googleTaskId: "task-google-1",
      titulo: "Revisar contrato",
      notas: null,
      status: "needsAction",
      vencimentoEm: new Date("2026-09-10T12:00:00.000Z"),
      concluidaEm: null,
      excluida: false,
      oculta: false,
      parentGoogleTaskId: null,
      posicao: null,
      atualizadoGoogleEm: new Date("2026-09-09T12:00:00.000Z"),
    });
    prismaMock.googleCalendarTaskCache.upsert.mockResolvedValue({ id: "task-cache-1" });

    const resultado = await criarTarefaParaColega(8, {
      taskListId: "lista-google-8",
      titulo: "Revisar contrato",
      vencimentoEm: new Date("2026-09-10T12:00:00.000Z"),
      inicioLocalEm: new Date("2026-09-10T13:00:00.000Z"),
      fimLocalEm: new Date("2026-09-10T14:00:00.000Z"),
    });

    expect(resultado).toEqual({ success: true, data: { id: "task-cache-1" } });
    expect(prismaMock.googleCalendarTaskListCache.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        conexao: { userId: 8, status: "ATIVA" },
        googleTaskListId: "lista-google-8",
      }),
    }));
    expect(criarTarefaMock).toHaveBeenCalledWith(expect.objectContaining({
      emailUsuario: "colega@alpha.com",
      taskListId: "lista-google-8",
    }));
  });
});
