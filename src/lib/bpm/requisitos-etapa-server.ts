import "server-only";

import db from "@/lib/prisma";
import {
  listarCamposObrigatoriosFaltantes,
  type CampoObrigatorioBpm,
} from "@/lib/bpm/requisitos-etapa";
import {
  campoBpmPossuiFonteMestre,
  resolverValorEfetivoCampoBpm,
  type DadosMestresCampoBpm,
} from "@/lib/bpm/valor-efetivo-campo";

type ClienteRequisitosEtapa = Pick<
  typeof db,
  "bpmCampo" | "bpmCampoObrigatorioEtapa" | "bpmCampoOcultoEtapa" | "bpmCardCampoValor" | "bpmCard"
>;

export type CampoAplicavelEtapaBpm = {
  id: string;
  pipelineId: string;
  etapaId: string | null;
  nome: string;
  tipo: string;
  opcoesJson: string | null;
  obrigatorio: boolean;
  ordem: number;
  valor: string | null;
};

export async function carregarCamposAplicaveisEtapa(
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<Array<Omit<CampoAplicavelEtapaBpm, "valor">>> {
  const selectCampo = {
    id: true,
    pipelineId: true,
    etapaId: true,
    nome: true,
    tipo: true,
    opcoesJson: true,
    obrigatorio: true,
    ordem: true,
  } as const;

  const [diretos, associados, ocultos] = await Promise.all([
    // etapaId: null é "todas as etapas" (rótulo exibido no admin de pipeline,
    // AdminPipelineClient.tsx) — precisa entrar aqui junto com os campos da
    // etapa específica, não só os de etapaId igual.
    client.bpmCampo.findMany({
      where: { pipelineId, OR: [{ etapaId }, { etapaId: null }] },
      select: selectCampo,
    }),
    client.bpmCampoObrigatorioEtapa.findMany({
      where: { etapaId, campo: { pipelineId } },
      select: { campo: { select: selectCampo } },
    }),
    client.bpmCampoOcultoEtapa.findMany({
      where: { etapaId, campo: { pipelineId } },
      select: { campoId: true },
    }),
  ]);
  const idsOcultos = new Set(ocultos.map((item) => item.campoId));

  const porId = new Map<
    string,
    Omit<CampoAplicavelEtapaBpm, "valor">
  >();
  for (const campo of diretos) {
    if (idsOcultos.has(campo.id)) continue;
    porId.set(campo.id, campo);
  }
  for (const item of associados) {
    if (idsOcultos.has(item.campo.id)) continue;
    porId.set(item.campo.id, { ...item.campo, obrigatorio: true });
  }

  const campos = [...porId.values()].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome),
  );
  return campos;
}

export async function carregarCamposAplicaveisCardEtapa(
  cardId: string,
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<CampoAplicavelEtapaBpm[]> {
  const campos = await carregarCamposAplicaveisEtapa(pipelineId, etapaId, client);
  if (campos.length === 0) return [];

  const valores = await client.bpmCardCampoValor.findMany({
    where: { cardId, campoId: { in: campos.map((campo) => campo.id) } },
    select: { campoId: true, valor: true },
  });
  const valorPorCampo = new Map(
    valores.map((valor) => [valor.campoId, valor.valor]),
  );
  const precisaDadosMestres = campos.some((campo) =>
    campoBpmPossuiFonteMestre(campo.nome)
    && !valorPorCampo.get(campo.id)?.trim()
  );
  const cardComEmpresa = precisaDadosMestres
    ? await client.bpmCard.findUnique({
        where: { id: cardId },
        select: {
          empresa: {
            select: {
              cnpj: true,
              razaoSocial: true,
              nomeFantasia: true,
              pessoas: {
                where: { ativo: true },
                select: {
                  principal: true,
                  pessoa: {
                    select: {
                      nome: true,
                      celular: true,
                      email: true,
                      telefoneExtra: true,
                    },
                  },
                },
                orderBy: [{ principal: "desc" }, { criadoEm: "asc" }],
                take: 2,
              },
            },
          },
        },
      })
    : null;
  let dadosMestres: DadosMestresCampoBpm | null = null;
  if (cardComEmpresa) {
    const principais = cardComEmpresa.empresa.pessoas.filter((vinculo) => vinculo.principal);
    // Um contato só é semanticamente inequívoco quando há exatamente um
    // principal ou apenas uma pessoa ativa. Com múltiplos contatos sem dono,
    // não escolhemos silenciosamente um valor arbitrário.
    const contato = principais.length === 1
      ? principais[0]
      : cardComEmpresa.empresa.pessoas.length === 1
        ? cardComEmpresa.empresa.pessoas[0]
        : null;
    dadosMestres = {
      empresa: {
        cnpj: cardComEmpresa.empresa.cnpj,
        razaoSocial: cardComEmpresa.empresa.razaoSocial,
        nomeFantasia: cardComEmpresa.empresa.nomeFantasia,
      },
      contatoPrincipal: contato?.pessoa ?? null,
    };
  }

  return campos.map((campo) => {
    const valorPersistido = valorPorCampo.get(campo.id) ?? null;
    const valor = resolverValorEfetivoCampoBpm({
      nomeCampo: campo.nome,
      valorPersistido,
      dadosMestres,
    });
    return { ...campo, valor };
  });
}

export async function carregarCamposObrigatoriosEtapa(
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<CampoObrigatorioBpm[]> {
  const campos = await carregarCamposAplicaveisEtapa(pipelineId, etapaId, client);
  return campos
    .filter((campo) => campo.obrigatorio)
    .map(({ id, nome }) => ({ id, nome }));
}

export async function carregarCamposFaltantesCardEtapa(
  cardId: string,
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<CampoObrigatorioBpm[]> {
  const campos = (await carregarCamposAplicaveisCardEtapa(
    cardId,
    pipelineId,
    etapaId,
    client,
  )).filter((campo) => campo.obrigatorio);
  return listarCamposObrigatoriosFaltantes(
    campos,
    Object.fromEntries(campos.map((campo) => [campo.id, campo.valor])),
  );
}
