import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (relativePath: string) => readFile(path.join(root, relativePath), "utf8");

describe("Alpha SEO paginated workspaces and persisted history", () => {
  it("paginates domain and backlink datasets and materializes all pages for export", async () => {
    const [domain, backlinks, exportUi] = await Promise.all([
      source("src/components/AlphaSEO/research/DomainResearchWorkspace.tsx"),
      source("src/components/AlphaSEO/research/BacklinksWorkspace.tsx"),
      source("src/components/AlphaSEO/shared/CompleteExportButtons.tsx"),
    ]);
    expect(domain).toContain("page, limit");
    expect(domain).toContain("while (hasMore");
    expect(domain).toContain("requestVersion !== version.current");
    expect(backlinks).toContain("PaginationControls");
    expect(backlinks).toContain("while (hasMore");
    expect(backlinks).toContain("requestVersion !== version.current");
    expect(exportUi).toContain("Carregando todas as páginas");
  });

  it("paginates audit issues and pages without a fixed 500-row server slice", async () => {
    const [detail, workspace] = await Promise.all([
      source("src/components/AlphaSEO/shared/DetailViews.tsx"),
      source("src/components/AlphaSEO/audit/AuditResultsWorkspace.tsx"),
    ]);
    expect(detail).not.toContain("take: 500");
    expect(detail).toContain("issuesTotal={audit._count.issues}");
    expect(workspace).toContain("ObterResultadosAuditoriaAlphaSeo");
    expect(workspace).toContain("PaginationControls");
    expect(workspace).toContain("loadAll");
  });

  it("sends an explicit audit mutation mode and resynchronizes conflicts without retrying", async () => {
    const workspace = await source("src/components/AlphaSEO/audit/AuditResultsWorkspace.tsx");
    expect(workspace).toContain('const mode = isActive ? "CANCEL" : "DELETE"');
    expect(workspace).toContain("RemoverAuditoriaAlphaSeo({projectId,auditId,mode})");
    expect(workspace).toContain('"AUDIT_CANCEL_STATE_CONFLICT"');
    expect(workspace).toContain('"AUDIT_DELETE_STATE_CONFLICT"');
    expect(workspace).toContain('"AUDIT_NOT_FOUND"');
    expect(workspace).toContain("await refreshCurrentStatus()");
    expect(workspace).toContain("setConfirmDelete(false)");
    expect(workspace.match(/await RemoverAuditoriaAlphaSeo/g)).toHaveLength(1);
  });

  it("keeps refreshed audit status stale-safe and disables concurrent actions", async () => {
    const workspace = await source("src/components/AlphaSEO/audit/AuditResultsWorkspace.tsx");
    expect(workspace).toContain("statusRequestVersion");
    expect(workspace).toContain("requestVersion !== statusRequestVersion.current");
    expect(workspace).toContain("setCurrentStatus(nextStatus)");
    expect(workspace).toContain("pending || auditBusy");
  });

  it("clears stale GSC results and reopens persisted AI answers and citations", async () => {
    const [gsc, history, route] = await Promise.all([
      source("src/components/AlphaSEO/gsc/GscOverview.tsx"),
      source("src/components/AlphaSEO/visibility/AiHistoryPanel.tsx"),
      source("src/components/AlphaSEO/shared/FeatureRoute.tsx"),
    ]);
    expect(gsc).toContain("setPerformance(null)");
    expect(gsc).toContain("performanceVersion.current");
    expect(history).toContain("Reabrir resposta de");
    expect(history).toContain("answerFrom(provider.result)");
    expect(history).toContain("citationsFrom(provider.result)");
    expect(route).toContain("result:true");
  });
});
