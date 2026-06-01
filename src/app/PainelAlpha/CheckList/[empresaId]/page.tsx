import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import { getEmpresaChecklist } from "@/actions/checklist";
import db from "@/lib/prisma";
import ChecklistView from "../ChecklistView";

export default async function EmpresaChecklistPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/");

  const { empresaId } = await params;

  const [result, userDb] = await Promise.all([
    getEmpresaChecklist(empresaId),
    db.usuarios.findUnique({
      where: { id: Number((session.user as any)?.id) },
      select: { tema_interface: true },
    }),
  ]);

  if (result.error || !result.data) {
    return (
      <div className="p-10 text-white font-black text-center">
        {result.error ?? "Empresa não encontrada"}
      </div>
    );
  }

  return (
    <ChecklistView
      empresa={result.data as any}
      userNome={(session.user as any)?.nome ?? (session.user as any)?.name ?? "Analista"}
      tema={userDb?.tema_interface ?? "blue"}
    />
  );
}
