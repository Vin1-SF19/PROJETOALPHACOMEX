import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { criarCondicaoAcessoPorEquipe } from "@/lib/notas/acesso";

describe("Equipes privadas de notas — integração de acesso", () => {
  it("filtra compartilhamentos apenas por equipe do dono ou membro autenticado", () => {
    expect(criarCondicaoAcessoPorEquipe(42)).toEqual({
      teamShares: {
        some: {
          team: {
            OR: [{ ownerId: 42 }, { members: { some: { userId: 42 } } }],
          },
        },
      },
    });
  });

  it("mantém equipe como relação real e não amplia NotePermission com subject string", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const validacoes = readFileSync(resolve(process.cwd(), "src/lib/validations/notas.ts"), "utf8");
    expect(schema).toContain("model NoteTeamShare");
    expect(schema).toContain("note      Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)");
    expect(schema).toContain("team      NoteTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)");
    expect(validacoes).toContain('["USUARIO", "SETOR", "ROLE"]');
    expect(validacoes).not.toContain('["USUARIO", "SETOR", "ROLE", "EQUIPE"]');
  });

  it("protege todas as mutações de gestão por ownership no servidor", () => {
    const actions = readFileSync(resolve(process.cwd(), "src/actions/NotasEquipes.ts"), "utf8");
    expect(actions.match(/equipeDoDono\(/g)?.length).toBeGreaterThanOrEqual(5);
    expect(actions).toContain("Somente o criador pode adicionar membros");
    expect(actions).toContain("Somente o criador pode alterar funções");
    expect(actions).toContain("Somente o criador pode excluir a equipe");
  });

  it("exibe o gerenciador somente dentro da visualização Notas de equipe", () => {
    const header = readFileSync(
      resolve(process.cwd(), "src/components/Notas/Central/CentralNotasHeader.tsx"),
      "utf8",
    );
    const lista = readFileSync(
      resolve(process.cwd(), "src/components/Notas/Central/ListaNotas.tsx"),
      "utf8",
    );
    const central = readFileSync(
      resolve(process.cwd(), "src/components/Notas/Central/CentralDeNotas.tsx"),
      "utf8",
    );

    expect(header).not.toContain("Gerenciar equipes");
    expect(lista).toContain("{isEquipe && (");
    expect(lista).toContain("Gerenciar equipes");
    expect(central).toContain('isEquipe={secaoAtiva === "EQUIPE"}');
  });
});
