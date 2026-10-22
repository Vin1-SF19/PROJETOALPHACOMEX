import { auth } from "../../../../../../auth";
import { getTema } from "@/lib/temas";
import { ListarPipelinesBpm, ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";
import PipelineBoardClient from "./PipelineBoardClient";
import { notFound } from "next/navigation";

import { intencaoNotificacaoBpmSchema } from "@/lib/bpm/notificacoes-navegacao";

export const dynamic = "force-dynamic";

export default async function PipelineBpmPage({
  params,
  searchParams,
}: {
  params: Promise<{ pipelineId: string }>;
  searchParams?: Promise<{ cardId?: string | string[]; tarefaId?: string | string[]; origemLead?: string | string[]; leadId?: string | string[]; recepcaoId?: string | string[] }>;
}) {
  const { pipelineId } = await params;
  const busca = await searchParams;
  const intencaoInicial = intencaoNotificacaoBpmSchema.safeParse({ pipelineId, cardId: busca?.cardId, tarefaId: busca?.tarefaId,
    origemLead: busca?.origemLead, leadId: busca?.leadId, recepcaoId: busca?.recepcaoId });
  const session = await auth();
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);

  const [pipelineResult, cardsResult, pipelinesResult] = await Promise.all([
    ObterPipelineBpm(pipelineId),
    SincronizarQuadroBpm(pipelineId),
    ListarPipelinesBpm(),
  ]);

  if (!pipelineResult.success || !pipelineResult.data) notFound();

  return (
    <PipelineBoardClient
      key={pipelineId}
      pipeline={pipelineResult.data}
      cardInicialId={intencaoInicial.success ? intencaoInicial.data.cardId ?? null : null}
      intencaoNotificacaoInicial={intencaoInicial.success ? intencaoInicial.data : null}
      tarefaInicialId={intencaoInicial.success ? intencaoInicial.data.tarefaId : undefined}
      pipelinesDisponiveis={pipelinesResult.success ? pipelinesResult.data.map(({ id, nome }) => ({ id, nome })) : []}
      cardsIniciais={cardsResult.success ? cardsResult.cards : []}
      manifestoInicial={cardsResult.success ? cardsResult.manifesto : { configVersion: 0, entradas: [] }}
      visual={visual}
      currentUserId={session?.user?.id ? Number(session.user.id) : null}
      currentUserRole={session?.user?.role ?? null}
    />
  );
}
