import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import { obterResumoModelosEmbasamento } from "@/actions/checklist-modelos";
import EmbasamentosClient from "./EmbasamentosClient";

export default async function EmbasamentosPage() {
  const session = await auth();
  if (!session) redirect("/");

  const resultado = await obterResumoModelosEmbasamento();
  return <EmbasamentosClient resumo={resultado.data} />;
}
