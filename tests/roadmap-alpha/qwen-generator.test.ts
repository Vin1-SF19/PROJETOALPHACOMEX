import { describe, expect, it, vi } from "vitest";

import { generateRoadmapManifest } from "@/lib/roadmap-alpha/qwen-generator";

const env = {
  BIBBLE_OLLAMA_URL: "https://qwen.internal",
  OLLAMA_API_KEY: "never-log-this-token",
  ROADMAP_QWEN_MODEL: "qwen3.8:27b",
};
const input = {
  code: "RM-2026-ABC123",
  moduleKey: "crm",
  moduleLabel: "Alpha CRM",
  title: "Melhorar cadastro de empresas",
  description:
    "Documentar uma melhoria completa no cadastro de empresas do CRM.",
  acceptanceCriteria: ["O fluxo deve ser validado por testes automatizados."],
  projectContext: "## Estrutura de arquivos (1 arquivos)\npackage.json",
};
const manifest = {
  contractVersion: 1,
  summary:
    "Plano completo para documentar e validar a melhoria solicitada no CRM.",
  phases: [
    {
      number: 0,
      slug: "entrada-ignorada",
      title: "Contexto geral",
      kind: "CONTEXT",
      agent: "context",
      dependsOn: [],
      markdown:
        "# Contexto\n\n" +
        "Detalhes do objetivo e limites conhecidos. ".repeat(4),
    },
    {
      number: 1,
      slug: "implementar",
      title: "Implementar melhoria",
      kind: "EXECUTION",
      agent: "dev",
      dependsOn: [0],
      markdown:
        "# Implementação\n\n" +
        "Implemente e valide cada critério de aceite. ".repeat(4),
    },
  ],
};

describe("generateRoadmapManifest", () => {
  it("valida o JSON e fixa o slug da fase de contexto", async () => {
    let receivedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = vi.fn(async (_input, init) => {
      receivedInit = init;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: JSON.stringify(manifest) },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200 },
      );
    });
    const result = await generateRoadmapManifest(input, { env, fetchImpl });
    expect(result.manifest.phases[0].slug).toBe("contexto-geral");
    expect(result.model).toBe("qwen3.8:27b");
    expect(result.responseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receivedInit?.headers).toMatchObject({
      Authorization: "Bearer never-log-this-token",
    });
    const request = JSON.parse(String(receivedInit?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(request.messages[0].content).toContain("AUTO_ADJUSTMENT_REQUIRED");
    expect(result.manifest.phases[0].markdown).toContain(
      "Auditoria obrigatória da forma de entrega",
    );
    expect(result.manifest.phases[1]).toMatchObject({ agent: "dev" });
    expect(result.manifest.phases[1].markdown).toContain(
      "Auditoria e autoajuste da entrega",
    );
  });

  it("preserva diagnóstico read-only para o Qwen e injeta o contrato de autoajuste", async () => {
    const readOnlyManifest = structuredClone(manifest);
    readOnlyManifest.phases[1].agent = "scout";
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: JSON.stringify(readOnlyManifest) },
                finish_reason: "stop",
              },
            ],
          }),
          { status: 200 },
        ),
    );

    const result = await generateRoadmapManifest(input, {
      env,
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(result.manifest.phases[1].agent).toBe("scout");
    expect(result.manifest.phases[1].markdown).toContain(
      "Auditoria e autoajuste da entrega",
    );
  });

  it("rejeita resposta truncada", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: JSON.stringify(manifest) },
                finish_reason: "length",
              },
            ],
          }),
          { status: 200 },
        ),
    );
    await expect(
      generateRoadmapManifest(input, {
        env,
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toThrow("TRUNCATED_MODEL_RESPONSE");
  });

  it("rejeita contrato parcial", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
          }),
          { status: 200 },
        ),
    );
    await expect(
      generateRoadmapManifest(input, {
        env,
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toThrow("PROVIDER_FAILURE");
  });
});
