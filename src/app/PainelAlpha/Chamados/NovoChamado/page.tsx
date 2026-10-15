import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "../../../../../auth";
import { NovoChamadoForm } from "./NovoChamadoForm";
import { getChamadosCatalogo } from "@/actions/chamados-categorias";
import { obterAtorChamados } from "@/lib/chamados/acesso";

export const metadata: Metadata = {
  title: "Abrir chamado | Painel Alpha",
  description: "Registre uma nova solicitação para o suporte interno.",
};

export default async function NovoChamadoPage() {
  const session = await auth();
  if (!session) redirect("/");

  const ator = await obterAtorChamados(Number(session.user.id));
  if (!ator) redirect("/");
  const catalogoInicial = await getChamadosCatalogo();
  return <NovoChamadoForm catalogoInicial={catalogoInicial} podeGerenciarCategorias={ator.gerenciaCategorias} />;
}
