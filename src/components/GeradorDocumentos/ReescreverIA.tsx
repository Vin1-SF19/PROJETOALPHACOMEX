"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

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
      <Button variant="ghost" size="sm" className="self-start" onClick={onAbrir}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        Reescrever com IA
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Descreva a alteração desejada</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onFechar} aria-label="Fechar">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <textarea
        className="min-h-16 w-full rounded-md border border-neutral-200 bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800"
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
        {carregando ? "Reescrevendo..." : "Reescrever com IA"}
      </Button>
    </div>
  );
}
