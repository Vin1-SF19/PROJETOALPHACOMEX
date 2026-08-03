import { getTema } from "@/lib/temas";
import { auth } from "../../../../auth";
import { ListarPipelinesBpm } from "@/actions/bpm/Pipelines";
import PipelinesListClient from "./PipelinesListClient";

export const dynamic = "force-dynamic";

export default async function AlphaCRMPage() {
  const session = await auth();
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);

  const pipelinesResult = await ListarPipelinesBpm();

  return <PipelinesListClient pipelines={pipelinesResult.data ?? []} visual={visual} />;
}
