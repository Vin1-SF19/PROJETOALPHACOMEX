import { redirect } from "next/navigation";

import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { ConhecimentoWorkspace } from "@/components/bpm/conhecimento/ConhecimentoWorkspace";
import { isAdminRole } from "@/lib/roles";
import { getTema } from "@/lib/temas";

export const dynamic = "force-dynamic";

export default async function ConhecimentoBpmPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isAdminRole(session.user.role ?? null)) redirect("/PainelAlpha/AlphaCRM");

  const pipelines = await db.bpmPipeline.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
  const temaNome = (session.user as { tema_interface?: string }).tema_interface || "blue";
  const visual = getTema(temaNome);

  return <ConhecimentoWorkspace pipelines={pipelines} accent={visual.accent} />;
}
