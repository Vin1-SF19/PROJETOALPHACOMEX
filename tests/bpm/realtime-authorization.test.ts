import { describe, expect, it } from "vitest";

import { checarAcessoRealtimeBpmPipeline } from "@/lib/bpm/ownership";

describe("autorização do canal realtime BPM", () => {
  it("nega assinatura a membro CRM fora do setor autorizado", async () => {
    const client = {
      usuarios: { findUnique: async () => ({ id: 7, role: "COMERCIAL", status: "ATIVO", permissoes: "crm" }) },
      setorPermissao: { findMany: async () => [] },
      usuarioPermissaoOverride: { findMany: async () => [] },
      bpmPipeline: { findUnique: async () => ({ setores: [{ setor: { nome: "OPERACIONAL" } }] }) },
      bpmCardMembro: { findFirst: async () => ({ id: "member-only" }) },
    };

    await expect(checarAcessoRealtimeBpmPipeline("pipeline-1", 7, client as never)).resolves.toBe(false);
  });

  it.each([{ setores: [] }, { setores: ["COMERCIAL"] }])("permite assinatura com acesso ao pipeline: %j", async ({ setores }) => {
    const client = {
      usuarios: { findUnique: async () => ({ id: 7, role: "COMERCIAL", status: "ATIVO", permissoes: "crm" }) },
      setorPermissao: { findMany: async () => [] }, usuarioPermissaoOverride: { findMany: async () => [] },
      bpmPipeline: { findUnique: async () => ({ setores: setores.map((nome) => ({ setor: { nome } })) }) },
    };
    await expect(checarAcessoRealtimeBpmPipeline("pipeline-1", 7, client as never)).resolves.toBe(true);
  });

  it("nega assinatura fora do setor também sem vínculo", async () => {
    const client = {
      usuarios: { findUnique: async () => ({ id: 7, role: "COMERCIAL", status: "ATIVO", permissoes: "crm" }) },
      setorPermissao: { findMany: async () => [] },
      usuarioPermissaoOverride: { findMany: async () => [] },
      bpmPipeline: { findUnique: async () => ({ setores: [{ setor: { nome: "OPERACIONAL" } }] }) },
      bpmCardMembro: { findFirst: async () => null },
    };

    await expect(checarAcessoRealtimeBpmPipeline("pipeline-1", 7, client as never)).resolves.toBe(false);
  });
});
