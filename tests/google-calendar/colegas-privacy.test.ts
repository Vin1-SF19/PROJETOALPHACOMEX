import { beforeEach, describe, expect, it, vi } from "vitest";

const acessoMock = vi.hoisted(() => vi.fn());
const listarEventosPaginaMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  usuarios: {
    findUnique: vi.fn(),
  },
  googleCalendarPermissaoColegas: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  googleCalendarColegaVisivel: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/google-calendar/autorizacao", () => ({
  verificarAcessoCalendarioAlpha: acessoMock,
}));
vi.mock("@/lib/google-calendar/client", () => ({
  listarEventosPagina: listarEventosPaginaMock,
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  alternarPermissaoColegas,
  alternarVisibilidadeColega,
  listarEventosDeColega,
  personalizarCorColega,
  removerColegaVisivel,
} from "@/actions/google-calendar-colegas";

const eventoGoogle = {
  googleEventId: "evt-secreto",
  status: "confirmed",
  titulo: "Reunião aquisição confidencial",
  descricao: "Descrição confidencial",
  localizacao: null,
  inicio: { dataHora: "2026-07-30T13:00:00Z" },
  fim: { dataHora: "2026-07-30T14:00:00Z" },
  diaInteiro: false,
  recorrenciaRegras: null,
  eventoRecorrenteIdOrigem: null,
  participantes: [{ email: "cliente@externo.com", status: "accepted", organizador: false }],
  linkMeet: "https://meet.google.com/seg-red-ado",
  etag: '"segredo-etag"',
  atualizadoEm: "2026-07-30T12:00:00Z",
  visibilidade: "default",
};

const colegaAtivo = {
  id: 8,
  nome: "Colega",
  email: "colega@alpha.com",
  status: "ATIVO",
  googleCalendarConexao: { status: "ATIVA" },
};

describe("privacidade da agenda de colegas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acessoMock.mockResolvedValue({ autorizado: true, userId: 7 });
    listarEventosPaginaMock.mockResolvedValue({
      eventos: [eventoGoogle],
      proximoPageToken: null,
      proximoSyncToken: null,
    });
  });

  it("vínculo VISUALIZADOR recebe somente blocos Ocupado sem identificadores sensíveis", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce(colegaAtivo);
    prismaMock.googleCalendarColegaVisivel.findUnique.mockResolvedValue({
      cor: "#f97316",
      papel: "VISUALIZADOR",
      visivel: true,
    });

    const resultado = await listarEventosDeColega(
      8,
      "2026-07-30T00:00:00.000Z",
      "2026-07-31T00:00:00.000Z",
    );

    expect(resultado).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          titulo: "Ocupado",
          googleEventId: "",
          etag: "",
          linkMeet: null,
          colegaEmail: "",
          gravavel: false,
        }),
      ],
    });
    expect(JSON.stringify(resultado)).not.toContain("evt-secreto");
    expect(JSON.stringify(resultado)).not.toContain("cliente@externo.com");
    expect(JSON.stringify(resultado)).not.toContain("Reunião aquisição");
  });

  // Regressão: aprovação obrigatória vale para TODOS, inclusive Admin/CEO (decisão de
  // 2026-08-17) — não existe mais bypass por role, só o `papel` do vínculo aprovado importa.
  it("vínculo EDITOR mantém detalhes e escrita, mesmo para Admin/CEO", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce(colegaAtivo);
    prismaMock.googleCalendarColegaVisivel.findUnique.mockResolvedValue({
      cor: "#f97316",
      papel: "EDITOR",
      visivel: true,
    });

    const resultado = await listarEventosDeColega(
      8,
      "2026-07-30T00:00:00.000Z",
      "2026-07-31T00:00:00.000Z",
    );

    expect(resultado).toMatchObject({
      success: true,
      data: [
        {
          titulo: "Reunião aquisição confidencial",
          googleEventId: "evt-secreto",
          etag: '"segredo-etag"',
          linkMeet: "https://meet.google.com/seg-red-ado",
          colegaEmail: "colega@alpha.com",
          gravavel: true,
        },
      ],
    });
  });

  it("Admin/CEO SEM vínculo aprovado não acessa a agenda do colega", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce(colegaAtivo);
    prismaMock.googleCalendarColegaVisivel.findUnique.mockResolvedValue(null);

    const resultado = await listarEventosDeColega(
      8,
      "2026-07-30T00:00:00.000Z",
      "2026-07-31T00:00:00.000Z",
    );

    expect(resultado).toEqual({
      success: false,
      error: "Você não tem acesso à agenda deste colaborador. Envie um pedido de compartilhamento.",
    });
    expect(listarEventosPaginaMock).not.toHaveBeenCalled();
  });

  it("vínculo com visivel=false bloqueia acesso mesmo já aprovado", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce(colegaAtivo);
    prismaMock.googleCalendarColegaVisivel.findUnique.mockResolvedValue({
      cor: "#f97316",
      papel: "EDITOR",
      visivel: false,
    });

    const resultado = await listarEventosDeColega(
      8,
      "2026-07-30T00:00:00.000Z",
      "2026-07-31T00:00:00.000Z",
    );

    expect(resultado.success).toBe(false);
    expect(listarEventosPaginaMock).not.toHaveBeenCalled();
  });

  it("bloqueia alvo inativo ou sem conexão ativa", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce({
      ...colegaAtivo,
      googleCalendarConexao: { status: "DESATIVADA" },
    });

    const resultado = await listarEventosDeColega(
      8,
      "2026-07-30T00:00:00.000Z",
      "2026-07-31T00:00:00.000Z",
    );

    expect(resultado).toEqual({
      success: false,
      error: "Agenda do colaborador não está ativa.",
    });
    expect(listarEventosPaginaMock).not.toHaveBeenCalled();
  });

  it("valida colegaId, offset, ordem e janela máxima antes de consultar", async () => {
    await expect(
      listarEventosDeColega(
        -1,
        "2026-07-30T00:00:00",
        "2028-07-31T00:00:00.000Z",
      ),
    ).resolves.toMatchObject({ success: false });
    expect(prismaMock.usuarios.findUnique).not.toHaveBeenCalled();
    expect(listarEventosPaginaMock).not.toHaveBeenCalled();
  });

  it("valida estritamente as mutações de colega antes de gravar", async () => {
    await expect(removerColegaVisivel(0)).resolves.toMatchObject({
      success: false,
    });
    await expect(
      alternarVisibilidadeColega(-1, true),
    ).resolves.toMatchObject({ success: false });
    await expect(
      personalizarCorColega(8, "laranja"),
    ).resolves.toMatchObject({ success: false });

    expect(prismaMock.googleCalendarColegaVisivel.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.googleCalendarColegaVisivel.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.googleCalendarColegaVisivel.upsert).not.toHaveBeenCalled();
  });

  it("valida id/boolean da permissão global antes da mutação Admin", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({
      role: "Admin",
      email: "admin@alpha.com",
      nome: "Admin",
    });

    await expect(
      alternarPermissaoColegas(-1, true),
    ).resolves.toMatchObject({ success: false });
    expect(prismaMock.googleCalendarPermissaoColegas.upsert).not.toHaveBeenCalled();
    expect(prismaMock.googleCalendarPermissaoColegas.deleteMany).not.toHaveBeenCalled();
  });
});
