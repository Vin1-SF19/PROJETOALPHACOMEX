"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { useRecuperacaoSessao } from "@/components/auth/SessaoResilienteProvider";
import dynamic from "next/dynamic";
import { Component, createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useMotionValue } from "framer-motion";

import { loginTransitionIsBlocking, reduceLoginTransition, type LoginTransitionPhase } from "./login-transition-state";
import { useReducedMotion } from "./useReducedMotion";
import { LoginPageTow } from "./LoginPageTow";

const loadLoginSuccessTransition = () =>
  import("./LoginSuccessTransition").then((module) => module.LoginSuccessTransition);
const LoginSuccessTransition = dynamic(loadLoginSuccessTransition, { ssr: false });

interface LoginTransitionContextValue {
  phase: LoginTransitionPhase;
  isBlocking: boolean;
  visualReady: boolean;
  failureMessage: string | null;
  beginValidation: () => void;
  reportAuthFailure: (message: string) => void;
  confirmAuthenticated: () => Promise<void>;
}

interface LoginTransitionProviderProps {
  children: ReactNode;
}

interface TransitionErrorBoundaryProps {
  children: ReactNode;
  onFailure: () => void;
}

class TransitionErrorBoundary extends Component<
  TransitionErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const LoginTransitionContext = createContext<LoginTransitionContextValue | null>(null);
const DESTINATION = "/PainelAlpha";
const HARD_NAVIGATION_TIMEOUT_MS = 8_000;
const TRANSITION_LOAD_TIMEOUT_MS = 5_000;
const SESSION_CONFIRMATION_TIMEOUT_MS = 8_500;

export function LoginTransitionProvider({ children }: LoginTransitionProviderProps) {
  const [phase, dispatch] = useReducer(reduceLoginTransition, "idle");
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [visualReady, setVisualReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { update } = useSession();
  const { iniciarConfirmacao } = useRecuperacaoSessao();
  const reducedMotion = useReducedMotion();
  const voyage = useMotionValue(0);
  const authenticationHandledRef = useRef(false);
  const navigationStartedRef = useRef(false);
  const hardNavigationTimerRef = useRef<number | null>(null);
  const transitionLoadTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const confirmationTimerRef = useRef<number | null>(null);
  const confirmationGenerationRef = useRef(0);

  const clearHardNavigationTimer = useCallback(() => {
    if (!hardNavigationTimerRef.current) return;
    window.clearTimeout(hardNavigationTimerRef.current);
    hardNavigationTimerRef.current = null;
  }, []);

  const clearTransitionTimers = useCallback(() => {
    if (confirmationTimerRef.current !== null) {
      window.clearTimeout(confirmationTimerRef.current);
      confirmationTimerRef.current = null;
    }
    if (transitionLoadTimerRef.current !== null) {
      window.clearTimeout(transitionLoadTimerRef.current);
      transitionLoadTimerRef.current = null;
    }
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const navigateWithoutTransition = useCallback(() => {
    window.location.assign(DESTINATION);
  }, []);

  const beginValidation = useCallback(() => {
    iniciarConfirmacao();
    confirmationGenerationRef.current++;
    clearHardNavigationTimer();
    clearTransitionTimers();
    authenticationHandledRef.current = false;
    navigationStartedRef.current = false;
    setVisualReady(false);
    setFailureMessage(null);
    voyage.set(0);
    dispatch({ type: "SUBMIT" });
    void loadLoginSuccessTransition().catch(() => undefined);
  }, [clearHardNavigationTimer, clearTransitionTimers, iniciarConfirmacao, voyage]);

  const reportAuthFailure = useCallback((message: string) => {
    confirmationGenerationRef.current++;
    clearTransitionTimers();
    authenticationHandledRef.current = false;
    setVisualReady(false);
    setFailureMessage(message);
    dispatch({ type: "AUTH_FAILURE" });
  }, [clearTransitionTimers]);

  const confirmAuthenticated = useCallback(async () => {
    if (authenticationHandledRef.current) return;
    authenticationHandledRef.current = true;
    const attempt = confirmationGenerationRef.current;
    // Arm before any await. The session bridge independently aborts the request
    // (including its body) at8s; this watchdog also bounds a broken consumer.
    confirmationTimerRef.current = window.setTimeout(() => {
      if (attempt !== confirmationGenerationRef.current) return;
      reportAuthFailure("A conexão demorou a responder. Tente novamente.");
    }, SESSION_CONFIRMATION_TIMEOUT_MS);

    try {
      const refreshedSession = await update();
      if (attempt !== confirmationGenerationRef.current) return;
      if (!sessaoPermiteOperacao(refreshedSession)) {
        authenticationHandledRef.current = false;
        reportAuthFailure("Não foi possível confirmar sua sessão. Tente novamente.");
        return;
      }
      if (confirmationTimerRef.current !== null) window.clearTimeout(confirmationTimerRef.current);
      confirmationTimerRef.current = null;
      dispatch({ type: "AUTH_SUCCESS" });
      transitionLoadTimerRef.current = window.setTimeout(
        navigateWithoutTransition,
        TRANSITION_LOAD_TIMEOUT_MS,
      );
    } catch {
      if (attempt !== confirmationGenerationRef.current) return;
      authenticationHandledRef.current = false;
      reportAuthFailure("Não foi possível confirmar sua sessão. Tente novamente.");
    }
  }, [navigateWithoutTransition, reportAuthFailure, update]);

  const markTransitionReady = useCallback(() => {
    setVisualReady(true);
    dispatch({ type: "COVERING" });
  }, []);

  const navigateBehindOverlay = useCallback(() => {
    if (navigationStartedRef.current) return;
    navigationStartedRef.current = true;
    if (transitionLoadTimerRef.current !== null) {
      window.clearTimeout(transitionLoadTimerRef.current);
      transitionLoadTimerRef.current = null;
    }
    dispatch({ type: "COVERED" });
    router.replace(DESTINATION);
    hardNavigationTimerRef.current = window.setTimeout(() => {
      window.location.assign(DESTINATION);
    }, HARD_NAVIGATION_TIMEOUT_MS);
  }, [router]);

  useEffect(() => {
    if (phase !== "navigation" || !pathname.startsWith(DESTINATION)) return;
    clearHardNavigationTimer();
    dispatch({ type: "ROUTE_READY" });
  }, [clearHardNavigationTimer, pathname, phase]);

  useEffect(() => () => {
    confirmationGenerationRef.current++;
    clearHardNavigationTimer();
    clearTransitionTimers();
  }, [clearHardNavigationTimer, clearTransitionTimers]);

  const completeTraversal = useCallback(() => {
    dispatch({ type: "TRAVERSAL_COMPLETE" });
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null;
      setVisualReady(false);
      dispatch({ type: "RESET" });
    }, reducedMotion ? 80 : 180);
  }, [reducedMotion]);

  const value = useMemo<LoginTransitionContextValue>(() => ({
    phase,
    isBlocking: loginTransitionIsBlocking(phase),
    visualReady,
    failureMessage,
    beginValidation,
    reportAuthFailure,
    confirmAuthenticated,
  }), [beginValidation, confirmAuthenticated, failureMessage, phase, reportAuthFailure, visualReady]);

  const showOverlay = ["authorized", "covering", "navigation", "traversing", "revealed"].includes(phase);

  return (
    <LoginTransitionContext.Provider value={value}>
      <LoginPageTow active={!reducedMotion && ["navigation", "traversing", "revealed"].includes(phase)} voyage={voyage}>
        {children}
      </LoginPageTow>
      {showOverlay && (
        <>
          <div
            className="pointer-events-auto fixed inset-0 z-[3090] cursor-wait"
            aria-hidden="true"
          />
          <TransitionErrorBoundary onFailure={navigateWithoutTransition}>
            <LoginSuccessTransition
              voyage={voyage}
              reducedMotion={reducedMotion}
              routeReady={phase === "traversing" || phase === "revealed"}
              onReady={markTransitionReady}
              onCovered={navigateBehindOverlay}
              onComplete={completeTraversal}
            />
          </TransitionErrorBoundary>
        </>
      )}
    </LoginTransitionContext.Provider>
  );
}

export function useLoginTransition(): LoginTransitionContextValue {
  const context = useContext(LoginTransitionContext);
  if (!context) throw new Error("useLoginTransition deve ser usado dentro de LoginTransitionProvider");
  return context;
}
