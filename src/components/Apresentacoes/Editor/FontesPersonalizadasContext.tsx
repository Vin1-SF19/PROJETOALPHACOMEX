"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { FontesPersonalizadasStyle } from "@/components/Apresentacoes/FontesPersonalizadasStyle";
import type { FontePersonalizada } from "@/lib/apresentacoes/fontes-personalizadas";

interface FontesPersonalizadasContextValue {
  fontesPersonalizadas: FontePersonalizada[];
  adicionarFonte: (nome: string, arquivo: File) => Promise<FontePersonalizada>;
}

const FontesPersonalizadasContext = createContext<FontesPersonalizadasContextValue | null>(null);

export function FontesPersonalizadasProvider({
  apresentacaoId,
  fontesIniciais,
  aguardarAntesDeSalvar,
  children,
}: {
  apresentacaoId: string;
  fontesIniciais: FontePersonalizada[];
  aguardarAntesDeSalvar: () => Promise<void>;
  children: ReactNode;
}) {
  const [fontesPersonalizadas, setFontesPersonalizadas] = useState(fontesIniciais);

  const adicionarFonte = useCallback(async (nome: string, arquivo: File) => {
    await aguardarAntesDeSalvar();
    const formData = new FormData();
    formData.set("apresentacaoId", apresentacaoId);
    formData.set("nome", nome);
    formData.set("file", arquivo);

    const resposta = await fetch("/api/apresentacoes/fontes", { method: "POST", body: formData });
    const resultado = await resposta.json().catch(() => null) as { success?: boolean; error?: string; fonte?: FontePersonalizada } | null;
    if (!resposta.ok || !resultado?.success || !resultado.fonte) {
      throw new Error(resultado?.error ?? "Não foi possível adicionar a fonte.");
    }
    setFontesPersonalizadas((atuais) => [...atuais, resultado.fonte!]);
    return resultado.fonte;
  }, [aguardarAntesDeSalvar, apresentacaoId]);

  const value = useMemo(() => ({ fontesPersonalizadas, adicionarFonte }), [adicionarFonte, fontesPersonalizadas]);

  return (
    <FontesPersonalizadasContext.Provider value={value}>
      <FontesPersonalizadasStyle fontes={fontesPersonalizadas} />
      {children}
    </FontesPersonalizadasContext.Provider>
  );
}

export function useFontesPersonalizadas(): FontesPersonalizadasContextValue {
  const contexto = useContext(FontesPersonalizadasContext);
  if (!contexto) throw new Error("useFontesPersonalizadas deve ser usado dentro de FontesPersonalizadasProvider.");
  return contexto;
}
