"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Form from "next/form";
import { AlertCircle, Lock, LogIn, Mail } from "lucide-react";

import loginAction, { type LoginActionState } from "@/lib/loginAction";
import ModalRecuperarSenha from "./RecuperarSenha/page";
import { useLoginTransition } from "./login/LoginTransitionProvider";
import { useReducedMotion } from "./login/useReducedMotion";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginActionState | null, FormData>(
    loginAction,
    null,
  );
  const [isModalSenhaAberto, setIsModalSenhaAberto] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [capsLockAtivo, setCapsLockAtivo] = useState(false);
  const [shake, setShake] = useState(false);
  const handledStateRef = useRef<LoginActionState | null>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const {
    phase,
    isBlocking,
    failureMessage,
    beginValidation,
    reportAuthFailure,
    confirmAuthenticated,
  } = useLoginTransition();

  useEffect(() => {
    if (!state || handledStateRef.current === state) return;
    handledStateRef.current = state;

    if (state.success) {
      void confirmAuthenticated();
      return;
    }

    reportAuthFailure(state.message);
    if (!reducedMotion) {
      if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = window.setTimeout(() => {
        shakeTimerRef.current = null;
        setShake(true);
      }, 0);
    }
  }, [confirmAuthenticated, reducedMotion, reportAuthFailure, state]);

  useEffect(() => () => {
    if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
  }, []);

  const verificarCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockAtivo(event.getModifierState("CapsLock"));
  };
  const erro = phase === "auth_error";
  const disabled = isPending || isBlocking;

  return (
    <div
      className={`w-full ${shake ? "login-shake" : ""}`}
      onAnimationEnd={() => setShake(false)}
    >
      {erro && (
        <div
          className="mb-5 flex items-center gap-3 rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-red-400 shadow-[0_0_24px_rgba(239,68,68,0.15)]"
          role="alert"
        >
          <AlertCircle size={20} aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest">Protocolo Rejeitado</span>
            <span className="text-xs font-bold uppercase italic">
              {failureMessage ?? "Não foi possível realizar o login. Tente novamente."}
            </span>
          </div>
        </div>
      )}

      <Form
        action={formAction}
        className="space-y-5"
        onSubmit={beginValidation}
        aria-busy={disabled}
      >
        <div className="group">
          <div className="mb-2 ml-1 flex items-center justify-between">
            <label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 transition-colors group-focus-within:text-red-400">
              Identificação de Rede
            </label>
            {emailValue !== emailValue.toLowerCase() && (
              <span className="animate-pulse text-[8px] font-black uppercase tracking-tighter text-amber-500">
                Forçando Minúsculas
              </span>
            )}
          </div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-red-400" size={18} aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="text"
              inputMode="email"
              autoComplete="username"
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value.toLowerCase().trim())}
              placeholder="USUARIO@ALPHA.COM"
              required
              disabled={disabled}
              className="login-input block h-14 w-full rounded-2xl border border-white/5 pl-12 pr-4 text-[11px] font-black tracking-widest text-white outline-none transition-all placeholder:text-slate-700 disabled:cursor-wait disabled:opacity-60"
            />
          </div>
        </div>

        <div className="group">
          <div className="mb-2 flex items-center justify-between px-1">
            <label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 transition-colors group-focus-within:text-red-400">
              Chave de Acesso
            </label>
            <button
              type="button"
              onClick={() => setIsModalSenhaAberto(true)}
              disabled={disabled}
              className="cursor-pointer border-b border-transparent text-[9px] font-black italic uppercase text-slate-600 transition-all hover:border-red-500/50 hover:text-red-500 disabled:cursor-wait"
            >
              Recuperar Acesso
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-red-400" size={18} aria-hidden="true" />
            <input
              id="password"
              name="senha"
              type="password"
              autoComplete="current-password"
              onKeyUp={verificarCapsLock}
              onKeyDown={verificarCapsLock}
              placeholder="••••••••"
              required
              disabled={disabled}
              className={`login-input block h-14 w-full rounded-2xl border pl-12 pr-4 text-[11px] font-black uppercase tracking-widest text-white outline-none transition-all placeholder:text-slate-700 disabled:cursor-wait disabled:opacity-60 ${
                capsLockAtivo ? "border-amber-500/50 bg-amber-500/5" : "border-white/5"
              }`}
            />
            {capsLockAtivo && (
              <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 text-amber-500">
                <AlertCircle size={14} aria-hidden="true" />
                <span className="text-[8px] font-black uppercase tracking-widest">Caps On</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={disabled}
            className={`login-btn group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 md:h-16 md:rounded-[1.8rem] md:text-[11px] md:tracking-[0.4em] ${
              disabled ? "cursor-wait" : "cursor-pointer text-white"
            }`}
          >
            {isPending || phase === "validating" ? (
              <>
                <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
                  <span className="absolute inset-0 animate-spin rounded-full border-2 border-slate-600 border-t-red-500" />
                </span>
                <span>Validando Acesso</span>
              </>
            ) : (
              <>
                <LogIn size={20} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                <span>Entrar</span>
              </>
            )}
            {!disabled && <span className="login-btn-shine pointer-events-none absolute inset-0 -translate-x-full" />}
          </button>
        </div>
      </Form>

      <ModalRecuperarSenha
        isOpen={isModalSenhaAberto}
        onClose={() => setIsModalSenhaAberto(false)}
      />
    </div>
  );
}
