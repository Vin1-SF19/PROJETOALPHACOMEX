import { auth } from "../../../../../../auth";
import { getTema } from "@/lib/temas";
import { ObterPerfilEmpresaBpm } from "@/actions/bpm/Empresas";
import EmpresaPerfilClient from "./EmpresaPerfilClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EmpresaPerfilPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const session = await auth();
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);

  const resultado = await ObterPerfilEmpresaBpm(Number(empresaId));
  if (!resultado.success || !resultado.data) notFound();

  return (
    <EmpresaPerfilClient
      perfil={resultado.data}
      visual={visual}
      currentUserId={session?.user?.id ? Number(session.user.id) : null}
      currentUserRole={session?.user?.role ?? null}
    />
  );
}
