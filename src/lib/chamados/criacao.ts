import db from "@/lib/prisma";
import { isSameRole } from "@/lib/roles";
import { criarChamadoSchema, type CriarChamadoData } from "./schemas";
import { z } from "zod";
import { marcarDescricaoComoAbertaViaBibble } from "./origem-bibble";

const persistenciaSchema = criarChamadoSchema.omit({ dataDesejadaConclusao: true }).extend({ dataDesejadaConclusao: z.date().nullable() });
const normalizarNome = (nome: string) => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();

export class ErroCriacaoChamado extends Error {}

/** Única entrada de criação para formulário, API e Bibble. Sem notificações externas. */
export async function criarChamadoMultissetorial(usuarioId: number, input: CriarChamadoData, options: { origemBibble?: boolean; responsavelNome?: string } = {}) {
  const validacao = persistenciaSchema.safeParse(input);
  if (!validacao.success) throw new ErroCriacaoChamado(validacao.error.issues[0]?.message ?? "Dados inválidos");
  input = validacao.data;
  return db.$transaction(async (tx) => {
    const autor = await tx.usuarios.findUnique({ where: { id: usuarioId }, select: { id: true, nome: true, role: true, status: true } });
    if (!autor || autor.status !== "ATIVO") throw new ErroCriacaoChamado("Colaborador não está ativo.");
    const setor = await tx.setor.findUnique({ where: { id: input.setorDestinoId }, select: { id: true, nome: true, ativo: true, isBase: true } });
    if (!setor?.ativo || setor.isBase) throw new ErroCriacaoChamado("Escolha um setor ativo para o chamado.");
    const categoria = await tx.chamadoCategoria.findUnique({ where: { id: input.categoriaId }, select: { id: true, setorId: true, nome: true, ativo: true } });
    if (!categoria?.ativo || categoria.setorId !== setor.id) throw new ErroCriacaoChamado("Escolha uma categoria ativa do setor de destino.");
    if (input.tecnicoSolicitadoId !== null) {
      const responsavel = await tx.usuarios.findUnique({ where: { id: input.tecnicoSolicitadoId }, select: { id: true, nome: true, role: true, status: true } });
      if (!responsavel || responsavel.status !== "ATIVO" || !isSameRole(responsavel.role, setor.nome)) {
        throw new ErroCriacaoChamado("O responsável solicitado não está disponível no setor de destino.");
      }
      if (options.responsavelNome && !normalizarNome(responsavel.nome).includes(normalizarNome(options.responsavelNome))) {
        throw new ErroCriacaoChamado("O responsável selecionado não corresponde ao nome solicitado.");
      }
    }
    const duplicado = await tx.chamados.findFirst({ where: { usuarioId, titulo: input.titulo, setorDestinoId: setor.id, createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } }, select: { id: true } });
    if (duplicado) throw new ErroCriacaoChamado("Você já enviou um chamado similar para este setor recentemente. Aguarde 5 minutos.");
    const chamado = await tx.chamados.create({ data: {
      titulo: input.titulo, descricao: options.origemBibble ? marcarDescricaoComoAbertaViaBibble(input.descricao) : input.descricao, prioridade: input.prioridade, usuarioId,
      setorDestinoId: setor.id, setorDestinoNome: setor.nome, categoriaId: categoria.id, categoria: categoria.nome,
      tecnicoSolicitadoId: input.tecnicoSolicitadoId, dataDesejadaConclusao: input.dataDesejadaConclusao, status: "ABERTO",
    }, select: { id: true, titulo: true, prioridade: true, createdAt: true, setorDestinoId: true, setorDestinoNome: true, tecnicoSolicitadoId: true } });
    return { ...chamado, autor: { id: autor.id, nome: autor.nome, role: autor.role } };
  }, { isolationLevel: "Serializable" });
}
