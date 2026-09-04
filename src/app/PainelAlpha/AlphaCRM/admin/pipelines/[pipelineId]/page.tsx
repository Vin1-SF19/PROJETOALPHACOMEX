import { auth } from "../../../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getTema } from "@/lib/temas";
import { ListarPipelinesBpm, ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { ListarTransicoesDoPipelineBpm } from "@/actions/bpm/Transicoes";
import { ListarConfiguracoesSlaBpm } from "@/actions/bpm/Sla";
import { getServicosComerciais } from "@/actions/ContratoComercial";
import { isAdminRole } from "@/lib/bpm/ownership";
import { garantirSchemaFinanceiro } from "@/lib/bpm/pipeline-financeiro-migration";
import AdminPipelineClient from "./AdminPipelineClient";
import type { TransicaoBpm } from "./EtapaAvancadaSection";

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

  try {
    await garantirSchemaFinanceiro(pipelineId);
  } catch (error) {
    console.error("[AdminPipelinePage] garantirSchemaFinanceiro", error);
  }

  const [pipelineResult, pipelinesResult, transicoesResult, slaResult, servicosResult] = await Promise.all([
    ObterPipelineBpm(pipelineId, true),
    ListarPipelinesBpm(true),
    ListarTransicoesDoPipelineBpm(pipelineId),
    ListarConfiguracoesSlaBpm(pipelineId),
    getServicosComerciais(),
  ]);
  if (!pipelineResult.success || !pipelineResult.data) notFound();

  return (
    <AdminPipelineClient
      pipeline={pipelineResult.data}
      transicoesIniciais={(transicoesResult.data ?? []) as TransicaoBpm[]}
      configuracoesSlaIniciais={slaResult.data ?? []}
      servicosComerciais={servicosResult.success ? servicosResult.servicos.map(({ id, nome }) => ({ id, nome })) : []}
      pipelinesDisponiveis={(pipelinesResult.data ?? []).map(({ id, nome }) => ({ id, nome }))}
      visual={visual}
    />
  );
}
