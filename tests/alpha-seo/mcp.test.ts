import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ALPHA_SEO_MCP_TOOL_NAMES, alphaSeoMcpTools } from "@/lib/alpha-seo/mcp/registry";
import { MCP_CHARACTER_LIMIT, mcpFailure, mcpSuccess } from "@/lib/alpha-seo/mcp/format";
import { validateAlphaSeoMcpHostAndOrigin } from "@/lib/alpha-seo/mcp/host-policy";

vi.mock("server-only", () => ({}));

afterEach(() => vi.unstubAllEnvs());

describe("Alpha SEO MCP source contract", () => {
  it("preserva exatamente 46 nomes únicos e handlers reais", () => {
    expect(ALPHA_SEO_MCP_TOOL_NAMES).toHaveLength(46);
    expect(new Set(ALPHA_SEO_MCP_TOOL_NAMES).size).toBe(46);
    expect(alphaSeoMcpTools.map((tool) => tool.name)).toEqual([...ALPHA_SEO_MCP_TOOL_NAMES]);
    expect(alphaSeoMcpTools.every((tool) => typeof tool.execute === "function")).toBe(true);
  });

  it("rejeita campos extras em todo input", () => {
    for (const tool of alphaSeoMcpTools) {
      const parsed = tool.inputSchema.safeParse({ unexpectedSecret: "nope" });
      expect(parsed.success, tool.name).toBe(false);
    }
  });

  it("rejeita limites e coordenadas fora das fronteiras antes do executor", () => {
    const schema = (name: string) =>
      alphaSeoMcpTools.find((tool) => tool.name === name)!.inputSchema;
    expect(schema("run_site_audit").safeParse({ projectId: "p", startUrl: "https://example.com", maxPages: 9 }).success).toBe(false);
    expect(schema("run_site_audit").safeParse({ projectId: "p", startUrl: "https://example.com", maxPages: 10_001 }).success).toBe(false);
    expect(schema("research_keywords").safeParse({ projectId: "p", seeds: Array.from({ length: 6 }, () => ({ seed: "seo" })) }).success).toBe(false);
    expect(schema("get_local_rank_grid").safeParse({ projectId: "p", keyword: "seo", target: "example.com", centerLatitude: 91, centerLongitude: 0 }).success).toBe(false);
    expect(schema("get_audit_pages").safeParse({ projectId: "p", auditId: "a", page: 0 }).success).toBe(false);
  });

  it("anota mutações e remoções de forma explícita", () => {
    const remove = alphaSeoMcpTools.find((tool) => tool.name === "remove_rank_tracking_keywords");
    const create = alphaSeoMcpTools.find((tool) => tool.name === "create_project");
    const whoami = alphaSeoMcpTools.find((tool) => tool.name === "whoami");
    expect(remove?.annotations.destructiveHint).toBe(true);
    expect(create?.annotations.readOnlyHint).toBe(false);
    expect(whoami?.annotations.readOnlyHint).toBe(true);
  });
});

describe("Alpha SEO MCP output boundary", () => {
  it("trunca payloads grandes e instrui paginação", () => {
    const result = mcpSuccess({ ok: true, data: Array.from({ length: 2_000 }, (_, i) => ({ i, text: "x".repeat(100) })), meta: { tool: "fixture", authKind: "test", projectId: null } });
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(text.length).toBeLessThanOrEqual(MCP_CHARACTER_LIMIT);
    expect(result.structuredContent).toMatchObject({ truncated: true });
  });

  it("não vaza mensagens internas em falhas genéricas", () => {
    const result = mcpFailure(new Error("database password super-secret"));
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(text).toContain("TOOL_EXECUTION_FAILED");
    expect(text).not.toContain("super-secret");
  });
});

describe("Alpha SEO MCP authorization wiring", () => {
  it("revalida a participação atual de credenciais fixadas em whoami/list_projects", () => {
    const source = readFileSync("src/lib/alpha-seo/mcp/tool-executor.ts", "utf8");
    expect(source).toMatch(/whoami[\s\S]*identity\.fixedProjectId[\s\S]*authorizeMcpProject/);
    expect(source).toMatch(/listProjects[\s\S]*identity\.fixedProjectId[\s\S]*authorizeMcpProject/);
  });

  it("consome rate limit de API key com compare-and-swap", () => {
    const source = readFileSync("src/lib/alpha-seo/mcp/auth.ts", "utf8");
    expect(source).toContain("consumeApiKeyRateLimit");
    expect(source).toMatch(/updateMany\([\s\S]*requestCount: current\.requestCount[\s\S]*lastRequestAt: current\.lastRequestAt/);
  });

  it("persiste e reutiliza o taskId de operações assíncronas pagas", () => {
    const source = readFileSync("src/lib/alpha-seo/mcp/tool-executor.ts", "utf8");
    expect(source).toContain('operation: "DATAFORSEO_ASYNC_MUTEX"');
    expect(source).toMatch(/saved\.taskId[\s\S]*if \(!taskId\)[\s\S]*task_post/);
    expect(source).toContain("o mesmo taskId será consultado sem novo task_post");
  });

  it("protege o catálogo externo de categorias com cache e mutex", () => {
    const source = readFileSync("src/lib/alpha-seo/mcp/tool-executor.ts", "utf8");
    expect(source).toContain('operation: "DATAFORSEO_CATEGORIES_MUTEX"');
    expect(source).toMatch(/async function categories[\s\S]*alphaSeoProviderCache\.upsert/);
  });
});

describe("Alpha SEO MCP host boundary", () => {
  it("recusa Host fora da allowlist", () => {
    const response = validateAlphaSeoMcpHostAndOrigin(new Request("https://evil.example/api", { headers: { host: "evil.example" } }));
    expect(response?.status).toBe(421);
  });

  it("aceita localhost e recusa Origin HTTP não local", () => {
    vi.stubEnv("ALPHA_SEO_MCP_ALLOWED_HOSTS", "mcp.example.com");
    expect(validateAlphaSeoMcpHostAndOrigin(new Request("http://localhost/api", { headers: { host: "localhost:3000", origin: "http://localhost:5173" } }))).toBeNull();
    const response = validateAlphaSeoMcpHostAndOrigin(new Request("https://mcp.example.com/api", { headers: { host: "mcp.example.com", origin: "http://mcp.example.com" } }));
    expect(response?.status).toBe(403);
  });
});
