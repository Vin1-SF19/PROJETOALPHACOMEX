"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { SalvarPresetsAnimacaoApresentacao } from "@/actions/apresentacoes";
import type { PresetAnimacaoPersonalizado } from "@/lib/apresentacoes/animacao/presets-personalizados";

interface PresetsAnimacaoContextValue {
  apresentacaoId: string;
  presetsPersonalizados: PresetAnimacaoPersonalizado[];
  salvarPresetsPersonalizados: (presets: PresetAnimacaoPersonalizado[]) => Promise<void>;
}

const PresetsAnimacaoContext = createContext<PresetsAnimacaoContextValue | null>(null);

export function PresetsAnimacaoProvider({
  apresentacaoId,
  presetsIniciais,
  aguardarAntesDeSalvar,
  children,
}: {
  apresentacaoId: string;
  presetsIniciais: PresetAnimacaoPersonalizado[];
  aguardarAntesDeSalvar: () => Promise<void>;
  children: ReactNode;
}) {
  const [presetsPersonalizados, setPresetsPersonalizados] = useState(presetsIniciais);

  const salvarPresetsPersonalizados = useCallback(async (presets: PresetAnimacaoPersonalizado[]) => {
    await aguardarAntesDeSalvar();
    const resultado = await SalvarPresetsAnimacaoApresentacao({ apresentacaoId, presets });
    if (!resultado.success) {
      throw new Error(typeof resultado.error === "string" ? resultado.error : "Não foi possível salvar os presets.");
    }
    setPresetsPersonalizados(resultado.data);
  }, [aguardarAntesDeSalvar, apresentacaoId]);

  const value = useMemo<PresetsAnimacaoContextValue>(() => ({
    apresentacaoId,
    presetsPersonalizados,
    salvarPresetsPersonalizados,
  }), [apresentacaoId, presetsPersonalizados, salvarPresetsPersonalizados]);

  return <PresetsAnimacaoContext.Provider value={value}>{children}</PresetsAnimacaoContext.Provider>;
}

export function usePresetsAnimacao(): PresetsAnimacaoContextValue {
  const contexto = useContext(PresetsAnimacaoContext);
  if (!contexto) throw new Error("usePresetsAnimacao deve ser usado dentro de PresetsAnimacaoProvider.");
  return contexto;
}
