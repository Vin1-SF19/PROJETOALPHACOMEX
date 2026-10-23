"use server";
import { resolverAutoridadeMovimentoLivre } from "@/lib/bpm/lideranca-setor";

import { createHash } from "node:crypto";
import { z } from "zod";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmPipeline, isAdminRole } from "@/lib/bpm/ownership";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { carregarEscopoLeituraBpm } from "@/lib/bpm/visao-equipe-server";
import { cardApareceNoQuadro, etapasComSaidaDoQuadro } from "@/lib/bpm/cards-no-quadro";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { pipelineEhRevisaoRadar } from "@/lib/bpm/proximo-contato";
import { buscarNolossLeadsPendentes } from "@/lib/bpm/noloss-leads";
import { buscarInstagramLeadsPendentes } from "@/lib/bpm/instagram-leads-server";
import { ordenarCardsMaisRecentesPrimeiro } from "@/lib/bpm/ordem-cards";
import { ListarCardsPipelineBpm } from "./Cards";
import { selecionarPaginaQuadro, type ManifestoQuadro, type EntradaManifestoQuadro } from "@/lib/bpm/quadro-paginado";
import { origemNativaQuadro, origemNolossQuadro } from "@/lib/bpm/origem-quadro";

const id = z.string().min(1).max(150);
const entrada = z.object({
  conhecidos: z.array(z.object({ id, revision: z.string().max(100) })).max(5000).default([]),
  limites: z.record(z.string().max(150), z.number().int().min(1).max(5000)).default({}),
  busca: z.string().max(200).default(""), responsavelId: z.number().int().positive().nullable().optional(),
  origem: z.string().trim().min(1).max(200).nullable().optional(),
  forcar: z.boolean().default(false),
  visao: z.enum(["MEUS", "EQUIPE", "SETOR", "TODOS"]).default("MEUS"),
  setorId: z.number().int().positive().nullable().optional(),
});
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);

export async function SincronizarQuadroBpm(pipelineId: string, input: unknown = {}) {
  try {
    const parsed = entrada.safeParse(input);
    if (!parsed.success || !id.safeParse(pipelineId).success) return { success: false as const, error: "Seleção inválida", acessoNegado: false };
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado", acessoNegado: true };
    const userId = Number(session.user.id);
    try { await exigirAcessoBpmPipeline(pipelineId, userId); }
    catch { return { success: false as const, error: "Você não tem mais acesso a este pipeline.", acessoNegado: true }; }
    const [pipeline, usuario] = await Promise.all([
      db.bpmPipeline.findUnique({ where: { id: pipelineId }, select: {
        nome: true, configVersion: true, visualizacaoConfigJson: true,
        setores: { select: { setor: { select: { nome: true, ativo: true } } } },
        etapas: { where: { ativo: true }, select: { id: true, nome: true, ehFinal: true,
          visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } },
          automacoes: { where: { ativa: true }, select: { versoes: { where: { status: "ATIVA" }, select: { grafoJson: true } } } },
        } },
      } }),
      db.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);
    if (!pipeline || !usuario) return { success: false as const, error: "Pipeline indisponível", acessoNegado: true };
    const etapas = pipeline.etapas.filter((e) => resolverVisibilidadeEtapa(usuario.role, e.visibilidades).podeVer);
    const admin = isAdminRole(usuario.role);
    const leituraAmpliada = admin || Boolean(resolverAutoridadeMovimentoLivre(
      { id: userId, role: usuario.role }, pipeline.setores?.map(({ setor }) => setor) ?? []));
    const escopo = await carregarEscopoLeituraBpm(userId, leituraAmpliada, pipelineId, pipeline.visualizacaoConfigJson ?? null, db, true);
    const acesso = { userId, admin: leituraAmpliada, setores: escopo.setores, responsaveis: escopo.responsaveis };
    if ((parsed.data.visao === "SETOR" && !escopo.setores.some((s) => s.id === parsed.data.setorId)) || (parsed.data.visao === "EQUIPE" && !escopo.setores.length) || (parsed.data.responsavelId != null && !escopo.responsaveis.some((pessoa) => pessoa.id === parsed.data.responsavelId))) {
      return { success: false as const, error: "Esta visualização não está mais disponível. Selecione Meus e sem vínculos.", acessoNegado: false, visaoRevogada: true };
    }
    // Só identidade, busca, origem e acesso. Nunca histórico, tarefas ou campos completos.
    const rows = await db.bpmCard.findMany({
      where: { pipelineId, etapaId: { in: etapas.map((e) => e.id) }, OR: [{ status: "ATIVO" }, { status: "CONCLUIDO", etapa: { ehFinal: true } }], ...escopo.where },
      select: { id: true, empresaId: true, etapaId: true, createdAt: true, updatedAt: true, servico: true, status: true,
        campoValores: { where: { campo: { ativo: true, OR: [{ chave: "alpha.canal.origem.do.cliente" }, { nome: { contains: "origem" } }] } },
          select: { valor: true, campo: { select: { nome: true, chave: true, ativo: true } } } },
        servicoContexto: { select: {
          clienteServico: { select: { clienteId: true, origemLead: true, canalAquisicao: true } },
          contratoComercial: { select: { clienteId: true, canalAquisicao: true } },
        } },
        empresa: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
        responsavel: { select: { id: true, nome: true } },
        membros: { select: { usuario: { select: { id: true, nome: true } } } },
        vinculosOrigem: { where: { cardDestino: { pipeline: { ativo: true }, status: { not: "ARQUIVADO" } } }, select: { id: true }, take: 1 },
      }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const saidas = etapasComSaidaDoQuadro(pipeline.etapas);
    const entradas: EntradaManifestoQuadro[] = rows.filter((c) => cardApareceNoQuadro(c, pipeline.etapas, saidas)).map((c) => ({
      id: c.id, etapaId: c.etapaId, createdAt: c.createdAt?.toISOString(), revision: hash([c, pipeline.configVersion]),
      nome: `${c.empresa.razaoSocial} ${c.empresa.nomeFantasia ?? ""}`, cnpj: c.empresa.cnpj, servico: c.servico,
      origem: origemNativaQuadro(c),
      responsaveis: [...new Map([c.responsavel, ...c.membros.map((m) => m.usuario)].map((p) => [p.id, p])).values()],
    }));
    const novos = etapas.find((e) => etapaEhNovosLeads(e.nome));
    if (novos && pipelineEhRevisaoRadar(pipeline.nome)) {
      const leads = await buscarNolossLeadsPendentes();
      for (const lead of leads) entradas.push({ id: lead.id, etapaId: novos.id, createdAt: lead.receivedAt?.toISOString(), revision: hash(lead), nome: lead.nome || lead.email || "Lead sem nome", cnpj: null, servico: null, origem: origemNolossQuadro(lead), responsaveis: [] });
      for (const lead of await buscarInstagramLeadsPendentes(pipelineId)) entradas.push({
        id: lead.id, etapaId: novos.id, createdAt: lead.recebidoEm.toISOString(), revision: hash(lead),
        nome: `${lead.dados.nome} Instagram`, cnpj: lead.dados.cnpj, servico: null, origem: "Instagram", responsaveis: [],
      });
    }
    const ordenadas = ordenarCardsMaisRecentesPrimeiro(entradas);
    const manifesto: ManifestoQuadro = { configVersion: pipeline.configVersion, entradas: ordenadas, acesso };
    const pagina = selecionarPaginaQuadro(ordenadas, { ...parsed.data, acesso });
    const conhecidos = new Map(parsed.data.conhecidos.map((c) => [c.id, c.revision]));
    const desejados = new Set(pagina.ids);
    const buscar = ordenadas.filter((c) => desejados.has(c.id) && (parsed.data.forcar || conhecidos.get(c.id) !== c.revision)).map((c) => c.id);
    const resumos = buscar.length ? await ListarCardsPipelineBpm(pipelineId, buscar) : { success: true, data: [] };
    if (!resumos.success) return { success: false as const, error: "Não foi possível atualizar os cards. Tente novamente.", acessoNegado: false };
    // A hidratação reaplica ACL. Se algum card foi revogado entre leituras, não reutilizar dado antigo.
    const carregados = new Set(resumos.data.map((c) => c.id));
    const faltantes = new Set(buscar.filter((cardId) => !carregados.has(cardId)));
    manifesto.entradas = manifesto.entradas.filter((c) => !faltantes.has(c.id));
    return { success: true as const, manifesto, cards: resumos.data, ids: pagina.ids.filter((cardId) => !faltantes.has(cardId)) };
  } catch {
    return { success: false as const, error: "Não foi possível atualizar o quadro. Tente novamente.", acessoNegado: false };
  }
}
