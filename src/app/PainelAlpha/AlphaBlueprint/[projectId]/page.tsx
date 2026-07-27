import { auth } from "../../../../../auth";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/prisma";
import { ObterProjetoBlueprint } from "@/actions/BlueprintProjects";
import { ProjectWorkspace } from "@/components/AlphaBlueprint/ProjectWorkspace";

export const dynamic = "force-dynamic";

export default async function AlphaBlueprintProjetoPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { projectId } = await params;
  const userId = Number((session.user as { id?: string | number }).id ?? 0);

  const res = await ObterProjetoBlueprint(projectId);
  if (!res.success || !res.data) notFound();

  const rec = await db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } });
  const temaName = rec?.tema_interface ?? "blue";

  return <ProjectWorkspace projeto={res.data} temaName={temaName} userId={userId} />;
}
