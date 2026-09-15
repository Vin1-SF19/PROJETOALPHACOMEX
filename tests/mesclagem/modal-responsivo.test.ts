import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Workspace de mesclagem — responsividade", () => {
  const workspace = readFileSync(
    resolve(process.cwd(), "src/app/PainelAlpha/Mesclagem/MesclagemWorkspace.tsx"),
    "utf8",
  );

  it("é conteúdo full-page sem overlay ou semântica de diálogo", () => {
    expect(workspace).toContain('<main className="min-h-dvh overflow-x-hidden');
    expect(workspace).not.toContain("fixed inset-0");
    expect(workspace).not.toContain('role="dialog"');
    expect(workspace).not.toContain("aria-modal");
    expect(workspace).not.toContain("onOpenChange");
  });

  it("mantém ações alcançáveis e estrutura responsiva no mapeamento", () => {
    const mapping = readFileSync(
      resolve(process.cwd(), "src/app/PainelAlpha/Mesclagem/components/MappingPanel.tsx"),
      "utf8",
    );
    expect(mapping).toContain("flex min-w-0 flex-col items-stretch");
    expect(mapping).toContain("sm:flex-row sm:items-center");
    expect(mapping).toContain("w-full min-w-0 rounded-xl");
    expect(mapping).toContain("sm:w-48");
    expect(workspace).toContain('<footer className="sticky bottom-0');
    expect(workspace).toContain('aria-live="polite"');
  });

  it("expõe quatro etapas acessíveis no fluxo principal", () => {
    const stepper = readFileSync(
      resolve(process.cwd(), "src/app/PainelAlpha/Mesclagem/components/MergeStepper.tsx"),
      "utf8",
    );
    expect(stepper).toContain('aria-current={ativo ? "step" : undefined}');
    expect(stepper).toContain('titulo: "Revisão e exportação"');
  });
});
