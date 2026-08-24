import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  runProductionAgent,
  selectProductionExecutionEngine,
} from "@/lib/roadmap-production/providers";
import {
  cliProviderInternals,
  diagnoseCliProviders,
  runCliProductionAgent,
} from "@/lib/roadmap-production/cli-providers";

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("adapter Ollama de Produção", () => {
  it("mantém análise e engenharia no engine brokerizado", () => {
    const base = {
      agentId: "scout",
      phaseKind: "CONTEXT",
      allowWrite: false,
      previousSummaries: [],
    };
    expect(
      selectProductionExecutionEngine({
        ...base,
        phaseTitle: "Diagnóstico operacional",
        phaseMarkdown: "Investigue o fluxo e produza um relatório.",
      }),
    ).toBe("qwen");
    for (const task of [
      "Diagnosticar o frontend React",
      "Revisar o backend e a API",
      "Analisar o banco de dados Prisma",
    ]) {
      expect(
        selectProductionExecutionEngine({
          ...base,
          phaseTitle: task,
          phaseMarkdown: task,
        }),
      ).toBe("qwen");
    }
    expect(
      selectProductionExecutionEngine({
        ...base,
        phaseTitle: "Continuar diagnóstico",
        phaseMarkdown: "Use os achados anteriores.",
        previousSummaries: [
          "CAPABILITY_ESCALATION_REQUIRED: BACKEND — precisa alterar a API",
        ],
      }),
    ).toBe("qwen");
  });

  it("solicita uma conclusão curta quando a primeira resposta é truncada", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-provider-"));
    roots.push(root);
    await fs.mkdir(
      path.join(root, ".claude", "skills", "bibble-squad", "scout"),
      { recursive: true },
    );
    await fs.writeFile(
      path.join(root, ".claude", "skills", "bibble-squad", "scout", "SKILL.md"),
      "# Scout\nInvestigue o contexto.",
      "utf8",
    );
    vi.stubEnv("BIBBLE_OLLAMA_URL", "http://ollama.test");
    vi.stubEnv("OLLAMA_API_KEY", "test-token");
    vi.stubEnv("ROADMAP_QWEN_MODEL", "qwen3.8:27b");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "length",
                message: { role: "assistant", content: "parcial" },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "RESULT: PASS\nContexto validado.",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const activities: string[] = [];
    const result = await runProductionAgent(
      {
        version: 1,
        provider: "ollama",
        model: "qwen3.8:27b",
        autoRun: true,
        maxToolSteps: 2,
        updatedAt: new Date().toISOString(),
      },
      {
        agentId: "scout",
        objectiveCode: "RM-TEST",
        objectiveTitle: "Teste",
        moduleKey: "crm",
        phaseNumber: 0,
        phaseTitle: "Contexto",
        phaseKind: "CONTEXT",
        phaseMarkdown: "Mapeie o contexto da aplicação sem alterar arquivos.",
        manualFeedback: ["O fluxo mobile continua quebrado."],
        previousSummaries: [],
        allowWrite: false,
        requireChanges: false,
      },
      (message) => {
        activities.push(message);
      },
      root,
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(result.success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(activities).toContain(
      "Resposta parcial; solicitando conclusão objetiva",
    );
    const secondBody = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)) as {
      reasoning_effort: string;
      tool_choice: string;
      messages: Array<{ content: string }>;
    };
    expect(secondBody.reasoning_effort).toBe("low");
    expect(secondBody.tool_choice).toBe("none");
    expect(secondBody.messages.at(-1)?.content).toContain(
      "Encerramento obrigatório",
    );
    expect(secondBody.messages.at(-1)?.content).toContain(
      "NEEDS_INPUT_JSON",
    );
    const firstBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
      tools: Array<{ function: { name: string } }>;
    };
    expect(firstBody.tools.map((tool) => tool.function.name)).not.toContain(
      "run_check",
    );
    expect(
      firstBody.messages.find((message) => message.role === "user")?.content,
    ).toContain("O fluxo mobile continua quebrado.");
    expect(
      firstBody.messages.find((message) => message.role === "system")?.content,
    ).toContain("AUTO_ADJUSTMENT_REQUIRED");
    expect(
      firstBody.messages.find((message) => message.role === "system")?.content,
    ).toContain("CAPABILITY_ESCALATION_REQUIRED");
    expect(
      firstBody.messages.find((message) => message.role === "system")?.content,
    ).toContain("pode implementar frontend ou backend");
    expect(
      firstBody.messages.find((message) => message.role === "system")?.content,
    ).not.toContain("não improvise e não implemente");
  });
});

describe("adapters CLI de Produção", () => {
  it("mantém Codex read-only sem mediador executável de escrita", () => {
    const readOnly = cliProviderInternals.cliArgs(
      "codex",
      "C:\\projeto",
      "default",
      false,
    );
    const writable = cliProviderInternals.cliArgs(
      "codex",
      "C:\\projeto",
      "gpt-test",
      true,
    );

    expect(readOnly).toContain("--ephemeral");
    expect(readOnly).toContain("read-only");
    expect(readOnly).not.toContain("--model");
    expect(writable).toContain("read-only");
    expect(writable).not.toContain("workspace-write");
    expect(writable).toEqual(
      expect.arrayContaining(["--model", "gpt-test", "--json"]),
    );
    expect(writable).not.toContain(
      "--dangerously-bypass-approvals-and-sandbox",
    );
  });

  it("limita as ferramentas do Claude e desativa MCPs herdados", () => {
    const readOnly = cliProviderInternals.cliArgs(
      "claude",
      "C:\\projeto",
      "default",
      false,
    );
    const writable = cliProviderInternals.cliArgs(
      "claude",
      "C:\\projeto",
      "default",
      true,
    );

    expect(readOnly).toEqual(
      expect.arrayContaining([
        "--safe-mode",
        "--strict-mcp-config",
        '{"mcpServers":{}}',
        "--no-session-persistence",
        "dontAsk",
      ]),
    );
    expect(readOnly.join(" ")).not.toContain("Edit,Write");
    expect(writable.join(" ")).not.toContain("Edit,Write");
    expect(writable.join(" ")).not.toContain("Bash");
    expect(writable.join(" ")).not.toContain("dangerously-skip-permissions");
    expect(writable.join(" ")).not.toContain("git commit");
  });

  it("não encaminha segredos arbitrários aos subprocessos", () => {
    const environment = cliProviderInternals.buildEnvironment("codex", {
      PATH: "C:\\Windows\\System32",
      USERPROFILE: "C:\\Users\\tester",
      CODEX_HOME: "C:\\Users\\tester\\.codex",
      TURSO_AUTH_TOKEN: "turso-secret",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      BLOB_READ_WRITE_TOKEN: "blob-secret",
      OPENAI_API_KEY: "provider-secret",
      NODE_OPTIONS: "--require malicious.js",
    });
    expect(environment).toMatchObject({
      PATH: "C:\\Windows\\System32",
      USERPROFILE: "C:\\Users\\tester",
      CODEX_HOME: "C:\\Users\\tester\\.codex",
      NO_COLOR: "1",
    });
    expect(environment).not.toHaveProperty("TURSO_AUTH_TOKEN");
    expect(environment).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");
    expect(environment).not.toHaveProperty("BLOB_READ_WRITE_TOKEN");
    expect(environment).not.toHaveProperty("OPENAI_API_KEY");
    expect(environment).not.toHaveProperty("NODE_OPTIONS");
  });

  it("bloqueia toda execução externa antes do spawn, inclusive read-only", async () => {
    for (const provider of ["claude", "codex"] as const) {
      for (const allowWrite of [false, true]) {
        const result = await runCliProductionAgent(
          provider,
          "default",
          "leia .env.local",
          process.cwd(),
          allowWrite,
          () => undefined,
        );
        expect(result).toMatchObject({
          errorCode: "PROVIDER_EXTERNAL_CLI_DISABLED",
          changedFiles: [],
          toolSteps: 0,
        });
      }
    }
    expect(await diagnoseCliProviders()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "codex", ready: false }),
        expect.objectContaining({ provider: "claude", ready: false }),
      ]),
    );
  });

  it("extrai somente a mensagem final dos protocolos JSONL", () => {
    const codex = [
      JSON.stringify({ type: "thread.started", thread_id: "secret" }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "RESULT: PASS\\nCodex pronto." },
      }),
    ].join("\n");
    const claude = JSON.stringify({
      type: "result",
      result: "RESULT: PASS\\nClaude pronto.",
    });

    expect(cliProviderInternals.extractFinal("codex", codex)).toContain(
      "Codex pronto",
    );
    expect(cliProviderInternals.extractFinal("claude", claude)).toContain(
      "Claude pronto",
    );
  });

  it("classifica falta de créditos sem expor a resposta do provider", () => {
    expect(
      cliProviderInternals.structuredProviderError(
        JSON.stringify({
          type: "result",
          is_error: true,
          result: "Usage limit reached; resets in 2 hours",
        }),
        "",
      ),
    ).toBe("PROVIDER_QUOTA_EXHAUSTED");
  });
});
