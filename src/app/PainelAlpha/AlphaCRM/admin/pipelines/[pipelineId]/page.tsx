import { auth } from "../../../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getTema } from "@/lib/temas";
import { ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { isAdminRole } from "@/lib/bpm/ownership";
import AdminPipelineClient from "./AdminPipelineClient";

export const dynamic = "force-dynamic";

export default async function AdminPipelinePage({
  params,
}: {
  params: Promise<{ pipelineId: string }>;
}) {
  const { pipelineId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/");

  // D-031: apenas administradores configuram pipelines.
  if (!isAdminRole(session.user.role ?? null)) redirect("/PainelAlpha/AlphaCRM");

  const temaNome = (session.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);

  const pipelineResult = await ObterPipelineBpm(pipelineId);
  if (!pipelineResult.success || !pipelineResult.data) notFound();

  return <AdminPipelineClient pipeline={pipelineResult.data} visual={visual} />;
}
