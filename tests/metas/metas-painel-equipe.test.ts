import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  usuarios: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  contratoComercial: {
    groupBy: vi.fn(),
  },
  metaUsuario: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  metaEquipe: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  getColaboradoresParaConfigurar,
  getDadosMetas,
  toggleMetaVisibilidade,
  upsertMetaEquipe,
  upsertMetaUsuario,
} from "@/actions/Metas";

const rolesEquipe = ["COMERCIAL", "Lider Comercial"];

describe("consultas do painel Alpha Metas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
    prismaMock.contratoComercial.groupBy.mockResolvedValue([]);
    prismaMock.metaUsuario.findMany.mockResolvedValue([]);
    prismaMock.metaEquipe.findFirst.mockResolvedValue(null);
  });

  it("busca closers e líderes visíveis para o placar", async () => {
    prismaMock.usuarios.findMany.mockResolvedValue([
      {
        id: 10,
        nome: "Closer Alpha",
        usuario: "closer.alpha",
        imagemUrl: null,
        tema_interface: "blue",
      },
      {
        id: 20,
        nome: "Líder Alpha",
        usuario: "lider.alpha",
        imagemUrl: null,
        tema_interface: "indigo",
      },
    ]);
    prismaMock.contratoComercial.groupBy.mockResolvedValue([
      { usuarioId: 20, _count: { id: 3 } },
    ]);
    prismaMock.metaUsuario.findMany.mockResolvedValue([
      { colaboradoraId: "Líder Alpha", metaMensal: 5, superMetaMensal: 8 },
    ]);

    const resultado = await getDadosMetas(9, 2026);

    expect(prismaMock.usuarios.findMany).toHaveBeenCalledWith({
      where: {
        role: { in: rolesEquipe },
        meta_visivel_painel: true,
      },
      select: {
        id: true,
        nome: true,
        usuario: true,
        imagemUrl: true,
        tema_interface: true,
      },
      orderBy: { nome: "asc" },
    });
    expect(resultado).toMatchObject({
      success: true,
      totalVendas: 3,
      colaboradores: [
        expect.objectContaining({ nome: "Líder Alpha", vendas: 3, meta: 5, superMeta: 8 }),
        expect.objectContaining({ nome: "Closer Alpha", vendas: 0, superMeta: 0 }),
      ],
    });
  });

  it("mantém líderes visíveis e ocultas disponíveis na configuração", async () => {
    prismaMock.usuarios.findMany.mockResolvedValue([
      {
        id: 20,
        nome: "Líder Visível",
        usuario: "lider.visivel",
        meta_visivel_painel: true,
      },
      {
        id: 21,
        nome: "Líder Oculta",
        usuario: "lider.oculta",
        meta_visivel_painel: false,
      },
    ]);

    const resultado = await getColaboradoresParaConfigurar();

    expect(prismaMock.usuarios.findMany).toHaveBeenCalledWith({
      where: { role: { in: rolesEquipe } },
      select: {
        id: true,
        nome: true,
        usuario: true,
        meta_visivel_painel: true,
      },
      orderBy: { nome: "asc" },
    });
    expect(resultado).toMatchObject({
      success: true,
      colaboradores: [
        expect.objectContaining({ id: 20, visivelNoPainel: true }),
        expect.objectContaining({ id: 21, visivelNoPainel: false }),
      ],
    });
  });
});

describe("persistência de super metas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
    prismaMock.metaUsuario.upsert.mockResolvedValue({ id: 1 });
    prismaMock.metaEquipe.upsert.mockResolvedValue({ id: 1 });
  });

  it("salva meta e super meta individual no mesmo período", async () => {
    await expect(upsertMetaUsuario("Giselle", 12, 18, 9, 2026)).resolves.toEqual({ success: true });
    expect(prismaMock.metaUsuario.upsert).toHaveBeenCalledWith({
      where: { colaboradoraId_mes_ano: { colaboradoraId: "Giselle", mes: 9, ano: 2026 } },
      update: { metaMensal: 12, superMetaMensal: 18 },
      create: { colaboradoraId: "Giselle", metaMensal: 12, superMetaMensal: 18, mes: 9, ano: 2026 },
    });
  });

  it("salva meta e super meta geral e rejeita super meta inferior", async () => {
    await expect(upsertMetaEquipe(36, 48, 9, 2026)).resolves.toEqual({ success: true });
    expect(prismaMock.metaEquipe.upsert).toHaveBeenCalledWith({
      where: { mes_ano: { mes: 9, ano: 2026 } },
      update: { metaMensal: 36, superMetaMensal: 48 },
      create: { metaMensal: 36, superMetaMensal: 48, mes: 9, ano: 2026 },
    });

    await expect(upsertMetaEquipe(36, 30, 9, 2026)).resolves.toEqual({
      success: false,
      error: "Super meta inválida",
    });
    expect(prismaMock.metaEquipe.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("visibilidade de líder comercial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "20", role: "Lider Comercial" } });
  });

  it("altera somente o usuário informado usando o campo existente", async () => {
    prismaMock.usuarios.update.mockResolvedValue({ id: 21 });

    await expect(toggleMetaVisibilidade(21, false)).resolves.toEqual({ success: true });
    expect(prismaMock.usuarios.update).toHaveBeenCalledWith({
      where: { id: 21 },
      data: { meta_visivel_painel: false },
    });
  });

  it("retorna erro quando a persistência da visibilidade falha", async () => {
    prismaMock.usuarios.update.mockRejectedValue(new Error("database unavailable"));

    await expect(toggleMetaVisibilidade(21, true)).resolves.toEqual({
      success: false,
      error: "Erro ao atualizar visibilidade",
    });
  });
});

describe("estrutura visual da meta coletiva", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/PainelAlpha/Metas/MetasClient.tsx"),
    "utf8",
  );

  function entre(inicio: string, fim: string) {
    const inicioIndex = source.indexOf(inicio);
    const fimIndex = source.indexOf(fim, inicioIndex + inicio.length);
    expect(inicioIndex).toBeGreaterThanOrEqual(0);
    expect(fimIndex).toBeGreaterThan(inicioIndex);
    return source.slice(inicioIndex, fimIndex);
  }

  it("mantém Meta Equipe fora dos cabeçalhos normal e TV", () => {
    const controlesTv = entre(
      "{/* Saída do modo TV manual; a meta coletiva agora vive somente no placar. */}",
      "{/* ── Header (oculto no modo TV) ── */}",
    );
    const headerNormal = entre(
      "{/* ── Header (oculto no modo TV) ── */}",
      "{/* ── Scoreboard — termômetro coletivo lateral + linhas individuais ── */}",
    );

    expect(controlesTv).not.toContain("Meta Equipe");
    expect(headerNormal).not.toContain("Meta Equipe");
  });

  it("renderiza um único termômetro coletivo na lateral do placar", () => {
    const scoreboard = entre(
      "{/* ── Scoreboard — termômetro coletivo lateral + linhas individuais ── */}",
      "{/* Celebrações individuais */}",
    );

    expect(source).toContain("data-team-goal-thermometer");
    expect(source).not.toContain("data-team-goal-bar");
    expect(scoreboard.match(/<TermometroMetaEquipe/g)).toHaveLength(1);
    expect(scoreboard).toContain("totalVendas={totalVendas}");
    expect(scoreboard).toContain("meta={metaEquipe}");
    expect(scoreboard).toContain("superMeta={superMetaEquipe}");
  });

  it("faz o progresso subir da base, mostra só o realizado e marca meta e super meta", () => {
    const termometro = entre(
      "function TermometroMetaEquipe",
      "// ─── Tela de celebração individual",
    );

    expect(source).toContain("data-team-goal-fill");
    expect(source).toContain("absolute inset-x-0 bottom-0");
    expect(source).toContain("style={{ height: `${progresso}%` }}");
    expect(source).toContain("data-team-goal-reading");
    expect(source).toContain("data-team-goal-normal-marker");
    expect(source).toContain("data-team-goal-super-marker");
    expect(termometro).toContain('className="absolute inset-x-0 z-20 flex flex-col items-center"');
    expect(termometro).toContain("Meta {meta}");
    expect(termometro).toContain("Super Meta {superMeta}");
    expect(termometro).not.toContain('left-[-13px]');
    expect(termometro).toContain("{totalVendas}");
    expect(termometro).not.toContain("<Users");
  });

  it("move a meta normal debaixo do nome para o bloco ao lado da super meta", () => {
    const linha = entre(
      "function LinhaColaborador",
      "// ─── Termômetro lateral da meta coletiva",
    );

    expect(linha).toContain("Meta normal ao lado de vendas totais / super meta");
    expect(linha).toContain('aria-label={`Meta normal ${colab.meta || "não definida"}`}');
    expect(linha).not.toContain("`Meta: ${colab.meta}");
    expect(linha).toContain('{colab.superMeta || "—"}');
  });

  it("preserva o gatilho, o som e a tela da celebração coletiva", () => {
    expect(source).toContain("if (meta > 0 && total >= meta && !equipeJaCelebradaRef.current)");
    expect(source).toContain("setTimeout(() => setCelebrandoEquipe(true)");
    expect(source).toContain("<TelaCelebracaoEquipe");
    expect(source).toContain('tocarSomMeta(superMetaAtingida ? "super" : "equipe")');
    expect(source).toContain("setCelebrandoSuperMetaEquipe(true)");
  });
});
