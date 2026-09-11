import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "../../../../../auth";
import { NovoChamadoForm } from "./NovoChamadoForm";
import db from "@/lib/prisma";
import { isSameRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Abrir chamado | Painel Alpha",
  description: "Registre uma nova solicitação para o suporte interno.",
};

export default async function NovoChamadoPage() {
  const session = await auth();
  if (!session) redirect("/");

  const usuariosAtivos = await db.usuarios.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true, role: true },
    orderBy: { nome: "asc" },
  });
  const tecnicos = usuariosAtivos
    .filter((usuario) => isSameRole(usuario.role, "TI"))
    .map(({ id, nome }) => ({ id, nome }));

  return <NovoChamadoForm tecnicos={tecnicos} />;
}
