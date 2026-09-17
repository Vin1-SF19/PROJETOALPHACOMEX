import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExplorerSidebar } from "@/components/AlphaExplorer/ExplorerSidebar";
import { ExplorerToolbar } from "@/components/AlphaExplorer/ExplorerToolbar";

function toolbar(admin: boolean) {
  return createElement(ExplorerToolbar, {
    crumbs: [],
    canGoUp: false,
    onGoUp: () => undefined,
    onSelectCrumb: () => undefined,
    searchInput: "",
    onSearchChange: () => undefined,
    onSearchSubmit: () => undefined,
    sort: "name",
    onSortChange: () => undefined,
    admin,
    view: "list",
    onViewChange: () => undefined,
    writeEnabled: false,
    upload: null,
    onNewFolder: () => undefined,
  });
}

describe("Alpha Explorer administrative navigation", () => {
  it("shows an enabled QNAP administration link to administrators", () => {
    const html = renderToStaticMarkup(toolbar(true));

    expect(html).toContain('href="/PainelAlpha/ExploradorArquivos/AdministracaoQnap"');
    expect(html).toContain('aria-label="Administração QNAP"');
  });

  it("does not expose the administration link to regular users", () => {
    const html = renderToStaticMarkup(toolbar(false));

    expect(html).not.toContain("AdministracaoQnap");
    expect(html).not.toContain("Administração QNAP");
  });

  it("shows only company folders in the Explorer sidebar", () => {
    const html = renderToStaticMarkup(createElement(ExplorerSidebar, {
      companyFolders: [{ name: "Financeiro", logicalPath: "financeiro" }],
      activePath: "financeiro",
      onSelectFolder: () => undefined,
      nasOnline: true,
    }));

    expect(html).toContain("Alpha Explorer");
    expect(html).toContain("Pastas da empresa");
    expect(html).toContain("Financeiro");
    expect(html).not.toContain("Meus Arquivos");
    expect(html).not.toContain("Compartilhados");
    expect(html).not.toContain("Lixeira");
  });
});
