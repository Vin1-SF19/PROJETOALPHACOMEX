import "server-only";

import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { fonteCampoPermitida, type EntidadeFonteCampo } from "@/lib/bpm/campos-configuraveis";

type ClienteCamposCanonicos = typeof db | Prisma.TransactionClient;

export type CampoFonteCanonica = {
  id: string;
  escopo: string;
  fonteEntidade: string | null;
  fonteAtributo: string | null;
  entidadeGlobal?: string | null;
};

function serializarCanonico(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return String(valor);
}

export async function carregarValoresCanonicosCampos(
  cardId: string,
  campos: readonly CampoFonteCanonica[],
  client: ClienteCamposCanonicos = db,
): Promise<Record<string, string>> {
  const globais = campos.filter((campo) => campo.escopo === "GLOBAL" && (
    fonteCampoPermitida(campo.fonteEntidade, campo.fonteAtributo)
    || (!campo.fonteEntidade && (campo.entidadeGlobal ?? "CLIENTE") === "CLIENTE")
  ));
  if (!globais.length) return {};

  const card = await client.bpmCard.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      empresaId: true,
      servico: true,
      tipoProcesso: true,
      status: true,
      responsavelId: true,
      createdAt: true,
      empresa: {
        select: {
          id: true,
          cnpj: true,
          razaoSocial: true,
          nomeFantasia: true,
          uf: true,
          municipio: true,
          regimeTributario: true,
          status: true,
          pessoas: {
            where: { ativo: true },
            orderBy: [{ principal: "desc" }, { criadoEm: "asc" }, { id: "asc" }],
            select: {
              id: true,
              principal: true,
              vinculo: true,
              cargo: true,
              pessoa: { select: { id: true, nome: true, cpf: true, celular: true, email: true, telefoneExtra: true } },
            },
          },
        },
      },
      indicacaoOrigem: {
        select: {
          parceiro: { select: { id: true, documento: true, nome: true, nomeFantasia: true, email: true, telefone: true, segmento: true, ativo: true } },
        },
      },
    },
  });
  if (!card) return {};

  const precisaContrato = globais.some((campo) => campo.fonteEntidade === "CONTRATO");
  const precisaServico = globais.some((campo) => campo.fonteEntidade === "SERVICO");
  const precisaProcesso = globais.some((campo) => campo.fonteEntidade === "PROCESSO");
  const idsPersonalizados = globais.filter((campo) => !campo.fonteEntidade).map((campo) => campo.id);
  const [contrato, servico, processo, valoresPersonalizados] = await Promise.all([
    precisaContrato
      ? client.contratoComercial.findFirst({
          where: { clienteId: card.empresaId, arquivado: false, ...(card.servico ? { servico: card.servico } : {}) },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          select: { id: true, valorContrato: true, formaPagamento: true, servico: true, status: true, contratoUrl: true },
        })
      : null,
    precisaServico && card.servico
      ? client.servicosComerciais.findUnique({ where: { nome: card.servico }, select: { id: true, nome: true } })
      : null,
    precisaProcesso
      ? client.businessProcess.findFirst({
          where: { clienteId: card.empresaId },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          select: { id: true, status: true, dataInicio: true, dataProtocolo: true, dataExito: true, tentativas: true },
        })
      : null,
    idsPersonalizados.length
      ? client.bpmCampoValorGlobal.findMany({
          where: {
            campoId: { in: idsPersonalizados },
            entidadeTipo: "CLIENTE",
            entidadeId: String(card.empresaId),
          },
          select: { campoId: true, valor: true },
        })
      : [],
  ]);
  const personalizadoPorCampo = new Map(valoresPersonalizados.map((item) => [item.campoId, item.valor]));

  const principais = card.empresa.pessoas.filter((item) => item.principal);
  const contato = principais.length === 1
    ? principais[0]
    : card.empresa.pessoas.length === 1
      ? card.empresa.pessoas[0]
      : null;
  const contexto: Record<EntidadeFonteCampo, Record<string, unknown> | null> = {
    CLIENTE: card.empresa,
    CONTATO: contato ? { ...contato.pessoa, vinculo: contato.vinculo, cargo: contato.cargo } : null,
    PARCEIRO: card.indicacaoOrigem?.parceiro ?? null,
    CONTRATO: contrato,
    SERVICO: servico ?? (card.servico ? { id: null, nome: card.servico } : null),
    PROCESSO: processo,
    CARD: card,
  };

  return Object.fromEntries(globais.map((campo) => {
    if (!campo.fonteEntidade) return [campo.id, personalizadoPorCampo.get(campo.id) ?? ""];
    const entidade = campo.fonteEntidade as EntidadeFonteCampo;
    const atributo = campo.fonteAtributo as string;
    return [campo.id, serializarCanonico(contexto[entidade]?.[atributo])];
  }));
}

/** Persiste somente valores globais personalizados. Fontes canônicas continuam
 * protegidas e são alteradas exclusivamente pelas actions da entidade mestre. */
export async function salvarValoresGlobaisPersonalizadosCampos(
  cardId: string,
  valores: Readonly<Record<string, string>>,
  client: ClienteCamposCanonicos = db,
): Promise<Set<string>> {
  const ids = Object.keys(valores);
  if (!ids.length) return new Set();
  const [card, campos] = await Promise.all([
    client.bpmCard.findUnique({ where: { id: cardId }, select: { empresaId: true } }),
    client.bpmCampo.findMany({
      where: { id: { in: ids }, escopo: "GLOBAL", fonteEntidade: null, entidadeGlobal: "CLIENTE" },
      select: { id: true },
    }),
  ]);
  if (!card) throw new Error("CARD_GLOBAL_NAO_ENCONTRADO");
  const globais = new Set(campos.map((campo) => campo.id));
  for (const campoId of globais) {
    await client.bpmCampoValorGlobal.upsert({
      where: {
        campoId_entidadeTipo_entidadeId: {
          campoId,
          entidadeTipo: "CLIENTE",
          entidadeId: String(card.empresaId),
        },
      },
      create: {
        campoId,
        entidadeTipo: "CLIENTE",
        entidadeId: String(card.empresaId),
        valor: valores[campoId] ?? "",
      },
      update: { valor: valores[campoId] ?? "" },
    });
  }
  return globais;
}
