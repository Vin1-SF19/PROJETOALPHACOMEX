import { redirect } from "next/navigation";

import { ListarRoadmapAlpha } from "@/actions/RoadmapAlpha";
import { RoadmapDashboard } from "@/components/RoadmapAlpha/RoadmapDashboard";
import { getRoadmapModuleCatalog } from "@/lib/roadmap-alpha/catalog";

export const dynamic = "force-dynamic";

export default async function RoadmapAlphaPage() {
  const result = await ListarRoadmapAlpha();
  if (!result.success) redirect("/PainelAlpha");

  return (
    <RoadmapDashboard
      initialObjectives={result.data}
      modules={getRoadmapModuleCatalog()}
      canMutate={result.canMutate}
      canAccessProduction={result.canAccessProduction}
    />
  );
}
