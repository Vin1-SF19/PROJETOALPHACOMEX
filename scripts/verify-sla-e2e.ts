import assert from "node:assert/strict";

import db from "../src/lib/prisma";
import { materializarExecucoesEventosBpm } from "../src/lib/bpm/automacoes/eventos";
import { processarFilaAutomacoesCentraisBpm } from "../src/lib/bpm/automacoes/central-runtime";
import {
  criarSlaInstancia,
  obterStatusSla,
  sincronizarSlaMovimentoBpm,
} from "../src/lib/bpm/sla";

async function main() {
  if (!process.env.TURSO_DATABASE_URL?.startsWith("file:")) {
    throw new Error("Este smoke só pode rodar em banco local file:.");
  }

  const usuario = await db.usuarios.create({
    data: {
      nome: "Operador SLA E2E",
      usuario: "sla-e2e",
      email: "sla-e2e@example.invalid",
      senha: "nao-utilizada",
      role: "Admin",
    },
  });
  const empresa = await db.cliente.create({
    data: { razaoSocial: "Empresa SLA E2E", nomeFantasia: "SLA E2E" },
  });
  const pipeline = await db.bpmPipeline.create({ data: { nome: "Pipeline SLA E2E" } });
  const [etapaAtiva, etapaStandby, etapaDestino] = await Promise.all([
    db.bpmEtapa.create({ data: { pipelineId: pipeline.id, nome: "Fiscal", ordem: 1 } }),
    db.bpmEtapa.create({ data: { pipelineId: pipeline.id, nome: "Standby - Follow Up", ordem: 2 } }),
    db.bpmEtapa.create({ data: { pipelineId: pipeline.id, nome: "Concluído", ordem: 3 } }),
  ]);
  const criarCard = () => db.bpmCard.create({
    data: {
      empresaId: empresa.id,
      pipelineId: pipeline.id,
      etapaId: etapaAtiva.id,
      responsavelId: usuario.id,
      servico: "Fiscal",
    },
  });
  const [cardAutomacao, cardPausa] = await Promise.all([criarCard(), criarCard()]);

  const config = await db.bpmSlaConfig.create({
    data: {
      pipelineId: pipeline.id,
      etapaId: etapaAtiva.id,
      criadoPorId: usuario.id,
      nome: "SLA fiscal de 1 hora",
      quantidade: 1,
      unidade: "HORAS",
      inicioMomento: "ENTRADA_ETAPA",
      pausaCondicaoJson: JSON.stringify({ tipo: "ETAPA_STANDBY" }),
      retomadaCondicaoJson: JSON.stringify({ tipo: "SAIDA_STANDBY" }),
      alertaLimites: {
        create: [
          {
            nome: "Atenção",
            cor: "AMARELO",
            tipoLimite: "PERCENTUAL_CONSUMIDO",
            valor: 50,
            statusResultante: "PROXIMO_VENCIMENTO",
            ordem: 1,
          },
          {
            nome: "Vencido",
            cor: "VERMELHO",
            tipoLimite: "ATRASO",
            valor: 0,
            unidade: "MINUTOS",
            statusResultante: "ATRASADO",
            ordem: 2,
          },
        ],
      },
    },
  });

  const automacao = await db.bpmAutomacao.create({
    data: {
      nome: "Criar tarefa ao vencer SLA",
      pipelineId: pipeline.id,
      etapaId: etapaAtiva.id,
      gatilhoTipo: "SLA_STATUS_ALTERADO",
      acaoTipo: "CRIAR_TAREFA",
      parametrosJson: "{}",
      criadoPorId: usuario.id,
    },
  });
  await db.bpmAutomacaoVersao.create({
    data: {
      automacaoId: automacao.id,
      versao: 1,
      status: "ATIVA",
      gatilhoTipo: "SLA_STATUS_ALTERADO",
      gatilhoConfigJson: JSON.stringify({ slaStatus: "ATRASADO" }),
      grafoJson: JSON.stringify({
        inicioId: "criar-tarefa",
        nos: [
          {
            id: "criar-tarefa",
            tipo: "ACAO",
            acaoTipo: "CRIAR_TAREFA",
            parametros: {
              titulo: "Tratar SLA fiscal vencido",
              tipo: "TAREFA",
              prioridade: "ALTA",
              prazoMinutos: 30,
            },
            proximoId: "fim",
          },
          { id: "fim", tipo: "FIM" },
        ],
      }),
      criadoPorId: usuario.id,
      ativadaEm: new Date("2026-09-04T10:00:00.000Z"),
    },
  });

  const inicio = new Date("2026-09-04T10:00:00.000Z");
  const instancia = await db.$transaction((tx) =>
    criarSlaInstancia({ cardId: cardAutomacao.id }, "ENTRADA_ETAPA", tx, inicio),
  );
  assert(instancia, "A instância de SLA deveria ser criada.");

  const verde = await obterStatusSla({ cardId: cardAutomacao.id }, undefined, inicio);
  assert.equal(verde[0]?.status, "DENTRO_PRAZO");
  assert.equal(verde[0]?.cor, "VERDE");

  const amarelo = await obterStatusSla(
    { cardId: cardAutomacao.id },
    undefined,
    new Date("2026-09-04T10:30:00.000Z"),
  );
  assert.equal(amarelo[0]?.status, "PROXIMO_VENCIMENTO");
  assert.equal(amarelo[0]?.cor, "AMARELO");

  const vermelho = await obterStatusSla(
    { cardId: cardAutomacao.id },
    undefined,
    new Date("2026-09-04T11:00:01.000Z"),
  );
  assert.equal(vermelho[0]?.status, "ATRASADO");
  assert.equal(vermelho[0]?.cor, "VERMELHO");

  const materializacao = await materializarExecucoesEventosBpm(100);
  const fila = await processarFilaAutomacoesCentraisBpm(20);
  const tarefaAutomatica = await db.bpmTarefa.findFirst({
    where: { cardId: cardAutomacao.id, titulo: "Tratar SLA fiscal vencido" },
  });
  assert(tarefaAutomatica, "A automação deveria criar uma tarefa real no card.");

  const instanciaPausa = await db.$transaction((tx) =>
    criarSlaInstancia({ cardId: cardPausa.id }, "ENTRADA_ETAPA", tx, inicio),
  );
  assert(instanciaPausa?.deadline);
  const entrouStandbyEm = new Date("2026-09-04T10:15:00.000Z");
  await db.$transaction(async (tx) => {
    await tx.bpmCard.update({ where: { id: cardPausa.id }, data: { etapaId: etapaStandby.id } });
    await sincronizarSlaMovimentoBpm({
      cardId: cardPausa.id,
      etapaOrigemId: etapaAtiva.id,
      etapaOrigemNome: etapaAtiva.nome,
      etapaDestinoNome: etapaStandby.nome,
      client: tx,
      agora: entrouStandbyEm,
    });
  });
  const pausada = await db.bpmSlaInstancia.findUniqueOrThrow({ where: { id: instanciaPausa.id } });
  assert.equal(pausada.status, "PAUSADO");

  const retomouEm = new Date("2026-09-04T10:45:00.000Z");
  await db.$transaction(async (tx) => {
    await tx.bpmCard.update({ where: { id: cardPausa.id }, data: { etapaId: etapaDestino.id } });
    await sincronizarSlaMovimentoBpm({
      cardId: cardPausa.id,
      etapaOrigemId: etapaStandby.id,
      etapaOrigemNome: etapaStandby.nome,
      etapaDestinoNome: etapaDestino.nome,
      client: tx,
      agora: retomouEm,
    });
  });
  const retomada = await db.bpmSlaInstancia.findUniqueOrThrow({ where: { id: instanciaPausa.id } });
  assert.equal(retomada.status, "DENTRO_PRAZO");
  assert.equal(retomada.tempoPausadoAcumuladoMs, BigInt(30 * 60_000));
  assert.equal(retomada.deadline?.toISOString(), "2026-09-04T11:30:00.000Z");

  const [disparos, eventosSla, execucoes, tarefas] = await Promise.all([
    db.bpmSlaDisparo.count({ where: { instanciaId: instancia.id } }),
    db.bpmEventoDominio.count({ where: { cardId: cardAutomacao.id, tipo: "SLA_STATUS_ALTERADO" } }),
    db.bpmAutomacaoExecucao.count({ where: { automacaoId: automacao.id, status: "SUCESSO" } }),
    db.bpmTarefa.count({ where: { cardId: cardAutomacao.id } }),
  ]);
  assert.equal(disparos, 2);
  assert.equal(eventosSla, 2);
  assert.equal(execucoes, 1);
  assert.equal(tarefas, 1);

  console.log(JSON.stringify({
    success: true,
    status: [verde[0]?.status, amarelo[0]?.status, vermelho[0]?.status],
    cores: [verde[0]?.cor, amarelo[0]?.cor, vermelho[0]?.cor],
    pausaMs: retomada.tempoPausadoAcumuladoMs.toString(),
    deadlineRetomado: retomada.deadline?.toISOString(),
    disparos,
    eventosSla,
    materializacao,
    fila,
    execucoes,
    tarefas,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
