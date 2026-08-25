import { getTema } from "@/lib/temas";
import { auth } from "../../../../../auth";
import { ListarPipelinesBpm } from "@/actions/bpm/Pipelines";
import PipelinesListClient from "./PipelinesListClient";

export const dynamic = "force-dynamic";

export default async function PipelinesPage() {
  const session = await auth();
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);

  const result = await ListarPipelinesBpm();

  return (
    <PipelinesListClient
      pipelines={result.success ? result.data : []}
      erro={result.success ? null : result.error ?? "Erro ao carregar pipelines"}
      accent={visual.accent}
    />
  );
}
