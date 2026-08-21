import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import db from "@/lib/prisma";

export const AI_PROVIDERS = [
  "CHATGPT",
  "CLAUDE",
  "GEMINI",
  "PERPLEXITY",
] as const;
export const aiVisibilityInputSchema = z
  .object({
    projectId: z.string().min(1),
    kind: z.enum(["BRAND_LOOKUP", "PROMPT_EXPLORER"]),
    query: z.string().min(2).max(4000),
    brand: z.string().min(1).max(200).optional(),
    domain: z.string().trim().max(255).optional(),
    country: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional(),
    competitors: z.array(z.string().min(1).max(200)).max(20).default([]),
    webSearch: z.boolean().default(true),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();
const MODELS: Record<(typeof AI_PROVIDERS)[number], string> = {
  CHATGPT:
    process.env.ALPHA_SEO_OPENROUTER_CHATGPT_MODEL ?? "openai/gpt-4.1-mini",
  CLAUDE:
    process.env.ALPHA_SEO_OPENROUTER_CLAUDE_MODEL ??
    "anthropic/claude-3.7-sonnet",
  GEMINI:
    process.env.ALPHA_SEO_OPENROUTER_GEMINI_MODEL ?? "google/gemini-2.5-flash",
  PERPLEXITY:
    process.env.ALPHA_SEO_OPENROUTER_PERPLEXITY_MODEL ?? "perplexity/sonar",
};
export function aiRequestHash(input: z.input<typeof aiVisibilityInputSchema>) {
  const d = aiVisibilityInputSchema.parse(input);
  return createHash("sha256")
    .update(
      JSON.stringify({
        kind: d.kind,
        query: d.query,
        brand: d.brand ?? null,
        domain: d.domain ?? null,
        country: d.country ?? null,
        competitors: [...d.competitors].sort(),
        webSearch: d.webSearch,
      }),
    )
    .digest("hex");
}
type Fetcher = typeof fetch;
export function summarizeProviderStatuses(
  statuses: readonly ("fulfilled" | "rejected")[],
): "COMPLETED" | "PARTIAL" | "FAILED" {
  const fulfilled = statuses.filter((status) => status === "fulfilled").length;
  return fulfilled === statuses.length
    ? "COMPLETED"
    : fulfilled > 0
      ? "PARTIAL"
      : "FAILED";
}
const responseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.union([
                  z.string(),
                  z.array(
                    z
                      .object({ type: z.string(), text: z.string().optional() })
                      .passthrough(),
                  ),
                ]),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        cost: z.number().optional(),
      })
      .passthrough()
      .optional(),
    citations: z.array(z.string().url()).optional(),
  })
  .passthrough();
function contentOf(value: z.infer<typeof responseSchema>) {
  const content = value.choices[0].message.content;
  return typeof content === "string"
    ? content
    : content.map((part) => part.text ?? "").join("");
}
export async function callOpenRouterProvider(
  provider: (typeof AI_PROVIDERS)[number],
  input: {
    kind: "BRAND_LOOKUP" | "PROMPT_EXPLORER";
    query: string;
    brand?: string;
    domain?: string;
    country?: string;
    competitors: string[];
    webSearch: boolean;
  },
  fetcher: Fetcher = fetch,
) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY_NOT_CONFIGURED");
  const started = Date.now();
  const system =
    input.kind === "BRAND_LOOKUP"
      ? `Analise visibilidade de marca em respostas de IA${input.domain ? ` para o domínio ${input.domain}` : ""}${input.country ? ` no país ${input.country}` : ""}. Compare menções, posição, sentimento, share of voice e fontes. Responda em JSON válido com summary, mentions, shareOfVoice e citations.`
      : `Responda ao prompt como um mecanismo de resposta de IA${input.country ? ` considerando o país ${input.country}` : ""}. Separe resposta, entidades citadas e URLs de fontes. Não invente citações.`;
  const response = await fetcher(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "x-title": "Painel Alpha SEO",
      },
      body: JSON.stringify({
        model: MODELS[provider],
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(input) },
        ],
        temperature: 0.2,
        max_tokens: 1800,
        ...(input.webSearch
          ? { plugins: [{ id: "web", max_results: 5 }] }
          : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!response.ok)
    throw new Error(`OPENROUTER_${provider}_${response.status}`);
  const parsed = responseSchema.parse(await response.json());
  return {
    provider,
    model: MODELS[provider],
    answer: contentOf(parsed),
    citations: parsed.citations ?? [],
    durationMs: Date.now() - started,
    actualMicrosUsd: Math.max(
      0,
      Math.round((parsed.usage?.cost ?? 0) * 1_000_000),
    ),
  };
}
export async function executeAiVisibility(input: {
  userId: number;
  data: z.input<typeof aiVisibilityInputSchema>;
  fetcher?: Fetcher;
}) {
  const data = aiVisibilityInputSchema.parse(input.data);
  const requestHash = aiRequestHash(data);
  const approval = await db.alphaSeoCostApproval.findFirst({
    where: {
      projectId: data.projectId,
      userId: input.userId,
      operation: `AI_VISIBILITY_${data.kind}`,
      requestHash,
      expiresAt: { gt: new Date() },
    },
  });
  if (!approval) throw new Error("COST_APPROVAL_REQUIRED");
  const existing = await db.alphaSeoAiVisibilityRun.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
    include: { providerResults: true },
  });
  if (existing) {
    if (
      existing.projectId !== data.projectId ||
      existing.requestedById !== input.userId
    )
      throw new Error("IDEMPOTENCY_KEY_CONFLICT");
    return existing;
  }
  const run = await db.alphaSeoAiVisibilityRun.create({
    data: {
      projectId: data.projectId,
      requestedById: input.userId,
      kind: data.kind,
      query: data.query,
      requestHash,
      idempotencyKey: data.idempotencyKey,
      estimatedMicrosUsd: approval.estimatedMicrosUsd,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });
  const settled = await Promise.allSettled(
    AI_PROVIDERS.map((provider) =>
      callOpenRouterProvider(provider, data, input.fetcher),
    ),
  );
  let actual = 0;
  for (let i = 0; i < settled.length; i++) {
    const provider = AI_PROVIDERS[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      actual += result.value.actualMicrosUsd;
      await db.alphaSeoAiVisibilityProviderResult.create({
        data: {
          runId: run.id,
          provider,
          status: "COMPLETED",
          result: result.value,
          actualMicrosUsd: result.value.actualMicrosUsd,
          durationMs: result.value.durationMs,
        },
      });
    } else {
      await db.alphaSeoAiVisibilityProviderResult.create({
        data: {
          runId: run.id,
          provider,
          status: "FAILED",
          errorCode:
            result.reason instanceof Error
              ? result.reason.message.slice(0, 120)
              : "PROVIDER_FAILED",
        },
      });
    }
  }
  const finalStatus = summarizeProviderStatuses(
    settled.map((result) => result.status),
  );
  await db.alphaSeoAiVisibilityRun.update({
    where: { id: run.id },
    data: {
      status: finalStatus,
      actualMicrosUsd: actual,
      completedAt: new Date(),
    },
  });
  return db.alphaSeoAiVisibilityRun.findUniqueOrThrow({
    where: { id: run.id },
    include: { providerResults: true },
  });
}
export function newAiVisibilityIdempotencyKey() {
  return randomUUID();
}
