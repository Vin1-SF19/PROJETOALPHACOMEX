import { auth } from "../../../../../../auth";
import { getTema } from "@/lib/temas";
import { ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";
import PipelineBoardClient from "./PipelineBoardClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PipelineBpmPage({
  params,
}: {
  params: Promise<{ pipelineId: string }>;
}) {
  const { pipelineId } = await params;
  const session = await auth();
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);

  const [pipelineResult, cardsResult] = await Promise.all([
    ObterPipelineBpm(pipelineId),
    SincronizarQuadroBpm(pipelineId),
  ]);

  if (!pipelineResult.success || !pipelineResult.data) notFound();

  return (
    <PipelineBoardClient
      key={pipelineId}
      pipeline={pipelineResult.data}
      cardsIniciais={cardsResult.success ? cardsResult.cards : []}
      manifestoInicial={cardsResult.success ? cardsResult.manifesto : { configVersion: 0, entradas: [] }}
      visual={visual}
      currentUserId={session?.user?.id ? Number(session.user.id) : null}
      currentUserRole={session?.user?.role ?? null}
    />
  );
}
