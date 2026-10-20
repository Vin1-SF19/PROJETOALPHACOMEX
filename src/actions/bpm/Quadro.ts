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
import { ListarCardsPipelineBpm } from "./Cards";
import { selecionarPaginaQuadro, type ManifestoQuadro, type EntradaManifestoQuadro } from "@/lib/bpm/quadro-paginado";

const id = z.string().min(1).max(150);
const entrada = z.object({
  conhecidos: z.array(z.object({ id, revision: z.string().max(100) })).max(5000).default([]),
  limites: z.record(z.string().max(150), z.number().int().min(1).max(5000)).default({}),
  busca: z.string().max(200).default(""), responsavelId: z.number().int().positive().nullable().optional(),
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
    const acesso = { userId, admin: leituraAmpliada, setores: escopo.setores };
    if ((parsed.data.visao === "TODOS" && !leituraAmpliada) || (parsed.data.visao === "SETOR" && !escopo.setores.some((s) => s.id === parsed.data.setorId)) || (parsed.data.visao === "EQUIPE" && !escopo.setores.length)) {
      return { success: false as const, error: "Esta visualização não está mais disponível. Selecione Meus leads.", acessoNegado: false, visaoRevogada: true };
    }
    // Só informações de identidade, busca e acesso. Nunca histórico, tarefas ou campos completos.
    const rows = await db.bpmCard.findMany({
      where: { pipelineId, etapaId: { in: etapas.map((e) => e.id) }, OR: [{ status: "ATIVO" }, { status: "CONCLUIDO", etapa: { ehFinal: true } }], ...escopo.where },
      select: { id: true, etapaId: true, updatedAt: true, servico: true, status: true,
        empresa: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
        responsavel: { select: { id: true, nome: true } },
        membros: { select: { usuario: { select: { id: true, nome: true } } } },
        vinculosOrigem: { where: { cardDestino: { pipeline: { ativo: true }, status: { not: "ARQUIVADO" } } }, select: { id: true }, take: 1 },
      }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const saidas = etapasComSaidaDoQuadro(pipeline.etapas);
    const entradas: EntradaManifestoQuadro[] = rows.filter((c) => cardApareceNoQuadro(c, pipeline.etapas, saidas)).map((c) => ({
      id: c.id, etapaId: c.etapaId, revision: hash([c, pipeline.configVersion]),
      nome: `${c.empresa.razaoSocial} ${c.empresa.nomeFantasia ?? ""}`, cnpj: c.empresa.cnpj, servico: c.servico,
      responsaveis: [...new Map([c.responsavel, ...c.membros.map((m) => m.usuario)].map((p) => [p.id, p])).values()],
    }));
    const novos = etapas.find((e) => etapaEhNovosLeads(e.nome));
    if (novos && pipelineEhRevisaoRadar(pipeline.nome)) {
      const leads = await buscarNolossLeadsPendentes();
      for (const lead of leads) entradas.push({ id: lead.id, etapaId: novos.id, revision: hash(lead), nome: lead.nome || lead.email || "Lead sem nome", cnpj: null, servico: null, responsaveis: [] });
    }
    const manifesto: ManifestoQuadro = { configVersion: pipeline.configVersion, entradas, acesso };
    const pagina = selecionarPaginaQuadro(entradas, { ...parsed.data, acesso });
    const conhecidos = new Map(parsed.data.conhecidos.map((c) => [c.id, c.revision]));
    const desejados = new Set(pagina.ids);
    const buscar = entradas.filter((c) => desejados.has(c.id) && (parsed.data.forcar || conhecidos.get(c.id) !== c.revision)).map((c) => c.id);
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
