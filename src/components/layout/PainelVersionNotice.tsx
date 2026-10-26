"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { consultarJsonPainel, janelaPrincipal } from "@/lib/painel-polling";

interface PainelVersionNoticeProps { deployedCommitSha?: string }
const shaValido = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);

/** An advisory only: legacy frames cannot all prove their drafts are safe to unload. */
export function PainelVersionNotice({ deployedCommitSha }: PainelVersionNoticeProps) {
  const { data: session } = useSession();
  const identity = sessaoPermiteOperacao(session) ? session?.user?.id : null;
  const query = useQuery({
    queryKey: ["alpha-deployed-version", identity, deployedCommitSha],
    enabled: !!identity && shaValido(deployedCommitSha) && janelaPrincipal(),
    retry: false, staleTime: 300_000, refetchInterval: 300_000,
    refetchIntervalInBackground: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const data = await consultarJsonPainel("/api/health/version", signal);
      if (!data || typeof data !== "object" || !("status" in data) || data.status !== "ok" ||
        !("deployedCommitSha" in data) || !shaValido(data.deployedCommitSha)) throw new Error("Versão indisponível");
      return data.deployedCommitSha;
    },
  });
  if (!identity || !query.data || query.data === deployedCommitSha) return null;
  return (
    <aside role="status" aria-label="Atualização do Painel Alpha" className="border-b border-border bg-background px-4 py-2 text-sm text-foreground">
      Há uma nova versão do painel. Salve o trabalho em todas as abas e preserve seus rascunhos antes de atualizar a página manualmente.
    </aside>
  );
}
