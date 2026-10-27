import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import { getTema } from "@/lib/temas";
import { ListarPipelinesBpm } from "@/actions/bpm/Pipelines";
import { isAdminRole } from "@/lib/bpm/ownership";
import AdminPipelinesListClient from "./AdminPipelinesListClient";

export const dynamic = "force-dynamic";

export default async function AdminPipelinesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  // D-031: apenas administradores configuram pipelines.
  if (!isAdminRole(session.user.role ?? null)) redirect("/PainelAlpha/AlphaCRM");

  const temaNome = (session.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);

  const pipelinesResult = await ListarPipelinesBpm(true);

  return (
    <AdminPipelinesListClient
      pipelines={pipelinesResult.data ?? []}
      visual={visual}
    />
  );
}
