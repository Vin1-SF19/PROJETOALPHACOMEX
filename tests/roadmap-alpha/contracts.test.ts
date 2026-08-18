import { describe, expect, it } from "vitest";

import {
  roadmapObjectiveContentSchema,
  roadmapObjectiveCreateSchema,
  roadmapObjectiveEditSchema,
  roadmapObjectiveInputSchema,
  roadmapPhaseFilename,
  roadmapPhaseManifestSchema,
} from "@/lib/roadmap-alpha/contracts";

const markdown = (title: string) =>
  `# ${title}\n\n${"Conteúdo verificável da fase. ".repeat(5)}`;

function validManifest() {
  return {
    contractVersion: 1,
    summary: "Plano completo e sequencial para atingir o objetivo informado.",
    phases: [
      {
        number: 0,
        slug: "contexto-geral",
        title: "Contexto geral",
        kind: "CONTEXT",
        agent: "context",
        dependsOn: [],
        markdown: markdown("Contexto geral"),
      },
      {
        number: 1,
        slug: "scout-descoberta",
        title: "Descoberta técnica",
        kind: "EXECUTION",
        agent: "scout",
        dependsOn: [0],
        markdown: markdown("Descoberta técnica"),
      },
    ],
  };
}

describe("contratos do Roadmap Alpha", () => {
  it("valida edição material sem permitir prioridade no contrato de conteúdo", () => {
    const content = {
      contractVersion: 1,
      moduleKey: "roadmap",
      title: "Revisar objetivo documentado",
      description:
        "Uma edição material deve criar uma nova revisão da documentação.",
      desiredOutcome: "Publicar uma nova revisão preservando o histórico.",
      acceptanceCriteria: ["A versão da fonte deve ser incrementada."],
    };
    expect(roadmapObjectiveContentSchema.parse(content).moduleKey).toBe(
      "roadmap",
    );
    expect(
      roadmapObjectiveContentSchema.safeParse({ ...content, globalPriority: 2 })
        .success,
    ).toBe(false);
  });

  it("aceita um objetivo estrito vinculado ao registry", () => {
    const parsed = roadmapObjectiveInputSchema.parse({
      contractVersion: 1,
      moduleKey: "crm",
      title: "Automatizar follow-up",
      description: "Documentar a automação de follow-up do CRM.",
      acceptanceCriteria: ["A fila processa todos os registros elegíveis."],
      globalPriority: 1,
    });
    expect(parsed.moduleKey).toBe("crm");
  });

  it("usa Claude como cérebro padrão e aceita Codex por objetivo", () => {
    const objective = {
      contractVersion: 1 as const,
      moduleKey: "crm",
      title: "Implementar automação",
      description: "Documentar e implementar a automação solicitada no CRM.",
      acceptanceCriteria: ["A implementação deve passar pelos agentes."],
      globalPriority: 1,
    };
    expect(
      roadmapObjectiveCreateSchema.parse(objective).developmentProvider,
    ).toBe("claude");
    expect(
      roadmapObjectiveCreateSchema.parse({
        ...objective,
        developmentProvider: "codex",
      }).developmentProvider,
    ).toBe("codex");
  });

  it("exige uma IA de desenvolvimento válida ao editar", () => {
    const content = {
      contractVersion: 1 as const,
      moduleKey: "crm",
      title: "Trocar cérebro de desenvolvimento",
      description:
        "Permitir que o administrador altere a IA sem regenerar os prompts.",
      acceptanceCriteria: ["A próxima fase deve usar a IA selecionada."],
    };
    expect(
      roadmapObjectiveEditSchema.parse({
        ...content,
        developmentProvider: "codex",
      }).developmentProvider,
    ).toBe("codex");
    expect(roadmapObjectiveEditSchema.safeParse(content).success).toBe(false);
  });

  it("rejeita módulo desconhecido e chaves extras", () => {
    expect(
      roadmapObjectiveInputSchema.safeParse({
        contractVersion: 1,
        moduleKey: "modulo-inventado",
        title: "Objetivo válido",
        description: "Descrição longa e suficiente para o contrato.",
        acceptanceCriteria: ["Critério verificável"],
        globalPriority: 1,
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("aceita manifesto contínuo com contexto e execução", () => {
    expect(
      roadmapPhaseManifestSchema.parse(validManifest()).phases,
    ).toHaveLength(2);
  });

  it("rejeita sequência descontínua e dependência futura", () => {
    const manifest = validManifest();
    manifest.phases[1].number = 2;
    manifest.phases[1].dependsOn = [2];
    expect(roadmapPhaseManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejeita slug com tentativa de path traversal", () => {
    const manifest = validManifest();
    manifest.phases[1].slug = "../segredo";
    expect(roadmapPhaseManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("gera filename internamente com numeração de dois dígitos", () => {
    expect(roadmapPhaseFilename({ number: 1, slug: "scout-descoberta" })).toBe(
      "01-scout-descoberta.md",
    );
  });
});
