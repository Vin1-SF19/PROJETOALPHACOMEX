import { auth } from "../../../../../auth";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/prisma";
import { buscarParceiro, getPermissaoParceiros } from "@/actions/parceiros";
import { getTemplateParadaoParceiro } from "@/actions/onboarding";
import { ObterIndicadoresDesenvolvimentoParceiro, ListarHistoricoParceiro } from "@/actions/parceiros-desenvolvimento";
import { ListarIndicacoesDoParceiro } from "@/actions/parceiros-indicacoes";
import { ListarTarefasParceiro } from "@/actions/parceiros-tarefas";
import DetalheParceiroClient, { type DetalheParceiro } from "@/components/Parceiros/DetalheParceiroClient";

export const dynamic = "force-dynamic";

export default async function DetalheParceiroPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { id } = await params;
  const parceiroId = Number(id);
  const userId = Number((session.user as { id?: string | number }).id ?? 0);

  const [parceiroRaw, permissao, rec, template, relacionamento, indicadores, historico, indicacoesFunil, tarefas] = await Promise.all([
    buscarParceiro(parceiroId),
    getPermissaoParceiros(),
    userId ? db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } }) : null,
    getTemplateParadaoParceiro(),
    // Fase 07 (tela 360º) — campos de Desenvolvimento (Fase 01) não fazem parte do tipo
    // `DetalheParceiro` legado; buscados à parte para não mexer no cast já existente.
    db.parceiro.findUnique({
      where: { id: parceiroId },
      select: {
        estagioDesenvolvimento: true,
        potencialRecorrencia: true,
        segmento: true,
        origem: true,
        proximaAcaoEm: true,
        proximaAcaoDescricao: true,
        responsavel: { select: { nome: true } },
      },
    }),
    ObterIndicadoresDesenvolvimentoParceiro(parceiroId),
    ListarHistoricoParceiro(parceiroId),
    ListarIndicacoesDoParceiro(parceiroId),
    ListarTarefasParceiro(parceiroId),
  ]);
  if (!parceiroRaw) notFound();

  const parceiro = parceiroRaw as unknown as DetalheParceiro;
  const temaName = rec?.tema_interface ?? "blue";

  return (
    <DetalheParceiroClient
      parceiro={parceiro}
      permissao={permissao}
      temaName={temaName}
      template={template}
      relacionamento360={{
        estagioDesenvolvimento: relacionamento?.estagioDesenvolvimento ?? "NOVO",
        potencialRecorrencia: relacionamento?.potencialRecorrencia ?? null,
        segmento: relacionamento?.segmento ?? null,
        origem: relacionamento?.origem ?? null,
        proximaAcaoEm: relacionamento?.proximaAcaoEm ?? null,
        proximaAcaoDescricao: relacionamento?.proximaAcaoDescricao ?? null,
        responsavelNome: relacionamento?.responsavel?.nome ?? null,
        indicadores,
        historico: historico.success ? historico.historico : [],
        indicacoesFunil: indicacoesFunil.success ? indicacoesFunil.indicacoes : [],
      }}
      tarefasIniciais={tarefas.success ? tarefas.tarefas : []}
    />
  );
}
