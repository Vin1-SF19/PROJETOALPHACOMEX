"use server";

import { revalidatePath } from "next/cache";

import { auth } from "../../../auth";
import {
  formularioEtapaSemAlteracao,
  listarCapabilitiesInvalidasParaEtapa,
  salvarFormularioEtapaSchema,
  type SalvarFormularioEtapaInput,
} from "@/lib/bpm/formularios-etapa";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import db from "@/lib/prisma";
import { avancarConfigVersionBpm } from "@/lib/bpm/config-version";

const formularioInclude = {
  secoes: {
    orderBy: { ordem: "asc" as const },
    include: {
      componentes: {
        orderBy: { ordem: "asc" as const },
        include: { campo: { select: { id: true, nome: true, tipo: true } } },
      },
    },
  },
};

function falhar(codigo: string, mensagem: string): never {
  throw new Error(`${codigo}: ${mensagem}`);
}

function componentesDoFormulario(input: SalvarFormularioEtapaInput) {
  return input.secoes.flatMap((secao) => secao.componentes);
}

function mensagemCampo(
  codigo: string,
  nome: string,
  etapaNome: string,
  motivo: string,
): never {
  return falhar(
    codigo,
    `Campo "${nome}" inválido na etapa "${etapaNome}": ${motivo}.`,
  );
}

export async function SalvarFormularioEtapaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return { success: false, error: "Não autorizado" } as const;

    const parsed = salvarFormularioEtapaSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.flatten() } as const;

    const userId = Number(session.user.id);
    if (!Number.isSafeInteger(userId) || userId <= 0)
      return { success: false, error: "Não autorizado" } as const;

    await exigirAcessoConfigPipeline(userId, "configurarCampos");
    const { pipelineId, etapaId, versaoEsperada, ativo, secoes, obrigacoes = [] } = parsed.data;

    const resultado = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCampos", tx);
      const etapa = await tx.bpmEtapa.findFirst({
        where: { id: etapaId, pipelineId },
        select: {
          id: true,
          nome: true,
          capabilitiesJson: true,
          formulario: {
            include: {
              secoes: {
                include: { componentes: true },
                orderBy: { ordem: "asc" },
              },
            },
          },
        },
      });
      if (!etapa)
        falhar(
          "ETAPA_FORA_PIPELINE",
          "A etapa informada não pertence ao pipeline.",
        );

      const anterior = etapa.formulario;
      if (anterior && versaoEsperada !== anterior.versao) {
        falhar(
          "CONFLITO_VERSAO_FORMULARIO",
          `O formulário da etapa "${etapa.nome}" foi alterado por outra sessão. Recarregue antes de salvar.`,
        );
      }
      if (!anterior && versaoEsperada !== null) {
        falhar(
          "CONFLITO_VERSAO_FORMULARIO",
          `O estado inicial do formulário da etapa "${etapa.nome}" mudou. Recarregue antes de salvar.`,
        );
      }

      const componentes = componentesDoFormulario(parsed.data);
      const capabilityInvalida = listarCapabilitiesInvalidasParaEtapa(
        componentes,
        etapa.capabilitiesJson,
      )[0];
      if (capabilityInvalida) {
        falhar(
          "CAPABILITY_FORA_ETAPA",
          `Capability "${capabilityInvalida}" não está habilitada na etapa "${etapa.nome}".`,
        );
      }

      const campoIds = [
        ...new Set(
          componentes.flatMap((componente) =>
            componente.tipo === "CAMPO" && componente.campoId
              ? [componente.campoId]
              : [],
          ),
        ),
      ];
      const campos = campoIds.length
        ? await tx.bpmCampo.findMany({
            where: { id: { in: campoIds } },
            select: {
              id: true,
              nome: true,
              ativo: true,
              pipelineId: true,
              etapaConfiguracoes: {
                where: { etapaId },
                select: { id: true, visivel: true, editavel: true, somenteLeitura: true, obrigatorio: true, obrigatorioEntrada: true, obrigatorioSaida: true, condicaoObrigatoriedadeJson: true },
              },
              pipelinesAssociados: {
                where: { pipelineId },
                select: { id: true },
              },
            },
          })
        : [];
      const campoPorId = new Map(campos.map((campo) => [campo.id, campo]));
      for (const campoId of campoIds) {
        const campo = campoPorId.get(campoId);
        if (!campo)
          mensagemCampo(
            "CAMPO_FORA_FORMULARIO_ETAPA",
            campoId,
            etapa.nome,
            "o campo não existe",
          );
        if (!campo.ativo)
          mensagemCampo(
            "CAMPO_FORA_FORMULARIO_ETAPA",
            campo.nome,
            etapa.nome,
            "o campo está inativo",
          );
        if (
          campo.pipelineId !== pipelineId &&
          campo.pipelinesAssociados.length === 0
        ) {
          mensagemCampo(
            "CAMPO_FORA_FORMULARIO_ETAPA",
            campo.nome,
            etapa.nome,
            "o campo não pertence ao catálogo deste pipeline",
          );
        }
        const configuracao = campo.etapaConfiguracoes[0];
        if (!configuracao)
          mensagemCampo(
            "CAMPO_FORA_FORMULARIO_ETAPA",
            campo.nome,
            etapa.nome,
            "não existe BpmCampoEtapaConfig correspondente",
          );
        if (!configuracao.visivel)
          mensagemCampo(
            "CAMPO_FORA_FORMULARIO_ETAPA",
            campo.nome,
            etapa.nome,
            "a configuração canônica marca o campo como não visível",
          );
      }

      for (const obrigacao of obrigacoes) {
        const campo = campoPorId.get(obrigacao.campoId);
        if (!campo) falhar("OBRIGACAO_FORA_FORMULARIO", "Uma obrigação aponta para campo ausente do formulário da etapa.");
        const config = campo.etapaConfiguracoes[0];
        if ((obrigacao.obrigatorio || obrigacao.obrigatorioEntrada || obrigacao.obrigatorioSaida || obrigacao.condicaoObrigatoriedadeJson)
          && (!ativo || !campo.ativo || !config?.visivel || !config.editavel || config.somenteLeitura)) {
          falhar("OBRIGACAO_CAMPO_INACESSIVEL", `O campo "${campo.nome}" precisa estar ativo, visível e editável para ser obrigatório.`);
        }
      }
      const referenciasCondicionais = new Set<string>();
      const visitarCondicao = (item: unknown): void => {
        if (!item || typeof item !== "object") return;
        const objeto = item as Record<string, unknown>;
        const campo = objeto.campo as Record<string, unknown> | undefined;
        if (campo?.fonte === "campo_dinamico" && typeof campo.campo === "string") referenciasCondicionais.add(campo.campo);
        if (Array.isArray(objeto.condicoes)) objeto.condicoes.forEach(visitarCondicao);
      };
      for (const obrigacao of obrigacoes) {
        if (obrigacao.condicaoObrigatoriedadeJson) visitarCondicao(JSON.parse(obrigacao.condicaoObrigatoriedadeJson));
      }
      const referenciasExternas = [...referenciasCondicionais].filter((id) => !campoIds.includes(id));
      if (referenciasExternas.length) {
        const publicados = await tx.bpmCampo.findMany({
          where: {
            id: { in: referenciasExternas }, ativo: true,
            OR: [{ pipelineId }, { pipelinesAssociados: { some: { pipelineId } } }],
            componentesFormulario: { some: { secao: { formulario: { ativo: true, etapa: { pipelineId } } } } },
          },
          select: { id: true },
        });
        if (publicados.length !== referenciasExternas.length) {
          falhar("CONDICAO_CAMPO_NAO_PUBLICADO", "A condição usa um campo que não está ativo e publicado neste pipeline.");
        }
      }

      const idsAnteriores = (anterior?.secoes ?? []).flatMap((secao) => secao.componentes
        .filter((componente) => componente.tipo === "CAMPO" && componente.campoId)
        .map((componente) => componente.campoId!));
      const idsRemovidos = [...new Set(idsAnteriores.filter((id) => !campoIds.includes(id)))];
      const limparTodaEtapa = !ativo || campoIds.length === 0;
      const obrigatoriasParaLimpar = limparTodaEtapa || idsRemovidos.length
        ? await tx.bpmCampoEtapaConfig.findMany({
          where: {
            etapaId,
            ...(limparTodaEtapa ? {} : { campoId: { in: idsRemovidos } }),
            OR: [{ obrigatorio: true }, { obrigatorioEntrada: true }, { obrigatorioSaida: true }, { condicaoObrigatoriedadeJson: { not: null } }],
          },
          select: { campoId: true },
        }) : [];

      const secoesExistentes = new Map(
        (anterior?.secoes ?? []).map((secao) => [secao.id, secao]),
      );
      const componentesExistentes = new Map(
        (anterior?.secoes ?? []).flatMap((secao) =>
          secao.componentes.map(
            (componente) => [componente.id, componente] as const,
          ),
        ),
      );

      for (const secao of secoes) {
        if (secao.id) {
          const existente = secoesExistentes.get(secao.id);
          if (!existente)
            falhar(
              "SECAO_FORA_FORMULARIO",
              `A seção "${secao.id}" não pertence ao formulário da etapa "${etapa.nome}".`,
            );
          if (existente.chave !== secao.chave)
            falhar(
              "IDENTIDADE_SECAO_INCOMPATIVEL",
              `A chave da seção "${existente.titulo}" não pode ser trocada durante a reconciliação.`,
            );
        } else if (
          [...secoesExistentes.values()].some(
            (existente) => existente.chave === secao.chave,
          )
        ) {
          falhar(
            "CHAVE_SECAO_EM_USO",
            `A chave de seção "${secao.chave}" já pertence a outra identidade.`,
          );
        }

        for (const componente of secao.componentes) {
          if (!componente.id) continue;
          const existente = componentesExistentes.get(componente.id);
          if (!existente)
            falhar(
              "COMPONENTE_FORA_FORMULARIO",
              `O componente "${componente.id}" não pertence ao formulário da etapa "${etapa.nome}".`,
            );
          if (existente.chave !== componente.chave)
            falhar(
              "IDENTIDADE_COMPONENTE_INCOMPATIVEL",
              `A chave do componente "${existente.chave}" não pode ser trocada durante a reconciliação.`,
            );
          if (
            existente.tipo !== componente.tipo ||
            existente.campoId !== componente.campoId ||
            existente.capability !== componente.capability
          ) {
            falhar(
              "IDENTIDADE_COMPONENTE_INCOMPATIVEL",
              `O tipo ou target do componente "${existente.chave}" não pode ser substituído durante uma edição normal.`,
            );
          }
        }
      }

      if (
        anterior &&
        formularioEtapaSemAlteracao(anterior, { ativo, secoes }) &&
        obrigatoriasParaLimpar.length === 0 &&
        obrigacoes.every((item) => {
          const config = campoPorId.get(item.campoId)?.etapaConfiguracoes[0];
          return config?.obrigatorio === item.obrigatorio
            && config?.obrigatorioEntrada === item.obrigatorioEntrada
            && config?.obrigatorioSaida === item.obrigatorioSaida
            && (config?.condicaoObrigatoriedadeJson ?? null) === (item.condicaoObrigatoriedadeJson ?? null);
        })
      ) {
        const formulario = await tx.bpmEtapaFormulario.findUniqueOrThrow({
          where: { id: anterior.id },
          include: formularioInclude,
        });
        return { formulario, alterado: false };
      }

      let formularioId: string;
      if (anterior) {
        const cas = await tx.bpmEtapaFormulario.updateMany({
          where: { id: anterior.id, versao: versaoEsperada ?? -1 },
          data: { ativo, versao: { increment: 1 } },
        });
        if (cas.count !== 1)
          falhar(
            "CONFLITO_VERSAO_FORMULARIO",
            `O formulário da etapa "${etapa.nome}" mudou durante o salvamento. Recarregue e tente novamente.`,
          );
        formularioId = anterior.id;
      } else {
        const criado = await tx.bpmEtapaFormulario.create({
          data: { etapaId, ativo },
        });
        formularioId = criado.id;
      }

      const idsComponentesRecebidos = new Set(
        componentes.flatMap((componente) =>
          componente.id ? [componente.id] : [],
        ),
      );
      const idsComponentesRemovidos = [...componentesExistentes.keys()].filter(
        (id) => !idsComponentesRecebidos.has(id),
      );
      if (idsComponentesRemovidos.length) {
        await tx.bpmFormularioComponente.deleteMany({
          where: { id: { in: idsComponentesRemovidos } },
        });
      }

      const secaoIdPorIndice = new Map<number, string>();
      for (const [ordem, secao] of secoes.entries()) {
        if (secao.id) {
          await tx.bpmFormularioSecao.update({
            where: { id: secao.id },
            data: { titulo: secao.titulo, ordem },
          });
          secaoIdPorIndice.set(ordem, secao.id);
        } else {
          const criada = await tx.bpmFormularioSecao.create({
            data: {
              formularioId,
              chave: secao.chave,
              titulo: secao.titulo,
              ordem,
            },
          });
          secaoIdPorIndice.set(ordem, criada.id);
        }
      }

      for (const [ordemSecao, secao] of secoes.entries()) {
        const secaoId = secaoIdPorIndice.get(ordemSecao);
        if (!secaoId)
          falhar(
            "RECONCILIACAO_SECAO_FALHOU",
            `Não foi possível resolver a seção "${secao.titulo}".`,
          );
        for (const [ordem, componente] of secao.componentes.entries()) {
          const data = {
            secaoId,
            tipo: componente.tipo,
            campoId:
              componente.tipo === "CAMPO" ? componente.campoId : null,
            capability:
              componente.tipo === "CAMPO" ? null : componente.capability,
            configJson: componente.configJson,
            ordem,
          };
          if (componente.id) {
            await tx.bpmFormularioComponente.update({
              where: { id: componente.id },
              data,
            });
          } else {
            await tx.bpmFormularioComponente.create({
              data: { ...data, chave: componente.chave },
            });
          }
        }
      }

      const idsSecoesRecebidas = new Set(
        secoes.flatMap((secao) => (secao.id ? [secao.id] : [])),
      );
      const idsSecoesRemovidas = [...secoesExistentes.keys()].filter(
        (id) => !idsSecoesRecebidas.has(id),
      );
      if (idsSecoesRemovidas.length) {
        await tx.bpmFormularioSecao.deleteMany({
          where: { id: { in: idsSecoesRemovidas } },
        });
      }

      for (const obrigacao of obrigacoes) {
        const atualizada = await tx.bpmCampoEtapaConfig.updateMany({
          where: { campoId: obrigacao.campoId, etapaId },
          data: {
            obrigatorio: obrigacao.obrigatorio,
            obrigatorioEntrada: obrigacao.obrigatorioEntrada,
            obrigatorioSaida: obrigacao.obrigatorioSaida,
            condicaoObrigatoriedadeJson: obrigacao.condicaoObrigatoriedadeJson ?? null,
          },
        });
        if (atualizada.count !== 1) falhar("OBRIGACAO_CONFIG_AUSENTE", "A configuração do campo mudou. Recarregue o formulário antes de publicar.");
      }
      if (obrigatoriasParaLimpar.length) {
        await tx.bpmCampoEtapaConfig.updateMany({
          where: { etapaId, campoId: { in: obrigatoriasParaLimpar.map((item) => item.campoId) } },
          data: { obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false, condicaoObrigatoriedadeJson: null },
        });
      }

      const formulario = await tx.bpmEtapaFormulario.findUniqueOrThrow({
        where: { id: formularioId },
        include: formularioInclude,
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId,
          adminId: userId,
          campoAlterado: "formulario_etapa",
          valorAnteriorJson: anterior ? JSON.stringify(anterior) : null,
          valorNovoJson: JSON.stringify(formulario),
        },
      });
      await avancarConfigVersionBpm(tx, pipelineId);
      return { formulario, alterado: true };
    });

    revalidatePath(`/PainelAlpha/AlphaCRM/admin/pipelines/${pipelineId}`);
    revalidatePath(`/PainelAlpha/AlphaCRM/pipeline/${pipelineId}`);
    if (resultado.alterado) {
      try {
        await notificarPipelineBpm({
          pipelineId,
          tipo: "PIPELINE_ALTERADO",
        });
      } catch (error) {
        console.error("[SalvarFormularioEtapaBpm:notificacao]", error);
      }
    }
    return { success: true, data: resultado.formulario } as const;
  } catch (error) {
    const mensagem =
      error instanceof Error &&
      /^(ETAPA_FORA_PIPELINE|CAMPO_FORA_FORMULARIO_ETAPA|CAPABILITY_FORA_ETAPA|CONFLITO_VERSAO_FORMULARIO|SECAO_FORA_FORMULARIO|COMPONENTE_FORA_FORMULARIO|IDENTIDADE_SECAO_INCOMPATIVEL|IDENTIDADE_COMPONENTE_INCOMPATIVEL|CHAVE_SECAO_EM_USO|RECONCILIACAO_SECAO_FALHOU|OBRIGACAO_FORA_FORMULARIO|OBRIGACAO_CAMPO_INACESSIVEL|OBRIGACAO_CONFIG_AUSENTE):/.test(
        error.message,
      )
        ? error.message
        : "Erro ao salvar formulário da etapa";
    if (mensagem === "Erro ao salvar formulário da etapa")
      console.error("[SalvarFormularioEtapaBpm]", error);
    return { success: false, error: mensagem } as const;
  }
}
