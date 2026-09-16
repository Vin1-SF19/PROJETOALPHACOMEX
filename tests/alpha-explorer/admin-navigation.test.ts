import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExplorerHeader } from "@/components/AlphaExplorer/ExplorerHeader";

describe("Alpha Explorer administrative navigation", () => {
  it("shows an enabled QNAP administration link to administrators", () => {
    const html = renderToStaticMarkup(createElement(ExplorerHeader, {
      admin: true,
      nasOnline: true,
      onOpenTour: () => undefined,
    }));

    expect(html).toContain('href="/PainelAlpha/ExploradorArquivos/AdministracaoQnap"');
    expect(html).toContain("Administração QNAP");
    expect(html).not.toContain("Permissões via CLI");
  });

  it("does not expose the administration link to regular users", () => {
    const html = renderToStaticMarkup(createElement(ExplorerHeader, {
      admin: false,
      nasOnline: true,
      onOpenTour: () => undefined,
    }));

    expect(html).not.toContain("AdministracaoQnap");
    expect(html).not.toContain("Administração QNAP");
  });
});
