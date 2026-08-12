import { describe, expect, it } from "vitest";
import { criarFiltroAcessoNota, criarFiltroExclusaoLixeira } from "@/lib/notas/acesso";
import { atualizarPreviewNaLista } from "@/lib/notas/preview";
import { excluirNotasDefinitivamenteSchema } from "@/lib/validations/notas";
import { isNotasWorkspaceAtualizadoMessage, NOTAS_WORKSPACE_ATUALIZADO } from "@/lib/notas-workspace-messages";

describe("Bloco de notas ALpha — isolamento por usuário", () => {
  it("não cria bypass para Admin e limita a dono ou compartilhamento explícito", () => {
    const filtro = criarFiltroAcessoNota({ id: 42, role: "Admin" });

    expect(filtro).toEqual({
      OR: [
        { ownerId: 42 },
        { permissions: { some: { subjectType: "USUARIO", subjectId: "42" } } },
        { permissions: { some: { subjectType: "SETOR", subjectId: "Admin" } } },
        { permissions: { some: { subjectType: "ROLE", subjectId: "Admin" } } },
      ],
    });
  });

  it("restringe exclusão permanente ao dono autenticado e à lixeira", () => {
    expect(criarFiltroExclusaoLixeira(42, ["nota-propria", "nota-alheia"])).toEqual({
      ownerId: 42,
      status: "LIXEIRA",
      id: { in: ["nota-propria", "nota-alheia"] },
    });
  });
});

describe("Bloco de notas ALpha — seleção da lixeira", () => {
  it("rejeita seleção vazia", () => {
    expect(excluirNotasDefinitivamenteSchema.safeParse({ noteIds: [] }).success).toBe(false);
  });

  it("remove IDs duplicados antes da exclusão", () => {
    const resultado = excluirNotasDefinitivamenteSchema.parse({ noteIds: ["n1", "n1", "n2"] });
    expect(resultado.noteIds).toEqual(["n1", "n2"]);
  });

  it("rejeita lotes acima do limite", () => {
    const noteIds = Array.from({ length: 101 }, (_, index) => `n${index}`);
    expect(excluirNotasDefinitivamenteSchema.safeParse({ noteIds }).success).toBe(false);
  });
});

describe("Bloco de notas ALpha — preview em tempo real", () => {
  it("atualiza somente o card editado", () => {
    const data = new Date("2026-08-11T12:00:00.000Z");
    const notas = [
      { id: "n1", title: "Antes", plainText: "Texto antigo", updatedAt: "2026-01-01" },
      { id: "n2", title: "Intacta", plainText: "Sem mudança", updatedAt: "2026-01-02" },
    ];

    const atualizadas = atualizarPreviewNaLista(
      notas,
      { noteId: "n1", title: "Agora", plainText: "Texto novo" },
      data,
    );

    expect(atualizadas[0]).toEqual({ id: "n1", title: "Agora", plainText: "Texto novo", updatedAt: data });
    expect(atualizadas[1]).toBe(notas[1]);
  });
});

describe("Bloco de notas ALpha — integração com o shell", () => {
  it("aceita somente a mensagem exata de atualização do workspace", () => {
    expect(isNotasWorkspaceAtualizadoMessage({ type: NOTAS_WORKSPACE_ATUALIZADO })).toBe(true);
    expect(isNotasWorkspaceAtualizadoMessage({ type: "mensagem-forjada" })).toBe(false);
    expect(isNotasWorkspaceAtualizadoMessage(null)).toBe(false);
  });
});
