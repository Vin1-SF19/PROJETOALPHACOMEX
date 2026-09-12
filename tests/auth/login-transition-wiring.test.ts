import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("integração da transição cinematográfica de login", () => {
  it("submete pela Server Action sem impedir o envio nem usar ponte global", () => {
    const form = source("src/components/loginForm.tsx");
    const scene = source("src/components/login/LoginScene.tsx");

    expect(form).toContain("action={formAction}");
    expect(form).toContain("onSubmit={beginValidation}");
    expect(form).toContain("if (state.success)");
    expect(form).toContain("void confirmAuthenticated()");
    expect(form).toContain("reportAuthFailure(state.message)");
    expect(form).not.toContain("preventDefault");
    expect(`${form}\n${scene}`).not.toContain("__alphaLoginTransition");
    expect(scene).not.toContain("window.location");
  });

  it("persiste o provider no layout e atualiza a sessão antes de navegar", () => {
    const layout = source("src/app/layout.tsx");
    const provider = source("src/components/login/LoginTransitionProvider.tsx");

    expect(layout.indexOf("<SessionProvider")).toBeLessThan(layout.indexOf("<LoginTransitionProvider>"));
    expect(layout.indexOf("<LoginTransitionProvider>")).toBeLessThan(layout.indexOf("{children}"));
    expect(provider.indexOf("await update()")).toBeLessThan(provider.indexOf('dispatch({ type: "AUTH_SUCCESS" })'));
    expect(provider).toContain('router.replace(DESTINATION)');
    expect(provider).toContain('pathname.startsWith(DESTINATION)');
    expect(provider).toContain('window.location.assign(DESTINATION)');
    expect(provider).toContain("HARD_NAVIGATION_TIMEOUT_MS");
    expect(provider).toContain("TRANSITION_LOAD_TIMEOUT_MS");
    expect(provider).toContain("TransitionErrorBoundary");
    expect(provider).toContain("onFailure={navigateWithoutTransition}");
    expect(provider).toContain("clearTransitionTimers");
    expect(provider).toContain("transitionLoadTimerRef.current = window.setTimeout");
    expect(provider).toContain("clearHardNavigationTimer();");
    expect(provider).toContain('dynamic(');
    expect(provider).toContain('import("./LoginSuccessTransition")');
  });

  it("empacota o card real antes de iniciar a travessia do navio", () => {
    const transition = source("src/components/login/LoginSuccessTransition.tsx");
    const voyage = source("src/components/login/useLoginVoyage.ts");
    const cargo = source("src/components/login/LoginCargoTransition.tsx");
    const card = source("src/components/login/LoginCard.tsx");
    const provider = source("src/components/login/LoginTransitionProvider.tsx");
    const ocean = source("src/components/login/Ocean.tsx");
    const scene = source("src/components/login/LoginScene.tsx");
    const page = source("src/app/page.tsx");

    expect(transition).toContain("routeReady");
    expect(transition).toContain("ROUTE_HANDOFF_PROGRESS");
    expect(voyage).toContain("animate(progress, ROUTE_HANDOFF_PROGRESS");
    expect(voyage.indexOf("await boarding")).toBeLessThan(voyage.indexOf("setDeparting(true)"));
    expect(transition).toContain("useMotionValue");
    expect(transition).toContain("<Image");
    expect(scene).toContain("<Image");
    expect(`${transition}\n${cargo}\n${scene}`).not.toContain("<img");
    expect(transition).toContain('import("./Ocean")');
    expect(transition).toContain("<Ocean visible />");
    expect(transition).toContain("onLoad={() => setShipReady(true)}");
    expect(cargo).toContain("Acesso autorizado");
    expect(cargo).toContain('const CONTAINER_ASSET = "/containernavio.png"');
    expect(card).toContain("data-login-cargo");
    expect(card).toContain("{children}");
    expect(card).toContain('clipPath: [');
    expect(scene).toContain('!["idle", "validating", "auth_error"].includes(phase)');
    expect(page).toContain('href="/containernavio.png"');
    expect(page).toContain('href="/NavioLogin.png"');
    expect(provider).not.toContain("cursor-wait bg-[#04070f]");
    expect(ocean).toContain("setWebglFailed(true)");
    expect(ocean).toContain("login-ocean-fallback");
  });

  it("abre as duas portas para fora, fecha e sela antes do transporte", () => {
    const cargo = source("src/components/login/LoginCargoTransition.tsx");

    expect(cargo).toContain('style={{ transformOrigin: "59% 53%" }}');
    expect(cargo).toContain("rotateY: [0, 0, -74, -74, 0, 0]");
    expect(cargo).toContain('style={{ transformOrigin: "99% 54%" }}');
    expect(cargo).toContain("rotateY: [0, 0, 74, 74, 0, 0]");
    expect(cargo).toContain("<LockKeyhole");
    expect(cargo).toContain('x: ["48vw", "0vw"]');
    expect(cargo).toContain("loading={loading}");
  });

  it("toca a buzina somente no checkpoint de partida após o carregamento", () => {
    const transition = source("src/components/login/useLoginVoyage.ts");
    const departureIndex = transition.indexOf("await boarding");
    const audioIndex = transition.indexOf('new Audio("/sounds/buzina.mp3")');

    expect(transition).toContain("if (!shipReady || !containerReady) return;");
    expect(audioIndex).toBeGreaterThan(departureIndex);
    expect(transition).toContain("audio.current.volume = 0.2");
  });

  it("reduced motion não monta oceano nem navio e conclui sem esperar asset", () => {
    const transition = source("src/components/login/LoginSuccessTransition.tsx");
    const voyage = source("src/components/login/useLoginVoyage.ts");

    expect(transition).toMatch(/\{!reducedMotion && \([\s\S]*<Ocean visible \/>[\s\S]*\)\}/);
    expect(transition).toMatch(/\{!reducedMotion && \([\s\S]*src="\/NavioLogin\.png"[\s\S]*\)\}/);
    expect(voyage).toContain("if (reducedMotion)");
    expect(voyage).toContain(", 360)");
    expect(voyage).toContain(", 160)");
    expect(transition).toContain("<LoginCargoTransition");
  });

  it("libera a sequência pelos onLoad dos assets ou pelo timeout de segurança", () => {
    const transition = source("src/components/login/LoginSuccessTransition.tsx");

    expect(transition).toContain("onLoad={() => setShipReady(true)}");
    expect(transition).toContain("onContainerLoad={() => setContainerReady(true)}");
    expect(transition).toContain("ASSET_SAFETY_TIMEOUT_MS");
    expect(transition).toContain("setShipReady(true)");
    expect(transition).toContain("setContainerReady(true)");
    expect(transition).toContain("window.clearTimeout(timeout)");
  });

  it("mantém fallback CSS em falha inicial ou perda posterior do WebGL", () => {
    const ocean = source("src/components/login/Ocean.tsx");

    expect(ocean).toContain('addEventListener("webglcontextlost", handleContextLost)');
    expect(ocean).toContain("event.preventDefault()");
    expect(ocean).toContain("setWebglFailed(true)");
    expect(ocean).toContain("failureTimer = window.setTimeout(() => setWebglFailed(true), 0)");
    expect(ocean).toContain('className="login-ocean-fallback');
    expect(ocean).toContain("renderer?.dispose()");
  });
});
