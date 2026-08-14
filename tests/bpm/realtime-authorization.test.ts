import { describe, expect, it } from "vitest";

import { checarAcessoRealtimeBpmPipeline } from "@/lib/bpm/ownership";

describe("autorização do canal realtime BPM", () => {
  it("permite assinatura genérica a membro CRM ativo fora do setor", async () => {
    const client = {
      usuarios: { findUnique: async () => ({ id: 7, role: "COMERCIAL", status: "ATIVO", permissoes: "crm" }) },
      setorPermissao: { findMany: async () => [] },
      usuarioPermissaoOverride: { findMany: async () => [] },
      bpmPipeline: { findUnique: async () => ({ setores: [{ setor: { nome: "OPERACIONAL" } }] }) },
      bpmCardMembro: { findFirst: async () => ({ id: "member-only" }) },
    };

    await expect(checarAcessoRealtimeBpmPipeline("pipeline-1", 7, client as never)).resolves.toBe(true);
  });

  it("revoga a assinatura ao remover o único vínculo fora do setor", async () => {
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
