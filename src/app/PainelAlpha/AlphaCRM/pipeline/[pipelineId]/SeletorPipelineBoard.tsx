"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PipelineDisponivel = { id: string; nome: string };

export function SeletorPipelineBoard({ atual, pipelines, bloqueado = false }: {
  atual: PipelineDisponivel;
  pipelines: PipelineDisponivel[];
  bloqueado?: boolean;
}) {
  const router = useRouter();
  const [trocando, iniciarTroca] = useTransition();
  const opcoes = pipelines.some((pipeline) => pipeline.id === atual.id) ? pipelines : [atual, ...pipelines];
  const desabilitado = bloqueado || trocando || opcoes.length < 2;

  function trocar(pipelineId: string) {
    if (desabilitado || pipelineId === atual.id || !opcoes.some((pipeline) => pipeline.id === pipelineId)) return;
    iniciarTroca(() => router.push(`/PainelAlpha/AlphaCRM/pipeline/${encodeURIComponent(pipelineId)}`));
  }

  return (
    <>
      <Select value={atual.id} onValueChange={trocar} disabled={desabilitado}>
        <SelectTrigger
          aria-label="Trocar funil"
          aria-busy={trocando}
          title={pipelines.length === 0 ? "Lista de funis indisponível no momento" : "Trocar funil"}
          className="w-[260px] max-w-full shrink-0 border-white/10 bg-white/[0.04] text-xs text-slate-200"
        >
          {trocando ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            : <ArrowRightLeft className="size-4 shrink-0" aria-hidden="true" />}
          <SelectValue placeholder={atual.nome} />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((pipeline) => <SelectItem key={pipeline.id} value={pipeline.id}>{pipeline.nome}</SelectItem>)}
        </SelectContent>
      </Select>
      {trocando && <span role="status" className="sr-only">Alterando funil…</span>}
    </>
  );
}
