import { z } from "zod";
import {
  applyProjectMemoryUpdates,
  getProjectMemory,
  memoryUpdateSchema,
  renderProjectMemory,
} from "@/lib/alpha-seo/project-memory/service";
import {
  discoverAlphaSeoSkills,
  getAlphaSeoSkill,
} from "@/lib/alpha-seo/skills/catalog";
import { fetchPublicHttpUrl } from "./safe-url";

export type SamToolContext = {
  projectId: string;
  userId: number;
  projectDomain: string | null;
  signal?: AbortSignal;
};
export const SAM_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_product_info",
      description:
        "Informações verificadas sobre o Alpha SEO e suas capacidades.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "map_links",
      description: "Mapeia links públicos de uma página do projeto.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_pages",
      description: "Lê até cinco páginas públicas autorizadas.",
      parameters: {
        type: "object",
        properties: {
          urls: { type: "array", items: { type: "string" }, maxItems: 5 },
        },
        required: ["urls"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_context",
      description: "Lê a memória normalizada do projeto atual.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project_context",
      description: "Aplica alterações tipadas na memória do projeto.",
      parameters: {
        type: "object",
        properties: {
          updates: { type: "array", items: { type: "object" }, maxItems: 25 },
        },
        required: ["updates"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "discover_skills",
      description:
        "Lista os nove workflows SEO disponíveis ou carrega as instruções integrais de uma skill pelo nome.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          skillName: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
] as const;

const linkSchema = z.object({ url: z.string().url() }).strict();
const pagesSchema = z
  .object({ urls: z.array(z.string().url()).min(1).max(5) })
  .strict();
function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("SAM tool cancelled", "AbortError");
}
async function fetchText(urlValue: string, signal?: AbortSignal) {
  throwIfAborted(signal);
  const response = await fetchPublicHttpUrl(urlValue, 200_000, signal);
  throwIfAborted(signal);
  if (response.status >= 300 && response.status < 400)
    throw new Error("REDIRECT_BLOCKED");
  if (!response.ok) throw new Error(`PAGE_${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html") && !type.includes("text/plain"))
    throw new Error("CONTENT_TYPE_BLOCKED");
  const text = (await response.text()).slice(0, 200_000);
  return { text, url: urlValue };
}
function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}
function allowedUrl(value: string, ctx: SamToolContext) {
  if (!ctx.projectDomain) return;
  const expected = new URL(
    ctx.projectDomain.includes("://")
      ? ctx.projectDomain
      : `https://${ctx.projectDomain}`,
  ).hostname.replace(/^www\./, "");
  const actual = new URL(value).hostname.replace(/^www\./, "");
  if (actual !== expected && !actual.endsWith(`.${expected}`))
    throw new Error("URL_OUTSIDE_PROJECT");
}
export async function executeSamTool(
  name: string,
  raw: unknown,
  ctx: SamToolContext,
) {
  throwIfAborted(ctx.signal);
  switch (name) {
    case "get_product_info":
      return {
        success: true,
        product: "Alpha SEO",
        capabilities: [
          "Keyword Research",
          "Rank Tracking",
          "Domain Overview",
          "Backlinks",
          "Site Audit",
          "GSC",
          "GA4",
          "AI Visibility",
          "SAM",
          "Project Memory",
          "MCP",
        ],
        note: "Dados reais dependem das integrações configuradas.",
      };
    case "map_links": {
      const { url } = linkSchema.parse(raw);
      allowedUrl(url, ctx);
      const page = await fetchText(url, ctx.signal);
      throwIfAborted(ctx.signal);
      const links = [...page.text.matchAll(/href=["']([^"'#]+)["']/gi)]
        .map((m) => new URL(m[1], page.url).toString())
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 200);
      return { success: true, links };
    }
    case "read_pages": {
      const { urls } = pagesSchema.parse(raw);
      const pages = [];
      for (const value of urls) {
        throwIfAborted(ctx.signal);
        allowedUrl(value, ctx);
        const page = await fetchText(value, ctx.signal);
        throwIfAborted(ctx.signal);
        pages.push({
          url: page.url,
          content: `<untrusted_web_content>\n${stripHtml(page.text)}\n</untrusted_web_content>`,
        });
      }
      return { success: true, pages };
    }
    case "get_project_context":
      throwIfAborted(ctx.signal);
      return {
        success: true,
        markdown: renderProjectMemory(await getProjectMemory(ctx.projectId)),
      };
    case "update_project_context": {
      const parsed = z
        .object({ updates: z.array(memoryUpdateSchema).min(1).max(25) })
        .strict()
        .parse(raw);
      throwIfAborted(ctx.signal);
      const memory = await applyProjectMemoryUpdates({
        projectId: ctx.projectId,
        userId: ctx.userId,
        author: "SAM",
        updates: parsed.updates,
      });
      throwIfAborted(ctx.signal);
      return { success: true, applied: parsed.updates.length, memory };
    }
    case "discover_skills": {
      const parsed = z
        .object({
          query: z.string().max(100).optional(),
          skillName: z.string().max(100).optional(),
        })
        .strict()
        .parse(raw);
      throwIfAborted(ctx.signal);
      return parsed.skillName
        ? { success: true, skill: getAlphaSeoSkill(parsed.skillName) }
        : { success: true, skills: discoverAlphaSeoSkills(parsed.query) };
    }
    default:
      throw new Error("UNKNOWN_TOOL");
  }
}
