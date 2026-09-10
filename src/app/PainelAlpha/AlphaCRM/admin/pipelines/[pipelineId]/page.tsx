import { auth } from "../../../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getTema } from "@/lib/temas";
import { ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { ListarTransicoesDoPipelineBpm } from "@/actions/bpm/Transicoes";
import { ListarConfiguracoesSlaBpm } from "@/actions/bpm/Sla";
import { ListarCadenciasBpm } from "@/actions/bpm/Cadencias";
import { ListarWorkspaceChecklistsBpm } from "@/actions/bpm/Checklists";
import {
  ListarCatalogosAutomacoesBpm,
  ListarTemplatesAutomacoesBpm,
  ListarWorkspaceAutomacoesBpm,
} from "@/actions/bpm/Automacoes";
import { ListarMonitoramentoAutomacoesCentraisBpm } from "@/actions/bpm/AutomacoesCentrais";
import { getServicosComerciais } from "@/actions/ContratoComercial";
import { AutomacoesWorkspace } from "@/components/bpm/automacoes/AutomacoesWorkspace";
import { MotorCentralPanel } from "@/components/bpm/automacoes/MotorCentralPanel";
import { CadenciasWorkspace } from "@/components/bpm/cadencias/CadenciasWorkspace";
import { ChecklistsWorkspace } from "@/components/bpm/checklists/ChecklistsWorkspace";
import { ConhecimentoWorkspace } from "@/components/bpm/conhecimento/ConhecimentoWorkspace";
import { isAdminRole } from "@/lib/bpm/ownership";
import db from "@/lib/prisma";
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

  const [
    pipelineResult,
    transicoesResult,
    slaResult,
    servicosResult,
    cadenciasResult,
    automacoesResult,
    catalogosAutomacoesResult,
    templatesAutomacoesResult,
    monitorAutomacoesResult,
    checklistsResult,
    pipelinesComplementares,
  ] = await Promise.all([
    ObterPipelineBpm(pipelineId, true),
    ListarTransicoesDoPipelineBpm(pipelineId),
    ListarConfiguracoesSlaBpm(pipelineId),
    getServicosComerciais(),
    ListarCadenciasBpm(),
    ListarWorkspaceAutomacoesBpm(),
    ListarCatalogosAutomacoesBpm(),
    ListarTemplatesAutomacoesBpm(),
    ListarMonitoramentoAutomacoesCentraisBpm(),
    ListarWorkspaceChecklistsBpm(),
    db.bpmPipeline.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        etapas: {
          where: { ativo: true },
          orderBy: { ordem: "asc" },
          select: { id: true, nome: true, ordem: true, script: true },
        },
      },
    }),
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
    !transicoesResult.success ? "transições" : null,
    !slaResult.success ? "SLA" : null,
    !servicosComerciais ? "serviços comerciais" : null,
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
      automacoesContent={
        <div className="space-y-6">
          {monitorAutomacoesResult.success && (
            <MotorCentralPanel
              monitor={monitorAutomacoesResult.data}
              pipelines={automacoesResult.data}
              accent={visual.accent}
            />
          )}
          <AutomacoesWorkspace
            pipelines={automacoesResult.data}
            catalogos={catalogosAutomacoesResult.data}
            templates={templatesAutomacoesResult.data}
            erro={
              automacoesResult.success
                ? catalogosAutomacoesResult.success
                  ? templatesAutomacoesResult.success
                    ? null
                    : templatesAutomacoesResult.error
                  : catalogosAutomacoesResult.error
                : automacoesResult.error
            }
            accent={visual.accent}
          />
        </div>
      }
      checklistsContent={
        <ChecklistsWorkspace
          workspace={checklistsResult.data}
          erro={checklistsResult.success ? null : checklistsResult.error}
          accent={visual.accent}
        />
      }
      conhecimentoContent={
        <ConhecimentoWorkspace
          pipelines={pipelinesComplementares}
          accent={visual.accent}
        />
      }
      cadenciasContent={
        <CadenciasWorkspace
          cadencias={cadenciasResult.success ? cadenciasResult.data : []}
          pipelines={pipelinesComplementares.map((pipeline) => ({
            id: pipeline.id,
            nome: pipeline.nome,
            etapas: pipeline.etapas.map(({ id, nome }) => ({ id, nome })),
          }))}
          erro={
            cadenciasResult.success
              ? null
              : typeof cadenciasResult.error === "string"
                ? cadenciasResult.error
                : "Erro ao carregar cadências"
          }
          accent={visual.accent}
        />
      }
      cadenciasIniciais={cadenciasResult.data}
      visual={visual}
    />
  );
}
