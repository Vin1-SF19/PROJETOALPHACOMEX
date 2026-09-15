"use client";

import { useCallback, useEffect, useRef } from "react";

import { buscarPendenciasUltimoCs } from "@/actions/Clientes";
import { podeReceberAlertasUltimoCs } from "@/lib/cs-nps/alertas-ultimo-cs";
import { useCsNpsNotificacoes } from "@/store/useCsNpsNotificacoes";

const INTERVALO_RECONCILIACAO_MS = 60_000;

export function useCsNpsNotifications(role?: string | null) {
  const consultaEmAndamentoRef = useRef<Promise<void> | null>(null);
  const definirCarregando = useCsNpsNotificacoes((state) => state.definirCarregando);
  const definirPendencias = useCsNpsNotificacoes((state) => state.definirPendencias);
  const definirErro = useCsNpsNotificacoes((state) => state.definirErro);
  const limpar = useCsNpsNotificacoes((state) => state.limpar);
  const autorizado = podeReceberAlertasUltimoCs(role);

  const executarConsulta = useCallback(async () => {
    if (!autorizado) return;
    definirCarregando(true);

    try {
      const resultado = await buscarPendenciasUltimoCs();
      if (!resultado.success) {
        definirErro(resultado.error);
        definirPendencias([]);
        return;
      }
      definirErro(null);
      definirPendencias(resultado.alertas);
    } catch {
      definirErro("Não foi possível atualizar os alertas de CS");
    } finally {
      definirCarregando(false);
    }
  }, [autorizado, definirCarregando, definirErro, definirPendencias]);

  const reconciliar = useCallback((): Promise<void> => {
    if (consultaEmAndamentoRef.current) return consultaEmAndamentoRef.current;
    const consulta = executarConsulta().finally(() => {
      if (consultaEmAndamentoRef.current === consulta) consultaEmAndamentoRef.current = null;
    });
    consultaEmAndamentoRef.current = consulta;
    return consulta;
  }, [executarConsulta]);

  const reconciliarAposSalvar = useCallback(async () => {
    const consultaAnterior = consultaEmAndamentoRef.current;
    if (consultaAnterior) await consultaAnterior;
    await reconciliar();
  }, [reconciliar]);

  useEffect(() => {
    if (!autorizado) {
      limpar();
      return;
    }

    void reconciliar();
    const intervalo = window.setInterval(() => void reconciliar(), INTERVALO_RECONCILIACAO_MS);
    const aoFocar = () => void reconciliar();
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") void reconciliar();
    };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [autorizado, limpar, reconciliar]);

  return { autorizado, reconciliar: reconciliarAposSalvar };
}
