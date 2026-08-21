import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ListarRoadmapAlpha } from "@/actions/RoadmapAlpha";
import { RoadmapDashboard } from "@/components/RoadmapAlpha/RoadmapDashboard";
import { getRoadmapModuleCatalogWithWorkspaces } from "@/lib/roadmap-alpha/catalog";

export const dynamic = "force-dynamic";

export default async function RoadmapAlphaPage() {
  const [result, modules] = await Promise.all([
    ListarRoadmapAlpha(),
    getRoadmapModuleCatalogWithWorkspaces(),
  ]);
  if (!result.success) redirect("/PainelAlpha");

  return (
    <Suspense fallback={null}>
      <RoadmapDashboard
        initialObjectives={result.data}
        modules={modules}
        canMutate={result.canMutate}
        canAccessProduction={result.canAccessProduction}
      />
    </Suspense>
  );
}
