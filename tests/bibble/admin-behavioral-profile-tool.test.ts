import { beforeEach, describe, expect, it, vi } from "vitest";

const { inspectBehavioralProfileByNameMock } = vi.hoisted(() => ({
  inspectBehavioralProfileByNameMock: vi.fn(),
}));

vi.mock("@/lib/bibble/behavioral-memory", () => ({
  inspectBehavioralProfileByName: inspectBehavioralProfileByNameMock,
}));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/chamados/notificacoes-server", () => ({ notificarNovoChamado: vi.fn() }));
vi.mock("@/lib/cnpj/receita-federal", () => ({ getReceitaData: vi.fn() }));
vi.mock("@/lib/bibble/gerar-ficha-server", () => ({ gerarFichaServer: vi.fn() }));
vi.mock("@/lib/bibble/calendar-tools", () => ({
  executarCalendarTool: vi.fn(),
  isCalendarTool: vi.fn(() => false),
}));

import { executarTool } from "@/lib/bibble/tool-executor";
import {
  authorizedTools,
  canConsultBehavioralProfiles,
  routeToolsByIntent,
} from "@/lib/bibble/tool-policy";
import { BIBBLE_TOOLS } from "@/lib/bibble/tools";

const baseContext = {
  userId: 1,
  userName: "Gestor",
  permissoes: [] as string[],
};

beforeEach(() => {
  vi.clearAllMocks();
  inspectBehavioralProfileByNameMock.mockResolvedValue({
    status: "ready",
    target: { name: "Nailza" },
    sampleSize: 12,
    period: {
      first: "2026-09-01T10:00:00.000Z",
      last: "2026-09-15T10:00:00.000Z",
    },
    confidence: 0.82,
    confidenceLabel: "alta",
    classifierVersion: "bibble-style-v1",
    insufficientSample: false,
    aggregate: {
      objetividade: { code: "high", label: "costuma ser direta e objetiva" },
      registro: { code: "neutral", label: "usa um registro neutro" },
      tecnicidade: { code: "general", label: "prefere linguagem geral" },
      nivelDeDetalhe: { code: "short", label: "prefere respostas curtas" },
      humor: { code: "low", label: "quase não usa humor" },
    },
    facts: ["costuma ser direta e objetiva", "prefere respostas curtas"],
    summary: "Nailza costuma ser direta e objetiva; prefere respostas curtas.",
  });
});

describe("consultar_estilo_comunicacao_usuario authorization", () => {
  it("allows only normalized Admin and TI roles", () => {
    expect(canConsultBehavioralProfiles("Admin")).toBe(true);
    expect(canConsultBehavioralProfiles(" admin ")).toBe(true);
    expect(canConsultBehavioralProfiles("TI")).toBe(true);
    expect(canConsultBehavioralProfiles("T.I.")).toBe(true);
    expect(canConsultBehavioralProfiles("CEO")).toBe(false);
    expect(canConsultBehavioralProfiles("User")).toBe(false);
    expect(canConsultBehavioralProfiles(undefined)).toBe(false);
  });

  it.each(["CEO", "User", "Lider Comercial"])("does not publish the tool for role %s", role => {
    const names = authorizedTools(BIBBLE_TOOLS, { ...baseContext, role }, false)
      .map(tool => tool.function.name);
    expect(names).not.toContain("consultar_estilo_comunicacao_usuario");
  });

  it.each(["Admin", "TI", "T.I."])("publishes the tool for role %s", role => {
    const names = authorizedTools(BIBBLE_TOOLS, { ...baseContext, role }, false)
      .map(tool => tool.function.name);
    expect(names).toContain("consultar_estilo_comunicacao_usuario");
  });

  it("denies CEO at the execution boundary without consulting history", async () => {
    const result = await executarTool(
      "consultar_estilo_comunicacao_usuario",
      { usuario_nome: "Nailza" },
      { ...baseContext, role: "CEO" },
    );

    expect(JSON.parse(result)).toEqual({ ok: false, erro: "Ferramenta indisponível para este usuário." });
    expect(inspectBehavioralProfileByNameMock).not.toHaveBeenCalled();
  });

  it.each(["Admin", "TI"])("returns the aggregate to %s without raw messages", async role => {
    const result = await executarTool(
      "consultar_estilo_comunicacao_usuario",
      { usuario_nome: "Nailza" },
      { ...baseContext, role },
    );
    const parsed = JSON.parse(result);

    expect(inspectBehavioralProfileByNameMock).toHaveBeenCalledWith("Nailza");
    expect(parsed).toMatchObject({
      ok: true,
      privacy: "Resultado agregado; nenhuma mensagem, trecho ou anexo foi retornado.",
      status: "ready",
      target: { name: "Nailza" },
      sampleSize: 12,
      insufficientSample: false,
    });
    expect(result).not.toMatch(/content|mensagens?\s*:/iu);
  });
});

describe("consultar_estilo_comunicacao_usuario intent routing", () => {
  it.each([
    "Bibble, como que a usuario Nailza fala com voce?",
    "Como a Nailza conversa com o Bibble?",
    "Qual é o perfil de comunicação da Nailza?",
  ])("routes the administrative question: %s", prompt => {
    const selected = routeToolsByIntent(BIBBLE_TOOLS, prompt).map(tool => tool.function.name);
    expect(selected).toEqual(["consultar_estilo_comunicacao_usuario"]);
  });
});
