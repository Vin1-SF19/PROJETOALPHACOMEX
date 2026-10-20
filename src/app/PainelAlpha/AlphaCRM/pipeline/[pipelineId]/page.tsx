import { auth } from "../../../../../../auth";
import { getTema } from "@/lib/temas";
import { ListarPipelinesBpm, ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";
import PipelineBoardClient from "./PipelineBoardClient";
import { notFound } from "next/navigation";

import { bpmCardIdSchema } from "@/lib/validations/bpm";

export const dynamic = "force-dynamic";

export default async function PipelineBpmPage({
  params,
  searchParams,
}: {
  params: Promise<{ pipelineId: string }>;
  searchParams?: Promise<{ cardId?: string | string[] }>;
}) {
  const { pipelineId } = await params;
  const cardInicial = bpmCardIdSchema.safeParse((await searchParams)?.cardId);
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
      cardInicialId={cardInicial.success ? cardInicial.data : null}
      pipelinesDisponiveis={pipelinesResult.success ? pipelinesResult.data.map(({ id, nome }) => ({ id, nome })) : []}
      cardsIniciais={cardsResult.success ? cardsResult.cards : []}
      manifestoInicial={cardsResult.success ? cardsResult.manifesto : { configVersion: 0, entradas: [] }}
      visual={visual}
      currentUserId={session?.user?.id ? Number(session.user.id) : null}
      currentUserRole={session?.user?.role ?? null}
    />
  );
}
