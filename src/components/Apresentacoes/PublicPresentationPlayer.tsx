"use client";

import { PlayerStandalone } from "@/apresentacoes-player/PlayerStandalone";
import type { DadosApresentacaoExportada } from "@/apresentacoes-player/dados-tipos";

export function PublicPresentationPlayer({ dados }: { dados: DadosApresentacaoExportada }) {
  return <PlayerStandalone dados={dados} />;
}
