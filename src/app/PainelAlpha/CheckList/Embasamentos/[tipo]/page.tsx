import { auth } from "../../../../../../auth";
import { notFound, redirect } from "next/navigation";
import { listarModelosEmbasamento } from "@/actions/checklist-modelos";
import { TIPOS_EMBASAMENTO } from "@/lib/checklist/modelos";
import ModeloEmbasamentoClient from "./ModeloEmbasamentoClient";

interface ModeloEmbasamentoPageProps {
  params: Promise<{ tipo: string }>;
}

export default async function ModeloEmbasamentoPage({ params }: ModeloEmbasamentoPageProps) {
  const session = await auth();
  if (!session) redirect("/");

  const { tipo: tipoParam } = await params;
  const tipo = TIPOS_EMBASAMENTO.find((item) => item === tipoParam);
  if (!tipo) notFound();

  const resultado = await listarModelosEmbasamento(tipo);
  return <ModeloEmbasamentoClient tipo={tipo} modelos={resultado.data ?? []} />;
}
