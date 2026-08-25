"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { PerfilEmpresaModal } from "./PerfilEmpresaModal";

interface EmpresaInfo {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  municipio?: string;
  uf?: string;
  regimeTributario?: string;
  situacao?: string;
  analistaResponsavel?: string;
}

interface PerfilEmpresaContextValue {
  openPerfilEmpresa: (empresaId: number, empresa: EmpresaInfo) => void;
  closePerfilEmpresa: () => void;
  isPerfilEmpresaOpen: boolean;
}

const PerfilEmpresaContext = createContext<PerfilEmpresaContextValue | null>(null);

interface PerfilEmpresaProviderProps {
  children: ReactNode;
}

export function PerfilEmpresaProvider({ children }: PerfilEmpresaProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null);

  const openPerfilEmpresa = useCallback((id: number, info: EmpresaInfo) => {
    setEmpresaId(id);
    setEmpresa(info);
    setIsOpen(true);
  }, []);

  const closePerfilEmpresa = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      openPerfilEmpresa,
      closePerfilEmpresa,
      isPerfilEmpresaOpen: isOpen,
    }),
    [openPerfilEmpresa, closePerfilEmpresa, isOpen]
  );

  return (
    <PerfilEmpresaContext.Provider value={value}>
      {children}
      {isOpen && empresaId !== null && empresa && (
        <PerfilEmpresaModal
          empresaId={empresaId}
          empresa={empresa}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) closePerfilEmpresa();
          }}
        />
      )}
    </PerfilEmpresaContext.Provider>
  );
}

export function usePerfilEmpresa(): PerfilEmpresaContextValue {
  const ctx = useContext(PerfilEmpresaContext);
  if (!ctx) {
    throw new Error("usePerfilEmpresa deve ser usado dentro de <PerfilEmpresaProvider>");
  }
  return ctx;
}
