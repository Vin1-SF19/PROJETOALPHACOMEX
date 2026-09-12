import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("preview local da transição de login", () => {
  it("fica indisponível fora do ambiente de desenvolvimento", () => {
    const page = source("src/app/dev/login-transition-preview/page.tsx");

    expect(page).toContain('process.env.NODE_ENV !== "development"');
    expect(page).toContain("notFound()");
    expect(page).toContain("robots: { index: false, follow: false }");
  });

  it("reutiliza o mar e a transição reais sem autenticar ou navegar", () => {
    const preview = source("src/components/login/LoginTransitionPreview.tsx");

    expect(preview).toContain("<Ocean visible />");
    expect(preview).toContain("<LoginSuccessTransition");
    expect(preview).toContain("<LoginCard");
    expect(preview).toContain("<LoginForm />");
    expect(preview).not.toContain("loginAction");
    expect(preview).not.toContain("router.");
    expect(preview).not.toContain("window.location");
  });

  it("oferece mar contínuo, replay manual e loop automático", () => {
    const preview = source("src/components/login/LoginTransitionPreview.tsx");

    expect(preview).toContain("Mar contínuo");
    expect(preview).toContain("Transição completa");
    expect(preview).toContain("REPLAY_DELAY_MS");
    expect(preview).toContain("setCycle((current) => current + 1)");
    expect(preview).toContain('event.key.toLowerCase() === "r"');
    expect(preview).toContain("Loop {autoReplay ?");
  });
});
