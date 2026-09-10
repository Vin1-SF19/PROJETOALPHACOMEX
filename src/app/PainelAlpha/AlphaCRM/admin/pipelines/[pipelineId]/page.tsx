import { auth } from "../../../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getTema } from "@/lib/temas";
import { ListarPipelinesBpm, ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { ListarTransicoesDoPipelineBpm } from "@/actions/bpm/Transicoes";
import { ListarConfiguracoesSlaBpm } from "@/actions/bpm/Sla";
import { ListarCadenciasBpm } from "@/actions/bpm/Cadencias";
import { getServicosComerciais } from "@/actions/ContratoComercial";
import { isAdminRole } from "@/lib/bpm/ownership";
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

  const [pipelineResult, pipelinesResult, transicoesResult, slaResult, servicosResult, cadenciasResult] = await Promise.all([
    ObterPipelineBpm(pipelineId, true),
    ListarPipelinesBpm(true),
    ListarTransicoesDoPipelineBpm(pipelineId),
    ListarConfiguracoesSlaBpm(pipelineId),
    getServicosComerciais(),
    ListarCadenciasBpm(),
  ]);
  if (!pipelineResult.success && pipelineResult.error === "Pipeline não encontrado") notFound();
  if (!pipelineResult.success) {
    return (
      <main className="m-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6" role="alert">
        <h1 className="text-lg font-bold text-rose-100">Não foi possível carregar a configuração</h1>
        <p className="mt-2 text-sm text-rose-200/80">
          {typeof pipelineResult.error === "string"
            ? pipelineResult.error
            : "O banco não respondeu corretamente. Tente recarregar a página."}
        </p>
      </main>
    );
  }
  if (!pipelineResult.data) notFound();

  const servicosComerciais = servicosResult.success && servicosResult.servicos
    ? servicosResult.servicos.map(({ id, nome }) => ({ id, nome }))
    : null;
  const falhasRelacionadas = [
    !pipelinesResult.success ? "catálogo de pipelines" : null,
    !transicoesResult.success ? "transições" : null,
    !slaResult.success ? "SLA" : null,
    !servicosComerciais ? "serviços comerciais" : null,
    !cadenciasResult.success ? "cadências" : null,
  ].filter((item): item is string => Boolean(item));
  if (falhasRelacionadas.length > 0) {
    return (
      <main className="m-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6" role="alert">
        <h1 className="text-lg font-bold text-rose-100">A configuração não foi carregada por completo</h1>
        <p className="mt-2 text-sm text-rose-200/80">
          Falha ao carregar {falhasRelacionadas.join(", ")}. Nenhuma coleção vazia foi usada como substituta; recarregue antes de editar.
        </p>
      </main>
    );
  }

  return (
    <AdminPipelineClient
      key={`${pipelineResult.data.id}:${pipelineResult.data.configVersion}`}
      pipeline={pipelineResult.data}
      transicoesIniciais={(transicoesResult.data ?? []) as TransicaoBpm[]}
      configuracoesSlaIniciais={slaResult.data ?? []}
      servicosComerciais={servicosComerciais!}
      pipelinesDisponiveis={pipelinesResult.data.map(({ id, nome }) => ({ id, nome }))}
      cadenciasIniciais={cadenciasResult.data}
      visual={visual}
    />
  );
}
