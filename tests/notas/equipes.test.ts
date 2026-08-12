import { describe, expect, it } from "vitest";
import { maiorPapelNota, normalizarChaveNomeEquipe } from "@/lib/notas/equipes";
import {
  adicionarMembrosEquipeNotaSchema,
  criarEquipeNotaSchema,
  MAX_MEMBROS_EQUIPE_NOTA,
} from "@/lib/validations/notas";

describe("Equipes privadas de notas — regras puras", () => {
  it("normaliza caixa, acentos e espaços para impedir nomes equivalentes", () => {
    expect(normalizarChaveNomeEquipe("  Equípe   COMERCIAL  ")).toBe("equipe comercial");
    expect(normalizarChaveNomeEquipe("Equipe Comercial")).toBe("equipe comercial");
  });

  it("seleciona o papel mais permissivo sem depender da ordem", () => {
    expect(maiorPapelNota(["LEITOR", "ADMIN", "EDITOR"])).toBe("ADMIN");
    expect(maiorPapelNota(["EDITOR", "LEITOR", "COMENTARISTA"])).toBe("EDITOR");
    expect(maiorPapelNota([])).toBeNull();
  });

  it("aceita criação com vários membros e papéis diferentes", () => {
    const resultado = criarEquipeNotaSchema.parse({
      name: "Comercial",
      members: [
        { userId: 10, role: "LEITOR" },
        { userId: 11, role: "EDITOR" },
      ],
    });
    expect(resultado.members).toHaveLength(2);
  });

  it("rejeita o mesmo usuário duas vezes no lote", () => {
    const resultado = adicionarMembrosEquipeNotaSchema.safeParse({
      teamId: "equipe-1",
      members: [
        { userId: 10, role: "LEITOR" },
        { userId: 10, role: "ADMIN" },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita lote maior que o limite e papel adulterado", () => {
    const loteGrande = Array.from({ length: MAX_MEMBROS_EQUIPE_NOTA + 1 }, (_, index) => ({
      userId: index + 1,
      role: "LEITOR" as const,
    }));
    expect(adicionarMembrosEquipeNotaSchema.safeParse({ teamId: "equipe-1", members: loteGrande }).success).toBe(false);
    expect(
      adicionarMembrosEquipeNotaSchema.safeParse({
        teamId: "equipe-1",
        members: [{ userId: 1, role: "SUPERADMIN" }],
      }).success,
    ).toBe(false);
  });
});
