import { describe, expect, it } from "vitest";
import { atualizarCampoSchema, excluirCampoSchema, criarCampoSchema } from "@/lib/validations/bpm";

// cuid() = exatamente 25 caracteres (usa `z.string().cuid()`)
const CUID = "cfakecuidabcdefghijklmnop";
const CUID2 = "cfakecuidqrstuvwxyz12345";
const PIPE = "cpipelinefakeabcdefghij12";

describe("schema de campos BPM (CRUD completo)", () => {
  it("permite atualizar nome, tipo, etapaId e obrigatorio", () => {
    const r = atualizarCampoSchema.safeParse({
      campoId: CUID,
      nome: "Novo nome",
      tipo: "selecao",
      etapaId: CUID2,
      obrigatorio: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tipo).toBe("selecao");
      expect(r.data.etapaId).toBe(CUID2);
    }
  });

  it("aceita campoId nulo? não — sempre string cuid", () => {
    expect(atualizarCampoSchema.safeParse({ campoId: "x" }).success).toBe(false);
  });

  it("aceita opcoes nulo (limpar opções ao trocar de tipo)", () => {
    const r = atualizarCampoSchema.safeParse({ campoId: CUID, tipo: "texto", opcoes: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.opcoes).toBeNull();
  });

  it("rejeita tipo inválido", () => {
    expect(atualizarCampoSchema.safeParse({ campoId: CUID, tipo: "email" }).success).toBe(false);
  });

  it("excluirCampoSchema exige um campoId cuid", () => {
    expect(excluirCampoSchema.safeParse({ campoId: CUID }).success).toBe(true);
    expect(excluirCampoSchema.safeParse({ campoId: "x" }).success).toBe(false);
    expect(excluirCampoSchema.safeParse({}).success).toBe(false);
  });

  it("criarCampoSchema valida array de opcoes (selecao)", () => {
    const ok = criarCampoSchema.safeParse({
      pipelineId: PIPE,
      nome: "Canal",
      tipo: "selecao",
      opcoes: ["e-mail", "telefone"],
    });
    expect(ok.success).toBe(true);

    const vazio = criarCampoSchema.safeParse({
      pipelineId: PIPE,
      nome: "Canal",
      tipo: "selecao",
      opcoes: [""],
    });
    expect(vazio.success).toBe(false);
  });
});
