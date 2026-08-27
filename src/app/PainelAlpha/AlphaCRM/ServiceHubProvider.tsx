"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { ExternalLink, X } from "lucide-react";

const SERVICE_HUB_URL = "https://alphacomex.callix.com.br/servicehub";

type ServiceHubContextValue = {
  abrirServiceHub: () => void;
};

const ServiceHubContext = createContext<ServiceHubContextValue | null>(null);

export function useServiceHub() {
  const contexto = useContext(ServiceHubContext);
  if (!contexto) throw new Error("useServiceHub deve ser usado dentro de ServiceHubProvider.");
  return contexto;
}

/**
 * Mantém o ServiceHub carregado após a primeira abertura para preservar a
 * sessão do agente. Não é exibido como item de navegação do Alpha CRM.
 */
export function ServiceHubProvider({ children }: { children: React.ReactNode }) {
  const [carregado, setCarregado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const value = useMemo(() => ({
    abrirServiceHub: () => {
      setCarregado(true);
      setAberto(true);
    },
  }), []);

  return (
    <ServiceHubContext.Provider value={value}>
      {children}

      {carregado && (
        <section
          aria-hidden={!aberto}
          aria-label="ServiceHub"
          className={[
            "fixed inset-0 z-[100] flex flex-col bg-slate-950 transition-opacity duration-200",
            aberto ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 text-slate-100">
            <div>
              <h2 className="text-sm font-bold">ServiceHub</h2>
              <p className="text-xs text-slate-400">Mantenha-se conectado para realizar ligações.</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={SERVICE_HUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                Abrir em outra aba
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                aria-label="Fechar ServiceHub"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </header>
          <iframe
            title="ServiceHub"
            src={SERVICE_HUB_URL}
            className="min-h-0 flex-1 border-0 bg-white"
            allow="microphone; autoplay"
          />
        </section>
      )}
    </ServiceHubContext.Provider>
  );
}
