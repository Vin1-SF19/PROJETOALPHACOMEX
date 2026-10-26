import "server-only";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import {
  carregarCamposAplicaveisCardEtapa,
  type CampoAplicavelEtapaBpm,
  type PerfilAcessoCampoBpm,
} from "@/lib/bpm/requisitos-etapa-server";
import { campoEhReferenciaAutomaticaUsuarioBpm } from "@/lib/bpm/referencia-usuario-campo";

type Client = typeof db | Prisma.TransactionClient;

/** Edição de dados já registrados em etapa sem formulário nem composição canônica.
 * Uma configuração existente, inclusive oculta, mantém o caminho canônico e suas ACLs. */
export async function carregarCamposRegistradosSemFormulario(
  cardId: string,
  pipelineId: string,
  etapaId: string,
  client: Client = db,
  perfil?: PerfilAcessoCampoBpm,
): Promise<CampoAplicavelEtapaBpm[]> {
  const [etapa, card] = await Promise.all([
    client.bpmEtapa.findUnique({ where: { id: etapaId }, select: { pipelineId: true, formulario: { select: { id: true } }, campoConfiguracoes: { select: { id: true }, take: 1 } } }),
    client.bpmCard.findUnique({ where: { id: cardId }, select: { pipelineId: true, etapaId: true } }),
  ]);
  // Formulário inativo é uma decisão administrativa, não autorização de fallback.
  if (!etapa || etapa.pipelineId !== pipelineId || etapa.formulario !== null || etapa.campoConfiguracoes.length > 0
    || !card || card.pipelineId !== pipelineId || card.etapaId !== etapaId) return [];
  const valores = await client.bpmCardCampoValor.findMany({ where: { cardId }, select: { campoId: true } });
  const existentes = new Set(valores.map((valor) => valor.campoId));
  if (!existentes.size) return [];
  const campos = await client.bpmCampo.findMany({
    where: { id: { in: [...existentes] }, ativo: true, visivel: true,
      OR: [{ pipelineId }, { pipelinesAssociados: { some: { pipelineId } } }],
    },
    include: {
      pipelinesAssociados: { select: { pipelineId: true } },
      acessos: { select: { perfil: true, visivel: true, editavel: true, somenteLeitura: true } },
      opcoes: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: { rotulo: true } },
      etapaConfiguracoes: { where: { etapaId }, select: { visivel: true, editavel: true, somenteLeitura: true, condicaoVisibilidadeJson: true, condicaoObrigatoriedadeJson: true } },
    },
  });
  const base: Array<Omit<CampoAplicavelEtapaBpm, "valor">> = campos
    .filter((campo) => existentes.has(campo.id) && campo.ativo && campo.visivel
      && (campo.pipelineId === pipelineId || campo.pipelinesAssociados.some((associacao) => associacao.pipelineId === pipelineId))
      && campo.etapaConfiguracoes[0]?.visivel !== false
      && campo.acessos.find((acesso) => acesso.perfil === perfil)?.visivel !== false)
    .map((campo) => {
      const acesso = campo.acessos.find((item) => item.perfil === perfil);
      const configuracao = campo.etapaConfiguracoes[0];
      const somenteLeitura = campo.somenteLeitura || acesso?.somenteLeitura === true || configuracao?.somenteLeitura === true || campoEhReferenciaAutomaticaUsuarioBpm(campo);
      return {
        id: campo.id, chave: campo.chave, pipelineId: campo.pipelineId, etapaId,
        nome: campo.nome, tipo: campo.tipo, ordem: campo.ordem, ativo: true,
        escopo: campo.escopo, fonteEntidade: campo.fonteEntidade, fonteAtributo: campo.fonteAtributo, entidadeGlobal: campo.entidadeGlobal,
        visivel: true, editavel: campo.editavel && acesso?.editavel !== false && configuracao?.editavel !== false && !somenteLeitura, somenteLeitura,
        // Exibir dado existente não cria um requisito de entrada/saída nem aplica defaults.
        obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false, valorPadrao: null,
        opcoesJson: campo.opcoes.length ? JSON.stringify(campo.opcoes.map((opcao) => opcao.rotulo)) : campo.opcoesJson,
        configVersao: campo.configVersao,
        condicaoVisibilidadeJson: configuracao?.condicaoVisibilidadeJson ?? null,
        condicaoObrigatoriedadeJson: null,
      };
    }).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  // A hidratação central preserva fontes globais, usuários e mapeamentos de referência.
  return carregarCamposAplicaveisCardEtapa(cardId, pipelineId, etapaId, client, perfil, base);
}
