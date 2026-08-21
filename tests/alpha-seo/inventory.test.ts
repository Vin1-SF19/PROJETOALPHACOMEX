import path from "node:path";
import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildAlphaSeoSourceManifest,
  OPEN_SEO_MCP_SOURCE_TOOL_NAMES,
  reconcileMcpSourceTools,
  serializeAlphaSeoManifest,
} from "@/lib/alpha-seo/inventory";

const SOURCE_ROOT = path.resolve(process.cwd(), "..", "open-seo-main");

describe("Alpha SEO source inventory", () => {
  it("freezes 46/46 unique named source registrations without synthetic tools", async () => {
    const manifest = await buildAlphaSeoSourceManifest(SOURCE_ROOT);
    expect(manifest.counts.mcpRegisteredTools).toBe(46);
    expect(manifest.mcp.reconciliation).toMatchObject({
      source: 46,
      ported: 46,
      missing: [],
      unexpected: [],
      parity: "46/46",
      status: "source-authoritative-pass",
      historicalClaim: 48,
      historicalUnnamedGap: 2,
      historicalGapBlocking: false,
    });
    const names = manifest.mcp.registeredTools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(46);
    expect(names).toEqual([...OPEN_SEO_MCP_SOURCE_TOOL_NAMES]);
    expect(names.some((name) => name.startsWith("source-symbol:"))).toBe(false);
    await Promise.all(
      manifest.mcp.registeredTools.map((tool) =>
        access(path.join(SOURCE_ROOT, tool.file)),
      ),
    );
    expect(manifest.counts.skills).toBe(9);
    expect(manifest.counts.auditIssueIds).toBe(27);
    expect(manifest.auditIssueIds).toContain("blocked-page");
    expect(manifest.auditIssueIds).toContain("deep-page");
    expect(manifest.routes.length).toBeGreaterThan(40);
    expect(
      manifest.serverFunctions.find((entry) =>
        entry.file.endsWith("keywords.ts"),
      )?.exports,
    ).toContain("researchKeywords");
  });

  it("fails named parity when one real source registration is removed", () => {
    const withoutLast = OPEN_SEO_MCP_SOURCE_TOOL_NAMES.slice(0, -1);
    expect(reconcileMcpSourceTools(withoutLast)).toMatchObject({
      source: 46,
      ported: 45,
      missing: ["get_audit_pages"],
      unexpected: [],
      parity: "45/46",
      status: "source-contract-drift",
      historicalGapBlocking: false,
    });
  });

  it("is deterministic and sanitizes the absolute source location", async () => {
    const first = serializeAlphaSeoManifest(
      await buildAlphaSeoSourceManifest(SOURCE_ROOT),
    );
    const second = serializeAlphaSeoManifest(
      await buildAlphaSeoSourceManifest(SOURCE_ROOT),
    );
    expect(first).toBe(second);
    expect(first).not.toContain(SOURCE_ROOT);
    expect(first).not.toMatch(/DATAFORSEO_API_KEY\s*[:=]\s*[^\s"']+/);
  });
});
