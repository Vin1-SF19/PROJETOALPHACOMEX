import { z } from "zod";

export interface RoadmapRuntimeConfig {
  ollamaUrl: string;
  ollamaApiKey: string;
  model: string;
}

export type RoadmapEnvironment = Readonly<Record<string, string | undefined>>;

export type RoadmapRuntimeConfigResult =
  | { ok: true; config: RoadmapRuntimeConfig }
  | { ok: false; issues: string[] };

const roadmapRuntimeConfigSchema = z.object({
  ollamaUrl: z.string().trim().url().refine((value) => {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password;
  }, "BIBBLE_OLLAMA_URL deve ser HTTP(S) e não pode conter credenciais"),
  ollamaApiKey: z.string().trim().min(1).max(4_096),
  model: z.string().trim().min(1).max(160)
    .regex(/^qwen3\.8(?::[A-Za-z0-9._-]+)?$/, "ROADMAP_QWEN_MODEL deve ser uma tag Qwen 3.8"),
}).strict();

export function readRoadmapRuntimeConfig(env: RoadmapEnvironment = process.env): RoadmapRuntimeConfigResult {
  const parsed = roadmapRuntimeConfigSchema.safeParse({
    ollamaUrl: env.BIBBLE_OLLAMA_URL,
    ollamaApiKey: env.OLLAMA_API_KEY,
    model: env.ROADMAP_QWEN_MODEL,
  });
  if (!parsed.success) {
    return {
      ok: false,
      issues: Array.from(new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "config")))).sort(),
    };
  }
  return { ok: true, config: parsed.data };
}
