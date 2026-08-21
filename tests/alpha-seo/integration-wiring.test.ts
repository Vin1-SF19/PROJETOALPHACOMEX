import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MODULOS_REGISTRY,
  podeVisualizarModulo,
} from "@/lib/modulos-registry";

const ROOT = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

describe("Alpha SEO module integration", () => {
  it("is registered once with the canonical route, permission and resolvable icon", async () => {
    const entries = MODULOS_REGISTRY.filter((module) => module.id === "alphaSeo");
    const commercialEntries = MODULOS_REGISTRY.filter(
      (module) => module.category === "comercial",
    );
    expect(entries).toHaveLength(1);
    expect(commercialEntries[0]?.id).toBe("alphaSeo");
    expect(entries[0]).toMatchObject({
      label: "Open SEO · Alpha SEO",
      href: "/PainelAlpha/AlphaSEO",
      permission: "alphaSeo",
      iconName: "ScanSearch",
      category: "comercial",
      aliases: expect.arrayContaining(["Open SEO", "Alpha SEO", "OpenSEO"]),
    });

    const sidebar = await source("src/components/layout/GlobalSidebar.tsx");
    expect(sidebar).toMatch(/\bScanSearch\b/);
    expect(sidebar).toContain("ICON_MAP[mod.iconName]");
    expect(sidebar).toContain("MODULOS_REGISTRY.filter");
    expect(sidebar).toContain("podeVisualizarModulo(m, { permissoes, role })");
    expect(sidebar).toContain("const adminModulos = isAdmin ?");
    expect(sidebar).toContain("...(m.aliases ?? [])");
    expect(sidebar).toContain("[m.label, m.id, m.tag, m.desc");

    const visibleModuleIds = (role: string, permissions: string[]) => {
      return MODULOS_REGISTRY.filter((module) =>
        podeVisualizarModulo(module, { permissoes: permissions, role }),
      ).map((module) => module.id);
    };
    for (const adminRole of ["Admin", "CEO", "TI", "T.I"]) {
      expect(visibleModuleIds(adminRole, [])).toContain("alphaSeo");
      expect(visibleModuleIds(adminRole, [])).toContain("gestaoOnboarding");
    }
    expect(visibleModuleIds("User", ["alphaSeo"])).toContain("alphaSeo");
    expect(visibleModuleIds("User", [])).not.toContain("alphaSeo");
    expect(visibleModuleIds("User", [])).not.toContain("gestaoOnboarding");
    expect(
      MODULOS_REGISTRY.filter((module) => module.category === "admin")
        .map((module) => module.id)
        .filter((moduleId) => visibleModuleIds("User", []).includes(moduleId)),
    ).toEqual([]);

    const normalizeSearch = (value: string) =>
      value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const searchableValues = [
      entries[0].label,
      entries[0].id,
      entries[0].tag,
      entries[0].desc,
      ...(entries[0].aliases ?? []),
    ].filter((value): value is string => Boolean(value));
    for (const query of ["Open SEO", "Alpha SEO", "OpenSEO"]) {
      expect(
        searchableValues.some((value) =>
          normalizeSearch(value).includes(normalizeSearch(query)),
        ),
      ).toBe(true);
    }
  });

  it("participates in the real global sidebar and internal-tab lifecycle from the central registry", async () => {
    const [sidebar, layout, tabBar] = await Promise.all([
      source("src/components/layout/GlobalSidebar.tsx"),
      source("src/components/layout/PainelLayoutClient.tsx"),
      source("src/components/layout/TabBar.tsx"),
    ]);

    for (const consumer of [sidebar, layout, tabBar]) {
      expect(consumer).toContain("MODULOS_REGISTRY");
    }
    expect(sidebar).toContain("[...pinnedModulos, ...unpinnedModulos].map");
    expect(sidebar).toContain("onOpenTab(mod.href, mod.label)");
    expect(layout).toContain("onOpenTab={openTab}");
    expect(layout).toContain("return [...prev, { id, url, label }]");
    expect(layout).toContain("src={tab.url}");
    expect(layout).toContain("url.startsWith(m.href + '/')");
    expect(tabBar).toMatch(/tab\.url\.startsWith\(`\$\{module\.href\}\//);
  });

  it("protects the module permission at the root and ownership at every project subtree", async () => {
    const [middleware, rootLayout, projectLayout] = await Promise.all([
      source("middleware.ts"),
      source("src/app/PainelAlpha/AlphaSEO/layout.tsx"),
      source("src/app/PainelAlpha/AlphaSEO/[projectId]/layout.tsx"),
    ]);

    expect(middleware).toContain('pathname.startsWith("/PainelAlpha")');
    expect(rootLayout).toContain("await auth()");
    expect(rootLayout).toContain('permissions.includes("alphaSeo")');
    expect(projectLayout).toContain("requireAlphaSeoProjectAccess");
    expect(projectLayout).toContain('action: "seo:read"');
  });

  it("ships every canonical project route and inherits loading/error boundaries", async () => {
    const routes = [
      "dashboard/page.tsx",
      "keywords/page.tsx",
      "saved/page.tsx",
      "rank/page.tsx",
      "rank/[trackerId]/page.tsx",
      "domain/page.tsx",
      "backlinks/page.tsx",
      "audit/page.tsx",
      "audit/[auditId]/page.tsx",
      "audit/[auditId]/performance/[resultId]/page.tsx",
      "search-performance/page.tsx",
      "brand-lookup/page.tsx",
      "prompt-explorer/page.tsx",
      "sam/page.tsx",
      "settings/page.tsx",
      "settings/context/page.tsx",
      "settings/integrations/page.tsx",
      "settings/mcp/page.tsx",
    ];

    expect(routes).toHaveLength(18);

    await Promise.all(
      routes.map((route) =>
        stat(path.join(ROOT, "src/app/PainelAlpha/AlphaSEO/[projectId]", route)),
      ),
    );
    await Promise.all([
      stat(path.join(ROOT, "src/app/PainelAlpha/AlphaSEO/loading.tsx")),
      stat(path.join(ROOT, "src/app/PainelAlpha/AlphaSEO/error.tsx")),
      stat(path.join(ROOT, "src/app/PainelAlpha/AlphaSEO/invite/page.tsx")),
    ]);
  });

  it("connects every primary screen family to real server actions or protected route handlers", async () => {
    const [
      consoleUi,
      savedUi,
      rankUi,
      gscUi,
      samUi,
      generalSettingsUi,
      memoryUi,
      googleUi,
      mcpUi,
      projectsUi,
    ] =
      await Promise.all([
        source("src/components/AlphaSEO/shared/FeatureConsole.tsx"),
        source("src/components/AlphaSEO/saved/SavedKeywordsTable.tsx"),
        source("src/components/AlphaSEO/rank/RankControls.tsx"),
        source("src/components/AlphaSEO/gsc/GscOverview.tsx"),
        source("src/components/AlphaSEO/sam/SamWorkspace.tsx"),
        source("src/components/AlphaSEO/settings/SettingsClients.tsx"),
        source("src/components/AlphaSEO/settings/MemoryWorkspace.tsx"),
        source("src/components/AlphaSEO/settings/GoogleIntegrations.tsx"),
        source("src/components/AlphaSEO/settings/McpManager.tsx"),
        source("src/components/AlphaSEO/projects/ProjectsClient.tsx"),
      ]);

    expect(consoleUi).toContain("@/actions/AlphaSeoKeywords");
    expect(consoleUi).toContain("@/actions/AlphaSeoDomain");
    expect(consoleUi).toContain("@/actions/AlphaSeoBacklinks");
    expect(consoleUi).toContain("@/actions/AlphaSeoAudit");
    expect(consoleUi).toContain("@/actions/AlphaSeoAiVisibility");
    expect(savedUi).toContain("@/actions/AlphaSeoSavedKeywords");
    expect(savedUi).toContain("@/actions/AlphaSeoExports");
    expect(rankUi).toContain("@/actions/AlphaSeoRankTracking");
    expect(gscUi).toContain("@/actions/AlphaSeoGsc");
    expect(samUi).toContain("@/actions/AlphaSeoSam");
    expect(samUi).toContain('fetch("/api/alpha-seo/sam/stream"');
    expect(generalSettingsUi).toContain("@/actions/AlphaSeoProjects");
    expect(memoryUi).toContain("@/actions/AlphaSeoProjectMemory");
    expect(googleUi).toContain("/api/alpha-seo/oauth/");
    expect(googleUi).toContain("@/actions/AlphaSeoGsc");
    expect(googleUi).toContain("@/actions/AlphaSeoGa4");
    expect(mcpUi).toContain("/api/alpha-seo/mcp/keys");
    expect(projectsUi).toContain("CriarProjetoAlphaSeo");
  });

  it("connects the completed operational surfaces", async () => {
    const [
      lighthouse,
      settingsPage,
      onboarding,
      featureRoute,
      locations,
      dashboard,
      members,
      invite,
      saved,
    ] = await Promise.all([
      source("src/components/AlphaSEO/audit/LighthouseIssuesClient.tsx"),
      source("src/components/AlphaSEO/settings/SettingsPage.tsx"),
      source("src/components/AlphaSEO/dashboard/OnboardingPanel.tsx"),
      source("src/components/AlphaSEO/shared/FeatureRoute.tsx"),
      source("src/components/AlphaSEO/rank/SerpLocationPicker.tsx"),
      source("src/components/AlphaSEO/dashboard/DashboardOverview.tsx"),
      source("src/components/AlphaSEO/settings/MembersManager.tsx"),
      source("src/components/AlphaSEO/projects/InviteAcceptClient.tsx"),
      source("src/components/AlphaSEO/saved/SavedKeywordsTable.tsx"),
    ]);

    expect(lighthouse).toContain("ObterIssuesLighthouseAlphaSeo");
    expect(lighthouse).toContain("ExportarIssuesLighthouseAlphaSeo");
    expect(settingsPage).toContain("ObterStatusChaveSeoAlphaSeo");
    expect(settingsPage).toContain("ObterStatusAcessoSamAlphaSeo");
    expect(onboarding).toContain("SalvarRespostasOnboardingAlphaSeo");
    expect(onboarding).toContain("SalvarSiteOnboardingAlphaSeo");
    expect(onboarding).toContain("Continuar no SAM");
    expect(featureRoute).toContain("ObterEstadoChatOnboardingAlphaSeo");
    expect(locations).toContain("PreaquecerLocalizacoesSerpAlphaSeo");
    expect(locations).toContain("BuscarLocalizacoesSerpAlphaSeo");
    expect(dashboard).toContain("AtualizarSnapshotBacklinksDashboardAlphaSeo");
    expect(dashboard).toContain("MarcarCompetidorDashboardAlphaSeo");
    expect(dashboard).toContain("DispensarMcpDashboardAlphaSeo");
    expect(dashboard).toContain("DispensarGa4DashboardAlphaSeo");
    expect(members).toContain("TransferirPropriedadeProjetoAlphaSeo");
    expect(members).toContain("RevogarConviteProjetoAlphaSeo");
    expect(members).toContain("result.data");
    expect(invite).toContain("AceitarConviteProjetoAlphaSeo");
    expect(saved).toContain("ListarPalavrasChaveSalvasAlphaSeo");
    expect(saved).toContain("AtualizarTagPalavrasChaveAlphaSeo");
    expect(saved).toContain("ExcluirTagPalavrasChaveAlphaSeo");
    expect(saved).toContain("includeTerms");
    expect(saved).toContain("excludeTerms");
    expect(saved).toContain("totalPages");
  });

  it("provides mobile navigation, loading geometry and a recoverable error state", async () => {
    const [shell, loading, error] = await Promise.all([
      source("src/components/AlphaSEO/AlphaSeoShell.tsx"),
      source("src/app/PainelAlpha/AlphaSEO/loading.tsx"),
      source("src/app/PainelAlpha/AlphaSEO/error.tsx"),
    ]);

    expect(shell).toContain("md:hidden");
    expect(shell).toContain('aria-label="Abrir menu"');
    expect(shell).toContain('aria-label="Fechar navegação"');
    expect(shell).toContain("overflow-y-auto");
    expect(loading).toContain("animate-pulse");
    expect(loading).toContain("motion-reduce:animate-none");
    expect(error).toContain("reset");
    expect(error).toContain("Tentar novamente");
  });

  it("registers all protected schedulers and the persistent worker", async () => {
    const [vercel, schedules, worker, oauthCleanup] = await Promise.all([
      source("vercel.json"),
      source("src/app/api/alpha-seo/cron/schedules/route.ts"),
      source("src/app/api/alpha-seo/cron/worker/route.ts"),
      source("src/app/api/alpha-seo/cron/oauth-cleanup/route.ts"),
    ]);

    expect(vercel).toContain("/api/alpha-seo/cron/schedules");
    expect(vercel).toContain("/api/alpha-seo/cron/worker");
    expect(vercel).toContain("/api/alpha-seo/cron/oauth-cleanup");
    expect(schedules).toContain("autorizarCron");
    expect(worker).toContain("autorizarCron");
    expect(oauthCleanup).toContain("autorizarCron");
    expect(schedules).toContain("enqueueDueRankRuns");
    expect(schedules).toContain("recoverStaleAudits");
    expect(worker).toContain("runPersistentAlphaSeoWorkerOnce");
  });
});
