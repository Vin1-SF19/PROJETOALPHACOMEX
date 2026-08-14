import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  checarAcessoBpmCard,
  checarAcessoDiretoriaBpm,
} from "@/lib/bpm/ownership";
import {
  etapaEhBoasVindas,
  usuarioEhDiretoriaBpm,
} from "@/lib/bpm/boas-vindas";

function cliente(params: { role: string; etapa: string; membro?: boolean }) {
  return {
    usuarios: {
      findUnique: async () => ({
        id: 7,
        role: params.role,
        status: "ATIVO",
        permissoes: "crm",
      }),
    },
    setorPermissao: { findMany: async () => [] },
    usuarioPermissaoOverride: { findMany: async () => [] },
    bpmPipeline: {},
    bpmCard: {
      findUnique: async () => ({ etapa: { nome: params.etapa } }),
    },
    bpmCardMembro: {
      findUnique: async () => (params.membro === false ? null : { role: "RESPONSAVEL" }),
    },
  };
}

describe("Boas-vindas — atenção e acesso exclusivo da diretoria", () => {
  it("normaliza a etapa e limita a diretoria à role Admin atualmente cadastrada", () => {
    expect(etapaEhBoasVindas(" BOAS-VINDAS ")).toBe(true);
    expect(etapaEhBoasVindas("Em análise")).toBe(false);
    expect(usuarioEhDiretoriaBpm("Admin")).toBe(true);
    expect(usuarioEhDiretoriaBpm("CEO")).toBe(false);
    expect(usuarioEhDiretoriaBpm("TI")).toBe(false);
  });

  it("nega o card de Boas-vindas mesmo a membro CRM ou admin global não-diretor", async () => {
    await expect(
      checarAcessoBpmCard("card-1", 7, "COMERCIAL", "visualizar", cliente({
        role: "COMERCIAL",
        etapa: "Boas-vindas",
      }) as never),
    ).resolves.toMatchObject({ autorizado: false });

    await expect(
      checarAcessoBpmCard("card-1", 7, "CEO", "visualizar", cliente({
        role: "CEO",
        etapa: "Boas-vindas",
      }) as never),
    ).resolves.toMatchObject({ autorizado: false });
  });

  it("permite a conta de diretoria e preserva o acesso normal fora de Boas-vindas", async () => {
    await expect(
      checarAcessoDiretoriaBpm(7, cliente({ role: "Admin", etapa: "Boas-vindas" }) as never),
    ).resolves.toBe(true);
    await expect(
      checarAcessoBpmCard("card-1", 7, "Admin", "editarCard", cliente({
        role: "Admin",
        etapa: "Boas-vindas",
      }) as never),
    ).resolves.toMatchObject({ autorizado: true });
    await expect(
      checarAcessoBpmCard("card-2", 7, "COMERCIAL", "visualizar", cliente({
        role: "COMERCIAL",
        etapa: "Em análise",
      }) as never),
    ).resolves.toMatchObject({ autorizado: true });
  });

  it("aplica a regra às listagens indiretas e sinaliza visualmente o card não acessado", () => {
    const cards = readFileSync(resolve("src/actions/bpm/Cards.ts"), "utf8");
    const empresas = readFileSync(resolve("src/actions/bpm/Empresas.ts"), "utf8");
    const tarefas = readFileSync(resolve("src/actions/bpm/Tarefas.ts"), "utf8");
    const dashboard = readFileSync(resolve("src/actions/bpm/Dashboard.ts"), "utf8");
    const board = readFileSync(resolve("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx"), "utf8");

    expect(cards).toContain("checarAcessoDiretoriaBpm(userId)");
    expect(cards).toContain("etapaEhBoasVindas(etapaDestino.nome)");
    expect(cards).toContain("etapaEhBoasVindas(destinoAtual.nome)");
    expect(empresas).toContain("NOME_ETAPA_BOAS_VINDAS");
    expect(tarefas).toContain("NOME_ETAPA_BOAS_VINDAS");
    expect(dashboard).toContain("filtroCardBoasVindas");
    expect(board).toContain("alertaBoasVindas");
    expect(board).toContain("Nunca acessado — requer atenção");
  });
});
