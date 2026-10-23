import "server-only";

import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { fonteCampoPermitida, type EntidadeFonteCampo } from "@/lib/bpm/campos-configuraveis";
import { ehPipelineOperacional } from "@/lib/bpm/financeiro-config.client";
import { perfilCadastralSchema } from "@/lib/bpm/dados-empresa-edicao";
import { ENDERECOS_CADASTRAIS } from "@/lib/bpm/cadastro-campos";

type ClienteCamposCanonicos = typeof db | Prisma.TransactionClient;

export type CampoFonteCanonica = {
  id: string;
  chave?: string | null;
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
  // O catálogo resolve a identidade dos aliases CARD; nenhum rótulo ou payload define a fonte.
  const idsEnderecos = campos.filter((campo) => campo.escopo === "CARD" && !campo.fonteEntidade).map((campo) => campo.id);
  const enderecos = idsEnderecos.length && client.bpmCampo ? await client.bpmCampo.findMany({
    where: { id: { in: idsEnderecos }, chave: { in: Object.keys(ENDERECOS_CADASTRAIS) } },
    select: { id: true, chave: true },
  }) : [];
  if (!globais.length && !enderecos.length) return {};

  const card = await client.bpmCard.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      empresaId: true,
      servico: true,
      tipoProcesso: true,
      status: true,
      concluidoEm: true,
      dataReuniao: true,
      responsavelId: true,
      responsavel: { select: { id: true, nome: true, cpf: true } },
      pipeline: { select: { id: true, chave: true } },
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
          dataConstituicao: true,
          status: true,
          perfilCadastralJson: true,
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
  const parsedPerfil = perfilCadastralSchema.safeParse(card.empresa.perfilCadastralJson);
  const cadastro = parsedPerfil.success ? parsedPerfil.data.cadastro : null;

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
    CARD: { ...card, responsavelNome: card.responsavel?.nome, responsavelCpf: card.responsavel?.cpf },
  };
  if (cadastro) {
    // O perfil salvo é explícito: vazio continua vazio. Não escolhemos contatos ambíguos.
    const emails = [...new Set(cadastro.contatos.filter((c) => c.tipo === "E-mail").map((c) => c.valor))];
    const telefones = [...new Set(cadastro.contatos.filter((c) => c.tipo === "Telefone").map((c) => c.valor))];
    contexto.CONTATO = { ...contexto.CONTATO,
      ...(emails.length <= 1 ? { email: emails[0] ?? null } : {}),
      ...(telefones.length <= 1 ? { celular: telefones[0] ?? null, telefoneExtra: null } : {}),
    };
  }

  const valoresVendedor = new Map<string, string>();
  const camposResponsavel = globais.filter((campo) => campo.fonteEntidade === "CARD"
    && ["responsavelId", "responsavelNome", "responsavelCpf"].includes(campo.fonteAtributo ?? ""));
  if (camposResponsavel.length && (card.pipeline?.chave === "financeiro" || Boolean(card.pipeline && ehPipelineOperacional(card.pipeline)))) {
    // A identidade do campo vem do catálogo, nunca de uma chave enviada pelo chamador.
    const vendedores = await client.bpmCampo.findMany({
      where: { id: { in: camposResponsavel.map((campo) => campo.id) }, chave: "alpha.vendedor.a" }, select: { id: true },
    });
    if (vendedores.length) {
      for (const vendedor of vendedores) valoresVendedor.set(vendedor.id, "");
      const { carregarRecepcoesPipelineBpm, idRecepcaoPipeline } = await import("@/lib/bpm/recebimentos-card-server");
      const recepcao = (await carregarRecepcoesPipelineBpm([idRecepcaoPipeline(card.id)], client)).get(card.id);
      let comercial = recepcao?.marker.responsaveisAnteriores.find((responsavel) => responsavel.setor === "COMERCIAL");
      if (!comercial) {
        const vinculos = await client.bpmCardVinculo.findMany({ where: { cardDestinoId: card.id,
          cardOrigem: { empresaId: card.empresaId, pipeline: { OR: [{ chave: "comercial" }, { nome: "Revisão de Radar" }] } } },
          take: 2, select: { cardOrigem: { select: { pipelineId: true, responsavelId: true,
            pipeline: { select: { nome: true } }, responsavel: { select: { nome: true } } } } } });
        if (vinculos.length === 1) {
          const origem = vinculos[0].cardOrigem;
          comercial = { setor: "COMERCIAL", pipelineId: origem.pipelineId, pipelineNome: origem.pipeline.nome,
            usuarioId: origem.responsavelId, nome: origem.responsavel.nome };
        }
      }
      if (comercial) {
        const usuario = await client.usuarios.findUnique({ where: { id: comercial.usuarioId }, select: { cpf: true } });
        for (const vendedor of vendedores) {
          const atributo = camposResponsavel.find((campo) => campo.id === vendedor.id)?.fonteAtributo;
          valoresVendedor.set(vendedor.id, atributo === "responsavelId" ? String(comercial.usuarioId)
            : atributo === "responsavelNome" ? comercial.nome : usuario?.cpf ?? "");
        }
      }
    }
  }

  const resultado = Object.fromEntries(globais.map((campo) => {
    if (valoresVendedor.has(campo.id)) return [campo.id, valoresVendedor.get(campo.id)!];
    if (!campo.fonteEntidade) return [campo.id, personalizadoPorCampo.get(campo.id) ?? ""];
    const entidade = campo.fonteEntidade as EntidadeFonteCampo;
    const atributo = campo.fonteAtributo as string;
    return [campo.id, serializarCanonico(contexto[entidade]?.[atributo])];
  }));
  if (cadastro) for (const campo of enderecos) {
    const atributo = ENDERECOS_CADASTRAIS[campo.chave ?? ""];
    if (atributo) resultado[campo.id] = cadastro.empresa.endereco[atributo] ?? "";
  }
  return resultado;
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
  // Compatibilidade com clientes mínimos usados por integrações/testes antigos;
  // o Prisma de produção sempre expõe ambos os delegates após a migração.
  if (!(client as Partial<typeof db>).bpmCampo || !(client as Partial<typeof db>).bpmCampoValorGlobal) return new Set();
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
