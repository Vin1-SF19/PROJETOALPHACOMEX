import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import {
  etapaEhBoasVindas,
  pipelineEhOperacional,
  usuarioPodeVincularPessoaBoasVindasOperacional,
  vinculoPessoaBoasVindasOperacionalRestrito,
} from "@/lib/bpm/boas-vindas";

function cliente(params: { role: string; membro?: boolean; podeVer?: boolean; responsavelId?: number; roleMembro?: string; setores?: string[] }) {
  return {
    usuarios: { findUnique: async () => ({ id: 7, role: params.role, status: "ATIVO", permissoes: "crm" }) },
    setorPermissao: { findMany: async () => [] },
    usuarioPermissaoOverride: { findMany: async () => [] },
    bpmCard: { findUnique: async () => ({ pipelineId: "pipeline", responsavelId: params.responsavelId ?? 99, pipeline: { setores: (params.setores ?? []).map((nome) => ({ setor: { nome } })) }, status: "ATIVO", vinculosOrigem: [], etapa: {
      nome: "Boas-vindas", ehFinal: false,
      visibilidades: params.podeVer === undefined ? [] : [{ perfil: params.role, podeVer: params.podeVer, podeAgir: params.podeVer }],
    } }) },
    bpmCardMembro: { findUnique: async () => (params.membro === false ? null : { role: params.roleMembro ?? "RESPONSAVEL" }) },
  };
}

describe("Boas-vindas — permissões configuradas", () => {
  it("mantém a identificação da etapa para o alerta visual", () => {
    expect(etapaEhBoasVindas(" BOAS-VINDAS ")).toBe(true);
    expect(etapaEhBoasVindas("Em análise")).toBe(false);
  });

  it("restringe o vínculo de pessoas à diretoria na Boas-vindas do Operacional", () => {
    expect(pipelineEhOperacional(" operacional ")).toBe(true);
    expect(vinculoPessoaBoasVindasOperacionalRestrito("Operacional", "BOAS-VINDAS")).toBe(true);
    expect(usuarioPodeVincularPessoaBoasVindasOperacional("Admin")).toBe(true);
    expect(usuarioPodeVincularPessoaBoasVindasOperacional("OPERACIONAL", 10)).toBe(true);
    expect(usuarioPodeVincularPessoaBoasVindasOperacional("DIRETOR")).toBe(false);
    expect(usuarioPodeVincularPessoaBoasVindasOperacional("TI")).toBe(false);
    expect(usuarioPodeVincularPessoaBoasVindasOperacional("COMERCIAL")).toBe(false);
    expect(vinculoPessoaBoasVindasOperacionalRestrito("Comercial", "Boas-vindas")).toBe(false);
  });

  it("permite à conta TI visualizar o card encaminhado conforme o acesso administrativo global", async () => {
    await expect(checarAcessoBpmCard("card-1", 7, "TI", "visualizar", cliente({
      role: "TI", membro: false,
    }) as never)).resolves.toMatchObject({ autorizado: true });
  });

  it("usa visibilidade da etapa e vínculo para usuários comuns", async () => {
    await expect(checarAcessoBpmCard("card-1", 7, "COMERCIAL", "visualizar", cliente({
      role: "COMERCIAL", podeVer: true,
    }) as never)).resolves.toMatchObject({ autorizado: true });
    await expect(checarAcessoBpmCard("card-1", 7, "COMERCIAL", "visualizar", cliente({
      role: "COMERCIAL", podeVer: false,
    }) as never)).resolves.toMatchObject({ autorizado: false });
    await expect(checarAcessoBpmCard("card-1", 7, "COMERCIAL", "visualizar", cliente({
      role: "COMERCIAL", membro: false,
    }) as never)).resolves.toMatchObject({ autorizado: false });
  });

  it("autoriza responsável sem linha de membro, mas mantém limites de pipeline e coluna", async () => {
    const params = { role: "COMERCIAL", membro: false, responsavelId: 7 };
    await expect(checarAcessoBpmCard("card", 7, "COMERCIAL", "editarCard", cliente(params) as never))
      .resolves.toMatchObject({ autorizado: true, role: "RESPONSAVEL" });
    await expect(checarAcessoBpmCard("card", 7, "COMERCIAL", "visualizar", cliente({ ...params, setores: ["OPERACIONAL"] }) as never))
      .resolves.toMatchObject({ autorizado: false });
    await expect(checarAcessoBpmCard("card", 7, "COMERCIAL", "visualizar", cliente({ ...params, podeVer: false }) as never))
      .resolves.toMatchObject({ autorizado: false });
  });

  it("preserva o perfil administrador do card quando também é responsável", async () => {
    await expect(checarAcessoBpmCard("card", 7, "COMERCIAL", "visualizar", cliente({
      role: "COMERCIAL", responsavelId: 7, roleMembro: "ADMINISTRADOR",
    }) as never)).resolves.toMatchObject({ autorizado: true, role: "ADMINISTRADOR", isAdminGlobal: false });
  });

  it("retira o filtro fixo nas consultas e mantém o aviso visual do card nunca acessado", () => {
    for (const caminho of ["src/actions/bpm/Cards.ts", "src/actions/bpm/Empresas.ts", "src/actions/bpm/Tarefas.ts", "src/actions/bpm/Dashboard.ts"]) {
      expect(readFileSync(resolve(caminho), "utf8")).not.toContain("NOME_ETAPA_BOAS_VINDAS");
    }
    expect(readFileSync(resolve("src/lib/bpm/transicao-command.ts"), "utf8")).not.toContain("checarAcessoDiretoriaBpm");
    const board = readFileSync(resolve("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx"), "utf8");
    expect(board).toContain("alertaBoasVindas");
    expect(board).toContain("Boas-vindas pendentes — requer atenção");
  });
});
