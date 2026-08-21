import { z } from "zod";
import db from "@/lib/prisma";

export const SECTION_KEYS = [
  "site_scope",
  "goals",
  "positioning",
  "audience",
  "brand_voice",
  "products_services",
  "seo_preferences",
] as const;
const authorSchema = z.enum(["USER", "SAM", "MCP"]);
const roleSchema = z.enum(["HUB", "SPOKE", "MONEY", "OTHER"]);
export const memoryUpdateSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("upsertSection"),
      key: z.string().regex(/^[a-z0-9_-]{2,60}$/),
      title: z.string().max(100).nullable().optional(),
      content: z.string().min(1).max(20_000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("deleteSection"),
      key: z.string().regex(/^[a-z0-9_-]{2,60}$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("upsertCompetitor"),
      domain: z.string().min(1).max(253),
      name: z.string().max(200).nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("deleteCompetitor"),
      domain: z.string().min(1).max(253),
    })
    .strict(),
  z
    .object({
      kind: z.literal("upsertKeyPage"),
      url: z.string().url().max(2048),
      role: roleSchema,
      topic: z.string().max(300).nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("deleteKeyPage"),
      url: z.string().url().max(2048),
    })
    .strict(),
  z
    .object({
      kind: z.literal("appendResearch"),
      summary: z.string().min(1).max(5000),
    })
    .strict(),
]);
export type MemoryUpdate = z.infer<typeof memoryUpdateSchema>;
function domain(value: string) {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    throw new Error("DOMAIN_INVALID");
  }
}
function url(value: string) {
  const parsed = new URL(value);
  parsed.hash = "";
  return parsed.toString();
}
export async function getProjectMemory(projectId: string) {
  const [sections, competitors, keyPages, researchLog] = await Promise.all([
    db.alphaSeoProjectContextSection.findMany({
      where: { projectId },
      orderBy: { key: "asc" },
    }),
    db.alphaSeoProjectCompetitor.findMany({
      where: { projectId },
      orderBy: { normalizedDomain: "asc" },
    }),
    db.alphaSeoProjectKeyPage.findMany({
      where: { projectId },
      orderBy: { normalizedUrl: "asc" },
    }),
    db.alphaSeoProjectResearchLog.findMany({
      where: {
        projectId,
        entryDate: {
          gte: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
  ]);
  return {
    sections,
    missingSections: SECTION_KEYS.filter(
      (key) => !sections.some((row) => row.key === key),
    ),
    competitors,
    keyPages,
    researchLog,
  };
}
export async function applyProjectMemoryUpdates(input: {
  projectId: string;
  userId: number;
  author: z.input<typeof authorSchema>;
  updates: MemoryUpdate[];
}) {
  const author = authorSchema.parse(input.author);
  const updates = z
    .array(memoryUpdateSchema)
    .min(1)
    .max(25)
    .parse(input.updates);
  await db.$transaction(async (tx) => {
    for (const op of updates) {
      switch (op.kind) {
        case "upsertSection":
          await tx.alphaSeoProjectContextSection.upsert({
            where: {
              projectId_key: { projectId: input.projectId, key: op.key },
            },
            create: {
              projectId: input.projectId,
              key: op.key,
              title: op.title,
              content: op.content,
              updatedByKind: author,
              updatedByUserId: input.userId,
            },
            update: {
              title: op.title,
              content: op.content,
              updatedByKind: author,
              updatedByUserId: input.userId,
            },
          });
          break;
        case "deleteSection":
          await tx.alphaSeoProjectContextSection.deleteMany({
            where: { projectId: input.projectId, key: op.key },
          });
          break;
        case "upsertCompetitor": {
          const normalizedDomain = domain(op.domain);
          await tx.alphaSeoProjectCompetitor.upsert({
            where: {
              projectId_normalizedDomain: {
                projectId: input.projectId,
                normalizedDomain,
              },
            },
            create: {
              projectId: input.projectId,
              domain: op.domain,
              normalizedDomain,
              name: op.name,
              notes: op.notes,
              updatedByKind: author,
              updatedByUserId: input.userId,
            },
            update: {
              domain: op.domain,
              name: op.name,
              notes: op.notes,
              updatedByKind: author,
              updatedByUserId: input.userId,
            },
          });
          break;
        }
        case "deleteCompetitor":
          await tx.alphaSeoProjectCompetitor.deleteMany({
            where: {
              projectId: input.projectId,
              normalizedDomain: domain(op.domain),
            },
          });
          break;
        case "upsertKeyPage": {
          const normalizedUrl = url(op.url);
          await tx.alphaSeoProjectKeyPage.upsert({
            where: {
              projectId_normalizedUrl: {
                projectId: input.projectId,
                normalizedUrl,
              },
            },
            create: {
              projectId: input.projectId,
              url: op.url,
              normalizedUrl,
              role: op.role,
              topic: op.topic,
              notes: op.notes,
              updatedByKind: author,
              updatedByUserId: input.userId,
            },
            update: {
              url: op.url,
              role: op.role,
              topic: op.topic,
              notes: op.notes,
              updatedByKind: author,
              updatedByUserId: input.userId,
            },
          });
          break;
        }
        case "deleteKeyPage":
          await tx.alphaSeoProjectKeyPage.deleteMany({
            where: { projectId: input.projectId, normalizedUrl: url(op.url) },
          });
          break;
        case "appendResearch":
          await tx.alphaSeoProjectResearchLog.create({
            data: {
              projectId: input.projectId,
              entryDate: new Date().toISOString().slice(0, 10),
              summary: op.summary,
              createdByKind: author,
              createdByUserId: input.userId,
            },
          });
          break;
      }
    }
    await tx.alphaSeoProjectResearchLog.deleteMany({
      where: {
        projectId: input.projectId,
        entryDate: {
          lt: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        },
      },
    });
  });
  return getProjectMemory(input.projectId);
}
export function renderProjectMemory(
  memory: Awaited<ReturnType<typeof getProjectMemory>>,
) {
  return [
    "# Memória do projeto",
    ...memory.sections.map((s) => `\n## ${s.title ?? s.key}\n${s.content}`),
    "\n## Concorrentes",
    ...memory.competitors.map(
      (c) => `- ${c.domain}${c.notes ? `: ${c.notes}` : ""}`,
    ),
    "\n## Páginas-chave",
    ...memory.keyPages.map((p) => `- ${p.url} — ${p.role}`),
    "\n## Pesquisa recente",
    ...memory.researchLog.map((r) => `- ${r.entryDate}: ${r.summary}`),
    `\nSeções ausentes: ${memory.missingSections.join(", ") || "nenhuma"}`,
  ].join("\n");
}
