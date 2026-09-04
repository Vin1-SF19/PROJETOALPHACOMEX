import { redirect } from "next/navigation";

import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { ListarCadenciasBpm } from "@/actions/bpm/Cadencias";
import { CadenciasWorkspace } from "@/components/bpm/cadencias/CadenciasWorkspace";
import { isAdminRole } from "@/lib/roles";
import { getTema } from "@/lib/temas";

export const dynamic = "force-dynamic";

export default async function CadenciasBpmPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isAdminRole(session.user.role ?? null)) redirect("/PainelAlpha/AlphaCRM");

  const [resultado, pipelines] = await Promise.all([
    ListarCadenciasBpm(),
    db.bpmPipeline.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, etapas: { orderBy: { ordem: "asc" }, select: { id: true, nome: true } } },
    }),
  ]);
  const temaNome = (session.user as { tema_interface?: string }).tema_interface || "blue";
  const visual = getTema(temaNome);

  return (
    <CadenciasWorkspace
      cadencias={resultado.success ? resultado.data : []}
      pipelines={pipelines}
      erro={resultado.success ? null : (typeof resultado.error === "string" ? resultado.error : "Erro ao carregar")}
      accent={visual.accent}
    />
  );
}
