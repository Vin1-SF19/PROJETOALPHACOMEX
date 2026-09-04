"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  atualizarCampoSchema,
  configurarMapeamentoCampoSchema,
  criarCampoSchema,
  excluirCampoSchema,
} from "@/lib/validations/bpm";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  chaveOpcaoCampo,
  fonteCampoPermitida,
  mapeamentoCriariaCiclo,
  type MapeamentoCampo,
} from "@/lib/bpm/campos-configuraveis";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

type OpcaoEntrada = string | {
  id?: string;
  chave: string;
  rotulo: string;
  ordem: number;
  ativo?: boolean;
};

const PERFIS_CAMPO = ["ADMIN", "RESPONSAVEL", "MEMBRO"] as const;

function acessosPadrao({
  visivel,
  editavel,
  somenteLeitura,
  obrigatorio,
}: {
  visivel: boolean;
  editavel: boolean;
  somenteLeitura: boolean;
  obrigatorio: boolean;
}) {
  return PERFIS_CAMPO.map((perfil) => ({
    perfil,
    visivel,
    editavel: somenteLeitura ? false : editavel,
    somenteLeitura,
    obrigatorio,
  }));
}

function opcoesEstruturadas(opcoes: readonly OpcaoEntrada[] = []) {
  const usadas = new Set<string>();
  return opcoes.map((opcao, ordem) => {
    const rotulo = typeof opcao === "string" ? opcao.trim() : opcao.rotulo.trim();
    const raiz = typeof opcao === "string" ? chaveOpcaoCampo(rotulo) : opcao.chave;
    let chave = raiz;
    let sufixo = 2;
    while (usadas.has(chave)) chave = `${raiz}-${sufixo++}`;
    usadas.add(chave);
    return {
      id: typeof opcao === "string" ? undefined : opcao.id,
      chave,
      rotulo,
      ordem: typeof opcao === "string" ? ordem : opcao.ordem,
      ativo: typeof opcao === "string" ? true : (opcao.ativo ?? true),
    };
  });
}

function mensagemErro(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes("administradores") || error.message.startsWith("CAMPO_")) {
    return error.message.replace(/^CAMPO_[A-Z_]+:\s*/, "");
  }
  return fallback;
}

function validarCondicoesEtapas(
  configuracoes: readonly {
    condicaoVisibilidadeJson?: string | null;
    condicaoObrigatoriedadeJson?: string | null;
  }[] | undefined,
) {
  for (const config of configuracoes ?? []) {
    for (const [nome, bruto] of [
      ["visibilidade", config.condicaoVisibilidadeJson],
      ["obrigatoriedade", config.condicaoObrigatoriedadeJson],
    ] as const) {
      if (!bruto?.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(bruto);
      } catch {
        throw new Error(`CAMPO_CONDICAO_INVALIDA: Condição de ${nome} não contém JSON válido`);
      }
      if (!grupoCondicaoSchema.safeParse(parsed).success) {
        throw new Error(`CAMPO_CONDICAO_INVALIDA: Condição de ${nome} não segue o formato do Motor de Regras`);
      }
    }
  }
}

async function notificarPipelines(pipelineIds: readonly string[]) {
  for (const pipelineId of [...new Set(pipelineIds)]) {
    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    await notificarPipelineBpm({ pipelineId, tipo: "CAMPO_ALTERADO" });
  }
}

async function validarDimensoesCampo(
  tx: typeof db,
  pipelineId: string,
  pipelineIds: readonly string[],
  etapaIds: readonly string[],
) {
  const idsPipeline = [...new Set([pipelineId, ...pipelineIds])];
  const [pipelines, etapas] = await Promise.all([
    tx.bpmPipeline.findMany({ where: { id: { in: idsPipeline } }, select: { id: true } }),
    etapaIds.length
      ? tx.bpmEtapa.findMany({ where: { id: { in: [...new Set(etapaIds)] } }, select: { id: true, pipelineId: true } })
      : Promise.resolve([]),
  ]);
  if (pipelines.length !== idsPipeline.length) throw new Error("CAMPO_PIPELINE_INVALIDO: Pipeline informado não existe");
  if (etapas.length !== new Set(etapaIds).size) throw new Error("CAMPO_ETAPA_INVALIDA: Etapa informada não existe");
  if (etapas.some((etapa) => !idsPipeline.includes(etapa.pipelineId))) {
    throw new Error("CAMPO_ETAPA_PIPELINE: Toda etapa deve pertencer a um pipeline selecionado");
  }
  return idsPipeline;
}

export async function ListarCamposConfiguraveisBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarCampos");

    const campos = await db.bpmCampo.findMany({
      where: {
        OR: [
          { pipelineId },
          { pipelinesAssociados: { some: { pipelineId } } },
        ],
      },
      include: {
        opcoes: { orderBy: { ordem: "asc" } },
        pipelinesAssociados: true,
        etapaConfiguracoes: true,
        acessos: true,
        mapeamentoDestino: true,
      },
      orderBy: [{ ativo: "desc" }, { ordem: "asc" }],
    });
    return { success: true, data: campos };
  } catch (error) {
    console.error("[ListarCamposConfiguraveisBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao listar campos"), data: [] };
  }
}

export async function CriarCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");

    const parsed = criarCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const entrada = parsed.data;
    validarCondicoesEtapas(entrada.etapaConfiguracoes);
    if (entrada.escopo === "GLOBAL" && entrada.fonteEntidade && !fonteCampoPermitida(entrada.fonteEntidade, entrada.fonteAtributo)) {
      return { success: false, error: "Fonte ou atributo canônico não permitido" };
    }
    const opcoes = opcoesEstruturadas(entrada.opcoes);
    const etapaIds = [entrada.etapaId, ...(entrada.etapaConfiguracoes ?? []).map((item) => item.etapaId)].filter((id): id is string => Boolean(id));

    const { campo, pipelineIds } = await db.$transaction(async (tx) => {
      const todosPipelines = await validarDimensoesCampo(tx as typeof db, entrada.pipelineId, entrada.pipelineIds ?? [], etapaIds);
      const criado = await tx.bpmCampo.create({
        data: {
          pipelineId: entrada.pipelineId,
          chave: entrada.chave,
          etapaId: entrada.etapaId,
          nome: entrada.nome,
          tipo: entrada.tipo,
          opcoesJson: opcoes.length ? JSON.stringify(opcoes.filter((item) => item.ativo).map((item) => item.rotulo)) : null,
          obrigatorio: entrada.obrigatorio,
          ordem: entrada.ordem,
          ativo: entrada.ativo,
          escopo: entrada.escopo,
          valorPadrao: entrada.valorPadrao,
          fonteEntidade: entrada.escopo === "GLOBAL" ? entrada.fonteEntidade : null,
          fonteAtributo: entrada.escopo === "GLOBAL" ? entrada.fonteAtributo : null,
          entidadeGlobal: entrada.escopo === "GLOBAL" && !entrada.fonteEntidade ? (entrada.entidadeGlobal ?? "CLIENTE") : null,
          visivel: entrada.visivel,
          editavel: entrada.somenteLeitura ? false : entrada.editavel,
          somenteLeitura: entrada.somenteLeitura,
        },
      });
      if (opcoes.length) await tx.bpmCampoOpcao.createMany({ data: opcoes.map((item) => ({
        campoId: criado.id,
        chave: item.chave,
        rotulo: item.rotulo,
        ordem: item.ordem,
        ativo: item.ativo,
      })) });
      await tx.bpmCampoPipeline.createMany({ data: todosPipelines.map((id) => ({ campoId: criado.id, pipelineId: id })) });
      if (entrada.etapaConfiguracoes?.length) {
        await tx.bpmCampoEtapaConfig.createMany({ data: entrada.etapaConfiguracoes.map((item) => ({ ...item, campoId: criado.id, editavel: item.somenteLeitura ? false : item.editavel })) });
      }
      const acessos = entrada.acessos?.length
        ? entrada.acessos
        : acessosPadrao({
            visivel: entrada.visivel,
            editavel: entrada.editavel,
            somenteLeitura: entrada.somenteLeitura,
            obrigatorio: entrada.obrigatorio,
          });
      await tx.bpmCampoAcesso.createMany({ data: acessos.map((item) => ({ ...item, campoId: criado.id, editavel: item.somenteLeitura ? false : item.editavel })) });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: entrada.pipelineId,
          adminId: userId,
          campoAlterado: "campo_criado_v2",
          valorNovoJson: JSON.stringify({ campoId: criado.id, tipo: entrada.tipo, escopo: entrada.escopo, pipelineIds: todosPipelines }),
        },
      });
      return { campo: criado, pipelineIds: todosPipelines };
    });

    await notificarPipelines(pipelineIds);
    return { success: true, data: campo };
  } catch (error) {
    console.error("[CriarCampoBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao criar campo") };
  }
}

function valorUsaOpcao(valor: string | null, chaves: Set<string>) {
  if (!valor) return false;
  if (chaves.has(valor)) return true;
  try {
    const parsed: unknown = JSON.parse(valor);
    return Array.isArray(parsed) && parsed.some((item) => typeof item === "string" && chaves.has(item));
  } catch { return false; }
}

export async function AtualizarCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");

    const parsed = atualizarCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const entrada = parsed.data;
    validarCondicoesEtapas(entrada.etapaConfiguracoes);

    const anterior = await db.bpmCampo.findUnique({
      where: { id: entrada.campoId },
      include: { valores: { select: { valor: true } }, opcoes: true, pipelinesAssociados: true },
    });
    if (!anterior) return { success: false, error: "Campo não encontrado" };
    const escopoFinal = entrada.escopo ?? anterior.escopo;
    const entidadeFinal = entrada.fonteEntidade === undefined ? anterior.fonteEntidade : entrada.fonteEntidade;
    const atributoFinal = entrada.fonteAtributo === undefined ? anterior.fonteAtributo : entrada.fonteAtributo;
    const entidadeGlobalFinal = entrada.entidadeGlobal === undefined ? anterior.entidadeGlobal : entrada.entidadeGlobal;
    if (escopoFinal === "GLOBAL" && entidadeFinal && !fonteCampoPermitida(entidadeFinal, atributoFinal)) {
      return { success: false, error: "Fonte ou atributo canônico não permitido" };
    }
    if (entrada.tipo && entrada.tipo !== anterior.tipo && anterior.valores.length > 0) {
      return { success: false, error: "Não é possível alterar o tipo de um campo que já possui valores" };
    }

    const novasOpcoes = entrada.opcoes === undefined ? undefined : opcoesEstruturadas(entrada.opcoes ?? []);
    if (novasOpcoes !== undefined) {
      const preservadas = new Set(novasOpcoes.flatMap((item) => [item.chave, item.rotulo]));
      const removidas = new Set(anterior.opcoes.filter((item) => !preservadas.has(item.chave)).flatMap((item) => [item.chave, item.rotulo]));
      if (removidas.size && anterior.valores.some((item) => valorUsaOpcao(item.valor, removidas))) {
        return { success: false, error: "Não é possível remover uma opção que já está em uso" };
      }
    }

    const pipelineIdsEntrada = entrada.pipelineIds ?? anterior.pipelinesAssociados.map((item) => item.pipelineId);
    const etapaIds = [entrada.etapaId, ...(entrada.etapaConfiguracoes ?? []).map((item) => item.etapaId)].filter((id): id is string => Boolean(id));
    const resultado = await db.$transaction(async (tx) => {
      const todosPipelines = await validarDimensoesCampo(tx as typeof db, anterior.pipelineId, pipelineIdsEntrada, etapaIds);
      const atualizado = await tx.bpmCampo.update({
        where: { id: entrada.campoId },
        data: {
          chave: entrada.chave,
          nome: entrada.nome,
          tipo: entrada.tipo,
          etapaId: entrada.etapaId,
          obrigatorio: entrada.obrigatorio,
          ordem: entrada.ordem,
          ativo: entrada.ativo,
          escopo: entrada.escopo,
          valorPadrao: entrada.valorPadrao,
          fonteEntidade: escopoFinal === "GLOBAL" ? entidadeFinal : null,
          fonteAtributo: escopoFinal === "GLOBAL" ? atributoFinal : null,
          entidadeGlobal: escopoFinal === "GLOBAL" && !entidadeFinal ? (entidadeGlobalFinal ?? "CLIENTE") : null,
          visivel: entrada.visivel,
          editavel: entrada.somenteLeitura ? false : entrada.editavel,
          somenteLeitura: entrada.somenteLeitura,
          opcoesJson: novasOpcoes === undefined ? undefined : (novasOpcoes.length ? JSON.stringify(novasOpcoes.filter((item) => item.ativo).map((item) => item.rotulo)) : null),
          configVersao: { increment: 1 },
        },
      });
      if (novasOpcoes !== undefined) {
        const chaves = novasOpcoes.map((item) => item.chave);
        await tx.bpmCampoOpcao.updateMany({ where: { campoId: entrada.campoId, chave: { notIn: chaves } }, data: { ativo: false } });
        for (const item of novasOpcoes) {
          await tx.bpmCampoOpcao.upsert({
            where: { campoId_chave: { campoId: entrada.campoId, chave: item.chave } },
            create: { campoId: entrada.campoId, chave: item.chave, rotulo: item.rotulo, ordem: item.ordem, ativo: item.ativo },
            update: { rotulo: item.rotulo, ordem: item.ordem, ativo: item.ativo },
          });
        }
      }
      if (entrada.pipelineIds) {
        await tx.bpmCampoPipeline.deleteMany({ where: { campoId: entrada.campoId } });
        await tx.bpmCampoPipeline.createMany({ data: todosPipelines.map((pipelineId) => ({ campoId: entrada.campoId, pipelineId })) });
      }
      if (entrada.etapaConfiguracoes) {
        await tx.bpmCampoEtapaConfig.deleteMany({ where: { campoId: entrada.campoId } });
        if (entrada.etapaConfiguracoes.length) await tx.bpmCampoEtapaConfig.createMany({ data: entrada.etapaConfiguracoes.map((item) => ({ ...item, campoId: entrada.campoId, editavel: item.somenteLeitura ? false : item.editavel })) });
      }
      if (entrada.acessos) {
        await tx.bpmCampoAcesso.deleteMany({ where: { campoId: entrada.campoId } });
        if (entrada.acessos.length) await tx.bpmCampoAcesso.createMany({ data: entrada.acessos.map((item) => ({ ...item, campoId: entrada.campoId, editavel: item.somenteLeitura ? false : item.editavel })) });
      }
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: anterior.pipelineId,
          adminId: userId,
          campoAlterado: "campo_atualizado_v2",
          valorAnteriorJson: JSON.stringify(anterior),
          valorNovoJson: JSON.stringify(entrada),
        },
      });
      return { atualizado, pipelineIds: todosPipelines };
    });

    await notificarPipelines(resultado.pipelineIds);
    return { success: true, data: resultado.atualizado };
  } catch (error) {
    console.error("[AtualizarCampoBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao atualizar campo") };
  }
}

/** Compatibilidade: "excluir" agora é desativação reversível e nunca apaga valores. */
export async function ExcluirCampoBpm(dados: unknown) {
  const parsed = excluirCampoSchema.safeParse(dados);
  if (!parsed.success) return { success: false, error: parsed.error.flatten() };
  return AtualizarCampoBpm({ campoId: parsed.data.campoId, ativo: false });
}

export async function AtivarDesativarCampoBpm(dados: unknown) {
  const entrada = dados as { campoId?: unknown; ativo?: unknown };
  const campo = excluirCampoSchema.safeParse({ campoId: entrada.campoId });
  if (!campo.success || typeof entrada.ativo !== "boolean") return { success: false, error: "Dados inválidos" };
  return AtualizarCampoBpm({ campoId: campo.data.campoId, ativo: entrada.ativo });
}

export async function ConfigurarMapeamentoCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");
    const parsed = configurarMapeamentoCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const entrada = parsed.data;

    const [origem, destino, existentes] = await Promise.all([
      db.bpmCampo.findUnique({ where: { id: entrada.campoOrigemId }, select: { id: true, pipelineId: true, tipo: true } }),
      db.bpmCampo.findUnique({ where: { id: entrada.campoDestinoId }, select: { id: true, pipelineId: true, tipo: true } }),
      db.bpmCampoMapeamento.findMany({ select: { campoOrigemId: true, campoDestinoId: true, modo: true, ativo: true } }),
    ]);
    if (!origem || !destino) return { success: false, error: "Campo de origem ou destino não encontrado" };
    if (origem.tipo !== destino.tipo) return { success: false, error: "Mapeamento exige campos do mesmo tipo" };
    if (mapeamentoCriariaCiclo(existentes as MapeamentoCampo[], entrada)) return { success: false, error: "O mapeamento criaria um ciclo" };

    const mapeamento = await db.$transaction(async (tx) => {
      const existentesAtuais = await tx.bpmCampoMapeamento.findMany({
        select: { campoOrigemId: true, campoDestinoId: true, modo: true, ativo: true },
      });
      if (mapeamentoCriariaCiclo(existentesAtuais as MapeamentoCampo[], entrada)) {
        throw new Error("CAMPO_MAPEAMENTO_CICLO: O mapeamento criaria um ciclo");
      }
      const salvo = await tx.bpmCampoMapeamento.upsert({
        where: { campoDestinoId: entrada.campoDestinoId },
        create: entrada,
        update: { campoOrigemId: entrada.campoOrigemId, modo: entrada.modo, ativo: entrada.ativo },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: destino.pipelineId,
          adminId: userId,
          campoAlterado: "campo_mapeamento",
          valorNovoJson: JSON.stringify(entrada),
        },
      });
      return salvo;
    });
    await notificarPipelines([origem.pipelineId, destino.pipelineId]);
    return { success: true, data: mapeamento };
  } catch (error) {
    console.error("[ConfigurarMapeamentoCampoBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao configurar mapeamento") };
  }
}

export async function DesativarMapeamentoCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");
    const entrada = dados as { campoDestinoId?: unknown };
    const parsed = excluirCampoSchema.safeParse({ campoId: entrada.campoDestinoId });
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const existente = await db.bpmCampoMapeamento.findUnique({
      where: { campoDestinoId: parsed.data.campoId },
      include: {
        campoOrigem: { select: { pipelineId: true } },
        campoDestino: { select: { pipelineId: true } },
      },
    });
    if (!existente || !existente.ativo) return { success: true };

    await db.$transaction(async (tx) => {
      await tx.bpmCampoMapeamento.update({
        where: { campoDestinoId: parsed.data.campoId },
        data: { ativo: false },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: existente.campoDestino.pipelineId,
          adminId: userId,
          campoAlterado: "campo_mapeamento_desativado",
          valorAnteriorJson: JSON.stringify(existente),
          valorNovoJson: JSON.stringify({ campoDestinoId: parsed.data.campoId, ativo: false }),
        },
      });
    });
    await notificarPipelines([existente.campoOrigem.pipelineId, existente.campoDestino.pipelineId]);
    return { success: true };
  } catch (error) {
    console.error("[DesativarMapeamentoCampoBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao desativar mapeamento") };
  }
}
