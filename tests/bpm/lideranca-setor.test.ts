import { describe, expect, it, vi } from "vitest";
import { resolverAutoridadeMovimentoLivre } from "@/lib/bpm/lideranca-setor";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";

function client(role = "OPERACIONAL", id = 10, setor = "OPERACIONAL", status = "ATIVO", permissoes = "crm") {
  return {
    usuarios: { findUnique: vi.fn(async () => ({ id, role, status, permissoes })) },
    setorPermissao: { findMany: vi.fn(async () => []) },
    usuarioPermissaoOverride: { findMany: vi.fn(async () => []) },
    bpmCard: { findUnique: vi.fn(async () => ({ pipelineId: "operacional", responsavelId: 99,
      pipeline: { ativo: true, setores: [{ setor: { nome: setor, ativo: true } }], visualizacaoConfigJson: '{"version":1,"supervisores":[{"usuarioId":34,"setorIds":[4]}]}' },
      etapa: { nome: "Em execução", ehFinal: false, visibilidades: [] }, status: "ATIVO", vinculosOrigem: [] })) },
    bpmCardMembro: { findUnique: vi.fn(async () => null) },
  };
}

describe("autoridade de movimento por setor", () => {
  it.each(["Admin", "TI", "T.I", "CEO"])("libera %s sem usar papel informado pelo cliente", async (role) => {
    expect(await checarAcessoBpmCard("card", 3, "User", "moverEtapa", client(role, 3) as never))
      .toMatchObject({ autorizado: true, autoridadeMovimentoLivre: { tipo: "ADMIN" } });
  });
  it.each(["COMERCIAL", "Lider Comercial"])("líder comercial move no setor %s sem vínculo ao card", async (setor) => {
    expect(await checarAcessoBpmCard("card", 5, null, "moverEtapa", client("Líder Comercial", 5, setor) as never))
      .toMatchObject({ autorizado: true, autoridadeMovimentoLivre: { tipo: "LIDER_SETOR" } });
  });
  it.each(["OPERACIONAL", "Lider Operacional"])("líder operacional conserva a regra existente somente no setor %s", async (setor) => {
    expect(await checarAcessoBpmCard("card", 5, null, "moverEtapa", client("Líder Operacional", 5, setor) as never))
      .toMatchObject({ autorizado: true, autoridadeMovimentoLivre: { tipo: "LIDER_SETOR" } });
    expect(await checarAcessoBpmCard("card", 5, null, "editarCard", client("Líder Operacional", 5, setor) as never))
      .toMatchObject({ autorizado: false });
  });
  it("Vitor move nos pipelines operacionais e continua sem edição geral", async () => {
    const db = client();
    expect(await checarAcessoBpmCard("card", 10, null, "moverEtapa", db as never)).toMatchObject({ autorizado: true });
    expect(await checarAcessoBpmCard("card", 10, null, "editarCard", db as never)).toMatchObject({ autorizado: false });
    expect(await checarAcessoBpmCard("card", 10, null, "visualizar", db as never)).toMatchObject({ autorizado: true, autoridadeMovimentoLivre: { tipo: "LIDER_SETOR" } });
  });
  it.each([
    ["OPERACIONAL", 34, "OPERACIONAL", "ATIVO", "crm"],
    ["OPERACIONAL", 10, "FINANCEIRO", "ATIVO", "crm"],
    ["FINANCEIRO", 10, "OPERACIONAL", "ATIVO", "crm"],
    ["OPERACIONAL", 10, "OPERACIONAL", "INATIVO", "crm"],
    ["OPERACIONAL", 10, "OPERACIONAL", "ATIVO", ""],
    ["Lider Comercial", 5, "OPERACIONAL", "ATIVO", "crm"],
    ["Lider Operacional", 5, "COMERCIAL", "ATIVO", "crm"],
  ])("nega outra pessoa/setor/conta inativa/sem CRM: %s %s %s %s", async (role, id, setor, status, permissoes) => {
    expect(await checarAcessoBpmCard("card", Number(id), "Admin", "moverEtapa", client(String(role), Number(id), String(setor), String(status), String(permissoes)) as never)).toMatchObject({ autorizado: false });
  });
  it("não infere liderança de cargo, supervisão ou setor inativo", () => {
    expect(resolverAutoridadeMovimentoLivre({ id: 34, role: "OPERACIONAL" }, [{ nome: "OPERACIONAL" }])).toBeNull();
    expect(resolverAutoridadeMovimentoLivre({ id: 10, role: "OPERACIONAL" }, [{ nome: "OPERACIONAL", ativo: false }])).toBeNull();
  });
});
