"use client";

import { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReescreverIA({
  aberto,
  onAbrir,
  onFechar,
  onReescrever,
  carregando,
}: {
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  onReescrever: (instrucao: string) => void;
  carregando: boolean;
}) {
  const [instrucao, setInstrucao] = useState("");

  if (!aberto) {
    return (
      <Button variant="ghost" size="sm" className="gd-ai-trigger self-start" onClick={onAbrir}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        Reescrever com IA
      </Button>
    );
  }

  return (
    <div className="gd-ai flex flex-col gap-3 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#a6dce9]">Descreva a alteração desejada</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onFechar} aria-label="Fechar">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <textarea
        className="gd-textarea min-h-20 w-full rounded-md p-3 text-sm outline-none"
        placeholder="Ex: deixe o tom mais formal e adicione uma cláusula de multa por atraso"
        value={instrucao}
        onChange={(e) => setInstrucao(e.target.value)}
        disabled={carregando}
      />
      <Button
        size="sm"
        className="self-end"
        disabled={carregando || instrucao.trim().length < 3}
        onClick={() => onReescrever(instrucao.trim())}
      >
        {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{carregando ? "Reescrevendo..." : "Reescrever com IA"}
      </Button>
    </div>
  );
}
