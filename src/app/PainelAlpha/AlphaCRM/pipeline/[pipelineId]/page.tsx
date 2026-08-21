import { auth } from "../../../../../../auth";
import { getTema } from "@/lib/temas";
import { ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { ListarCardsPipelineBpm } from "@/actions/bpm/Cards";
import { garantirSchemaFinanceiro } from "@/lib/bpm/pipeline-financeiro-migration";
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

  try {
    await garantirSchemaFinanceiro(pipelineId);
  } catch (error) {
    console.error("[PipelineBpmPage] garantirSchemaFinanceiro", error);
  }

  const [pipelineResult, cardsResult] = await Promise.all([
    ObterPipelineBpm(pipelineId),
    ListarCardsPipelineBpm(pipelineId),
  ]);

  if (!pipelineResult.success || !pipelineResult.data) notFound();

  return (
    <PipelineBoardClient
      pipeline={pipelineResult.data}
      cardsIniciais={cardsResult.data ?? []}
      visual={visual}
      currentUserId={session?.user?.id ? Number(session.user.id) : null}
      currentUserRole={session?.user?.role ?? null}
    />
  );
}
