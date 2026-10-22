import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { paraExibicaoTelefone } from "@/lib/validations/cs-nps";
import { normalizarDadosEmpresaBpm, type ClienteEmpresaFonte } from "@/lib/bpm/dados-empresa";
import { aplicarPerfilCadastral, cadastroDosDadosEmpresa } from "@/lib/bpm/dados-empresa-edicao";

const SELECT_SERVICO_CLIENTE = {
  servico: true,
  status: true,
  analistaResponsavel: true,
  dataContratacao: true,
  dataExito: true,
  formaPagamento: true,
  valorContrato: true,
  closerNome: true,
  origemLead: true,
  canalAquisicao: true,
  canalOutro: true,
  updatedAt: true,
} as const;

type ClienteComServicos = {
  id: number;
  status: string;
  cnpj: string | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  dataConstituicao: string | null;
  uf: string | null;
  municipio: string | null;
  regimeTributario: string | null;
  servicos: {
    servico: string;
    status: string;
    analistaResponsavel: string | null;
    dataContratacao: string | null;
    dataExito: string | null;
    formaPagamento: string | null;
    valorContrato: number | null;
    closerNome: string | null;
    origemLead: string | null;
    canalAquisicao: string | null;
    canalOutro: string | null;
    updatedAt: Date;
  }[];
};

/**
 * Achata `Cliente` + UM `ClienteServico` no formato que `dados-empresa.ts` já espera
 * (empresa+serviço combinados, mesmo shape de 1 linha de `clientes` legado).
 */
function achatarClienteServico(
  cliente: ClienteComServicos,
  servico: ClienteComServicos["servicos"][number] | null,
): ClienteEmpresaFonte {
  return {
    id: cliente.id,
    status: cliente.status,
    cnpj: cliente.cnpj ?? "",
    razaoSocial: cliente.razaoSocial,
    nomeFantasia: cliente.nomeFantasia,
    dataConstituicao: cliente.dataConstituicao,
    uf: cliente.uf,
    municipio: cliente.municipio,
    regimeTributario: cliente.regimeTributario,
    servicos: servico?.servico ?? null,
    analistaResponsavel: servico?.analistaResponsavel ?? null,
    dataContratacao: servico?.dataContratacao ?? null,
    dataExito: servico?.dataExito ?? null,
    formaPagamento: servico?.formaPagamento ?? null,
    valorContrato: servico?.valorContrato ?? null,
    closerNome: servico?.closerNome ?? null,
    origemLead: servico?.origemLead ?? null,
    canalAquisicao: servico?.canalAquisicao ?? null,
    canalOutro: servico?.canalOutro ?? null,
    socios: [],
  };
}

/**
 * Achata `Cliente` + TODOS os `ClienteServico` em N registros — equivalente às N
 * linhas que `clientes` (legado) tinha por CNPJ, uma por serviço contratado.
 * Preserva a visão agregada de múltiplos serviços (status/analistas/closers/etc
 * distintos por serviço) que `normalizarDadosEmpresaBpm` já sabia consolidar.
 */
function achatarTodosServicos(cliente: ClienteComServicos): ClienteEmpresaFonte[] {
  if (cliente.servicos.length === 0) return [achatarClienteServico(cliente, null)];
  return cliente.servicos.map((servico) => achatarClienteServico(cliente, servico));
}

export async function carregarDadosEmpresaCard(cardId: string, client: Prisma.TransactionClient = db) {
    const card = await client.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        empresa: {
          select: {
            id: true,
            perfilCadastralJson: true, capitalSocial: true, situacaoCadastral: true, updatedAt: true,
            status: true,
            cnpj: true,
            razaoSocial: true,
            nomeFantasia: true,
            dataConstituicao: true,
            uf: true,
            municipio: true,
            regimeTributario: true,
            servicos: { select: SELECT_SERVICO_CLIENTE },
          },
        },
        responsavel: { select: { nome: true } },
        membros: {
          select: {
            role: true,
            usuario: { select: { nome: true } },
          },
        },
      },
    });
    if (!card) return null;

    // `Cliente.cnpj` já é normalizado/único (Fase 2 do Cliente Master) — não precisa
    // mais de `cnpjsPossiveis` com/sem máscara (essa lógica só continua necessária
    // para consultar tabelas legadas que ainda guardam CNPJ com formato solto).
    const cnpjLimpo = card.empresa.cnpj?.replace(/\D/g, "") ?? "";

    const [pessoasVinculadas, preAnalise, radarFiscal] = await Promise.all([
      client.pessoaClienteVinculo.findMany({
        where: { clienteId: card.empresa.id },
        select: {
          vinculo: true,
          pessoa: { select: { id: true, nome: true, celular: true, email: true, dataNascimento: true, observacao: true } },
        },
        orderBy: { pessoa: { nome: "asc" } },
      }),
      cnpjLimpo.length === 14
        ? client.consultaPreAnalise.findUnique({
            where: { cnpj: cnpjLimpo },
            select: {
              regimeEA: true,
              qualificacao: true,
              submodalidade: true,
              capitalSocial: true,
              nomeResponsavel: true,
              telefoneContato: true,
              observacoes: true,
              dadosBrutos: true,
              updatedAt: true,
            },
          })
        : Promise.resolve(null),
      cnpjLimpo.length === 14
        ? client.radar_fiscal.findFirst({
            where: { cnpj: cnpjLimpo },
            select: {
              qualificacao: true,
              situacao_cadastral: true,
              data_abertura: true,
              capital_social: true,
              regime_receita: true,
              regime_ea: true,
              data_opcao_simples: true,
              data_exclusao_simples: true,
              divida_tributaria: true,
              historico_regime: true,
              cnaes: true,
              qsa: true,
              data_consulta: true,
              perse_anexo: true,
              perse: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const papeis: Record<string, string> = {
      RESPONSAVEL: "Responsável do card",
      ADMINISTRADOR: "Administrador do card",
      PARTICIPANTE: "Participante do card",
    };
    const responsaveisBpm = [
      { nome: card.responsavel.nome, papel: "Responsável do card" },
      ...card.membros.map((membro) => ({
        nome: membro.usuario.nome,
        papel: papeis[membro.role] || membro.role,
      })),
    ];

    const registrosCs = achatarTodosServicos(card.empresa);
    // Empresa principal = serviço mais recentemente atualizado, mesmo critério já
    // usado em outros pontos da Fase 3 (Indicacao/Parceiros) para "estado atual".
    const empresaAchatada = [...registrosCs].sort((a, b) => {
      const servA = card.empresa.servicos.find((s) => s.servico === a.servicos);
      const servB = card.empresa.servicos.find((s) => s.servico === b.servicos);
      return (servB?.updatedAt.getTime() ?? 0) - (servA?.updatedAt.getTime() ?? 0);
    })[0];
    const pessoasFonte = pessoasVinculadas.map((v) => ({
      id: v.pessoa.id,
      nome: v.pessoa.nome,
      telefone: paraExibicaoTelefone(v.pessoa.celular),
      email: v.pessoa.email,
      obs: v.pessoa.observacao,
      dataNascimento: v.pessoa.dataNascimento,
      vinculo: v.vinculo,
    }));

    const data = normalizarDadosEmpresaBpm({
      empresaPrincipal: empresaAchatada,
      registrosCs,
      pessoasVinculadas: pessoasFonte,
      preAnalise,
      radarFiscal,
      responsaveisBpm,
    });


    const consolidado = aplicarPerfilCadastral(data, card.empresa.perfilCadastralJson);
    const empresa = card.empresa;
    Object.assign(consolidado.empresa, { cnpj: empresa.cnpj ?? "", razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia ?? consolidado.empresa.nomeFantasia,
      dataConstituicao: empresa.dataConstituicao ?? consolidado.empresa.dataConstituicao,
      capitalSocial: empresa.capitalSocial != null && Number.isFinite(Number(empresa.capitalSocial)) ? Number(empresa.capitalSocial) : consolidado.empresa.capitalSocial,
      situacao: empresa.situacaoCadastral ?? consolidado.empresa.situacao });
    consolidado.empresa.endereco.uf = empresa.uf ?? consolidado.empresa.endereco.uf;
    consolidado.empresa.endereco.municipio = empresa.municipio ?? consolidado.empresa.endereco.municipio;
    consolidado.regimeTributario.atual = empresa.regimeTributario ?? consolidado.regimeTributario.atual;
    consolidado.atualizadoEm = empresa.updatedAt.toISOString();
    const cadastro = cadastroDosDadosEmpresa(consolidado);
    return { ...consolidado, edicao: { empresaId: card.empresa.id,
      versaoEsperada: card.empresa.updatedAt.toISOString(),
      snapshotEsperado: createHash("sha256").update(JSON.stringify(cadastro)).digest("hex"), cadastro } };
}
