"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { carregarDadosEmpresaCard } from "@/lib/bpm/dados-empresa-server";
import { cadastroDosDadosEmpresa, diferencasCadastroEmpresa, salvarCadastroEmpresaSchema } from "@/lib/bpm/dados-empresa-edicao";
import { consultarFontesCnpjLead } from "@/lib/bpm/consulta-cnpj-lead";
import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";
import { normalizarDadosEmpresaBpm } from "@/lib/bpm/dados-empresa";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const CONFLITO = "Os dados da empresa foram alterados durante a edição. Recarregue os dados antes de salvar novamente.";

/** Edição explícita de uma empresa, com autorização e auditoria na mesma transação. */
export async function SalvarCadastroEmpresaCardBpm(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
  const parsed = salvarCadastroEmpresaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message || "Confira os dados informados." };
  const userId = Number(session.user.id); const p = parsed.data;
  try {
    await exigirAcessoBpmCard(p.cardId, userId, session.user.role ?? null, "editarCard");
    const data = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(p.cardId, userId, session.user.role ?? null, "editarCard", tx);
      const atual = await carregarDadosEmpresaCard(p.cardId, tx);
      if (!atual || atual.edicao.empresaId !== p.empresaId) throw Error("Empresa não encontrada neste card.");
      if (atual.edicao.versaoEsperada !== p.versaoEsperada || atual.edicao.snapshotEsperado !== p.snapshotEsperado) throw Error(CONFLITO);
      const alteracoes = diferencasCadastroEmpresa(atual.edicao.cadastro, p.cadastro);
      if (!alteracoes.length) return atual;
      const empresa = p.cadastro.empresa;
      const mudou = (path: string) => alteracoes.some((a) => a.campo === path);
      const agora = new Date(Math.max(Date.now(), Date.parse(atual.edicao.versaoEsperada) + 1));
      const salvo = await tx.cliente.updateMany({
        where: { id: p.empresaId, updatedAt: new Date(p.versaoEsperada) },
        data: {
          ...(mudou("empresa.cnpj") ? { cnpj: empresa.cnpj || null } : {}),
          ...(mudou("empresa.razaoSocial") ? { razaoSocial: empresa.razaoSocial } : {}),
          ...(mudou("empresa.nomeFantasia") ? { nomeFantasia: empresa.nomeFantasia } : {}),
          ...(mudou("empresa.dataConstituicao") ? { dataConstituicao: empresa.dataConstituicao } : {}),
          ...(mudou("empresa.endereco.uf") ? { uf: empresa.endereco.uf } : {}),
          ...(mudou("empresa.endereco.municipio") ? { municipio: empresa.endereco.municipio } : {}),
          ...(mudou("regimeTributario.atual") ? { regimeTributario: p.cadastro.regimeTributario.atual } : {}),
          ...(mudou("empresa.capitalSocial") ? { capitalSocial: empresa.capitalSocial === null ? null : String(empresa.capitalSocial) } : {}),
          ...(mudou("empresa.situacao") ? { situacaoCadastral: empresa.situacao } : {}),
          perfilCadastralJson: { versao: 1, cadastro: p.cadastro }, updatedAt: agora },
      });
      if (salvo.count !== 1) throw Error(CONFLITO);
      const usuario = await tx.usuarios.findUniqueOrThrow({ where: { id: userId }, select: { nome: true } });
      const loteId = randomUUID();
      await tx.historicoAlteracaoCliente.createMany({ data: alteracoes.map((a) => ({
        loteId, clienteId: p.empresaId, campo: a.campo, valorAnterior: a.antes, valorNovo: a.depois,
        userId, nomeUsuarioNaEpoca: usuario.nome, acao: "EDICAO", criadoEm: agora,
      })) });
      for (const a of alteracoes) await registrarHistoricoCard({
        cardId: p.cardId, acao: "DADOS_EMPRESA_ATUALIZADOS", usuarioId: userId,
        valorAnteriorJson: JSON.stringify({ campo: a.campo, rotulo: a.rotulo, valor: a.antes }),
        valorNovoJson: JSON.stringify({ campo: a.campo, rotulo: a.rotulo, valor: a.depois, autor: usuario.nome, loteId }),
      }, tx);
      return (await carregarDadosEmpresaCard(p.cardId, tx))!;
    });
    revalidatePath("/PainelAlpha/AlphaCRM");
    try { await notificarPipelineBpm({ cardId: p.cardId, tipo: "CARD_ATUALIZADO" }); }
    catch { console.error("[SalvarCadastroEmpresaCardBpm] Atualização visual pendente de recarga."); }
    return { success: true as const, data };
  } catch (error) {
    const e = error as { message?: string; code?: string };
    const errorText = e.code === "P2002" ? "Este CNPJ já pertence a outra empresa. O cadastro não foi alterado."
      : [CONFLITO, "Empresa não encontrada neste card.", "Não autorizado"].includes(e.message ?? "") ? e.message!
        : "Não foi possível salvar os dados. Suas alterações continuam disponíveis para tentar novamente.";
    return { success: false as const, error: errorText };
  }
}

/** A lupa consulta as APIs atuais e devolve somente dados cadastrais para o rascunho. */
export async function ConsultarCnpjEdicaoEmpresaCardBpm(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
  const parsed = z.object({ cardId: z.string().min(1).max(150), cnpj: z.string().max(30).transform(normalizarCNPJ).refine(cnpjEhValido) }).strict().safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Confira um CNPJ válido antes de consultar." };
  try {
    await exigirAcessoBpmCard(parsed.data.cardId, Number(session.user.id), session.user.role ?? null, "editarCard");
    const r = await consultarFontesCnpjLead(parsed.data.cnpj);
    // Acesso pode ter sido removido enquanto os fornecedores respondiam.
    await exigirAcessoBpmCard(parsed.data.cardId, Number(session.user.id), session.user.role ?? null, "editarCard");
    if (!r.receita && !r.empresaAqui && !r.dadosRadar) return { success: false as const, error: "As fontes de consulta estão indisponíveis. Os dados preenchidos foram preservados." };
    const dados = normalizarDadosEmpresaBpm({
      empresaPrincipal: { id: 0, status: "", cnpj: r.cnpj, razaoSocial: r.receita?.razaoSocial || r.radar?.razaoSocial || "", socios: [] },
      registrosCs: [], pessoasVinculadas: [], responsaveisBpm: [], radarFiscal: null,
      preAnalise: { dadosBrutos: { rfb: r.receita ? { dados: r.receita } : null,
        empresaqui: r.empresaAqui ? { dados: r.empresaAqui } : null,
        radar: r.dadosRadar ? { dados: r.dadosRadar, consultadoEm: r.agora } : null }, updatedAt: r.agora },
    });
    return { success: true as const, cadastro: cadastroDosDadosEmpresa(dados), falhas: r.falhas,
      fontes: { receita: Boolean(r.receita), fiscal: Boolean(r.empresaAqui), radar: Boolean(r.dadosRadar) } };
  } catch {
    return { success: false as const, error: "Não foi possível consultar o CNPJ. Os dados preenchidos foram preservados." };
  }
}
