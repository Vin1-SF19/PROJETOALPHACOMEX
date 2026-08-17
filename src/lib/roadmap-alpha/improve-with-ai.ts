import { z } from "zod";

import { getOllamaHeaders } from "@/lib/bibble/client";
import { readRoadmapRuntimeConfig } from "@/lib/roadmap-alpha/runtime-config";

export const roadmapImproveFieldSchema = z.enum([
  "title",
  "description",
  "desiredOutcome",
  "constraints",
  "acceptanceCriteria",
  "implementationFeedback",
]);
export type RoadmapImproveField = z.infer<typeof roadmapImproveFieldSchema>;

const FIELD_GUIDANCE: Record<RoadmapImproveField, string> = {
  title:
    "Reescreva como um título objetivo, específico e acionável, em uma única linha.",
  description:
    "Amplie o contexto, explicando problema, usuários afetados, comportamento atual e escopo desejado.",
  desiredOutcome:
    "Descreva um resultado observável e verificável, com impacto esperado e definição clara de sucesso.",
  constraints:
    "Organize as restrições técnicas, de segurança, compatibilidade e operação sem inventar decisões não informadas.",
  acceptanceCriteria:
    "Transforme em critérios de aceite testáveis, um por linha, sem marcadores ou numeração.",
  implementationFeedback:
    "Reescreva como um relato de erro claro e acionável: explique o que ficou ruim, o comportamento esperado e o que precisa ser corrigido. Preserve integralmente a intenção e não invente fatos.",
};

const completionSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z.object({ content: z.string().nullable() }).passthrough(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

function cleanCompletion(value: string): string {
  return value
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export async function improveRoadmapField(
  field: RoadmapImproveField,
  value: string,
  context: {
    title?: string;
    description?: string;
    desiredOutcome?: string;
  } = {},
  dependencies: { fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const runtime = readRoadmapRuntimeConfig();
  if (!runtime.ok) throw new Error("INVALID_PROVIDER_CONFIG");
  const source = value.trim();
  const supportingContext = Object.entries(context)
    .filter(([, content]) => content?.trim())
    .map(([key, content]) => `${key}: ${content?.trim()}`)
    .join("\n");
  if (!source && !supportingContext)
    throw new Error("IMPROVEMENT_CONTEXT_REQUIRED");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await (dependencies.fetchImpl ?? fetch)(
      `${runtime.config.ollamaUrl.replace(/\/+$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: getOllamaHeaders(
          { "Content-Type": "application/json", Accept: "application/json" },
          runtime.config.ollamaApiKey,
        ),
        signal: controller.signal,
        body: JSON.stringify({
          model: runtime.config.model,
          stream: false,
          temperature: 0.25,
          max_tokens: 1_500,
          reasoning_effort: "low",
          messages: [
            {
              role: "system",
              content:
                "Você melhora campos de objetivos de software do Painel Alpha. Preserve a intenção, acrescente clareza e detalhes úteis, não invente fatos, credenciais, prazos ou tecnologias. Responda somente com o texto final do campo, sem explicações, títulos ou cercas Markdown.",
            },
            {
              role: "user",
              content: `${FIELD_GUIDANCE[field]}\n\nTexto atual:\n${source || "(campo ainda vazio)"}\n\nContexto relacionado:\n${supportingContext || "(não informado)"}`,
            },
          ],
        }),
      },
    );
    if (!response.ok)
      throw new Error(
        response.status === 401 || response.status === 403
          ? "PROVIDER_AUTH_FAILED"
          : "PROVIDER_HTTP_ERROR",
      );
    const parsed = completionSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("INVALID_PROVIDER_RESPONSE");
    const improved = cleanCompletion(
      parsed.data.choices[0].message.content ?? "",
    );
    if (!improved) throw new Error("EMPTY_PROVIDER_RESPONSE");
    return improved.slice(
      0,
      field === "title"
        ? 180
        : ["desiredOutcome", "implementationFeedback"].includes(field)
          ? 4_000
          : field === "description"
            ? 10_000
            : 8_000,
    );
  } finally {
    clearTimeout(timeout);
  }
}
