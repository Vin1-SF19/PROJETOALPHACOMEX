import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getEmpresasChecklist } from "@/actions/checklist";
import db from "@/lib/prisma";
import ListaChecklist from "./ListaChecklist";

export default async function CheckListPage() {
  const session = await auth();
  if (!session) redirect("/");

  const userId = Number((session.user as any)?.id);

  const [result, clientesAcesso, userDb] = await Promise.all([
    getEmpresasChecklist(),
    db.clienteOperacional.findMany({ select: { id: true, nome: true, email: true } }),
    db.usuarios.findUnique({
      where: { id: userId },
      select: { tema_interface: true },
    }),
  ]);

  const empresas = result.data ?? [];
  const tema = userDb?.tema_interface ?? "blue";
  const role = (session.user as any)?.role ?? "";

  return (
    <div className="relative min-h-screen text-slate-200 overflow-x-hidden">
      <ListaChecklist empresas={empresas} clientesAcesso={clientesAcesso} tema={tema} role={role} />
    </div>
  );
}
