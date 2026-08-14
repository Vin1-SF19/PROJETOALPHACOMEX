import { describe, expect, it } from "vitest";

import { checarAcessoRealtimeBpmPipeline } from "@/lib/bpm/ownership";

describe("autorização do canal realtime BPM", () => {
  it("nega assinatura a quem é membro de um único card, mas não pertence ao setor", async () => {
    const client = {
      usuarios: { findUnique: async () => ({ id: 7, role: "COMERCIAL", status: "ATIVO", permissoes: "crm" }) },
      setorPermissao: { findMany: async () => [] },
      usuarioPermissaoOverride: { findMany: async () => [] },
      bpmPipeline: { findUnique: async () => ({ setores: [{ setor: { nome: "OPERACIONAL" } }] }) },
      bpmCardMembro: { findFirst: async () => ({ id: "member-only" }) },
    };

    await expect(checarAcessoRealtimeBpmPipeline("pipeline-1", 7, client as never)).resolves.toBe(false);
  });
});
