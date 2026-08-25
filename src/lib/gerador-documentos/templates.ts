import db from '@/lib/prisma'
import { isAdminRole } from '@/lib/roles'
import { exigirAcessoGeradorDocumentos } from './validacao'

export interface ClausulaSeparada {
  ordem: number
  titulo: string
  conteudo: string
}

/**
 * Separa um texto completo em cláusulas.
 * Padrões reconhecidos:
 * - "1." / "1.1" / "1.2.3" (numeração decimal)
 * - "Art. 1" / "Art. 1º"
 * - "Cláusula 1ª" / "Cláusula 1"
 * - "1ª" / "2ª" (ordinais)
 * - Linhas em MAIÚSCULAS como título de seção
 */
export function separarClausulas(texto: string): ClausulaSeparada[] {
  const linhas = texto.split('\n')
  const clausulas: ClausulaSeparada[] = []
  let atual: ClausulaSeparada | null = null
  let buffer: string[] = []

  // Regex para identificar início de cláusula
  const regexClausula = /^(?:\d+(?:\.\d+)*\.?\s+|Art\.\s*\d+º?\s+|Cl[áa]usula\s*\d+º?\s+|\d+º\s+)/i

  function flushBuffer() {
    if (atual && buffer.length > 0) {
      const conteudo = buffer.join('\n').trim()
      if (conteudo) {
        atual.conteudo = atual.conteudo ? atual.conteudo + '\n' + conteudo : conteudo
      }
    }
    buffer = []
  }

  for (const linha of linhas) {
    const trimmed = linha.trim()

    if (regexClausula.test(trimmed)) {
      // Nova cláusula detectada
      flushBuffer()

      // Extrair título: tudo antes do primeiro ponto ou quebra
      const match = trimmed.match(/^(.*?)(?:\s{2,}|—|–|-)?(.*)$/)
      const titulo = match ? (match[1] || trimmed).trim() : trimmed
      const resto = match && match[2] ? match[2].trim() : ''

      atual = {
        ordem: clausulas.length + 1,
        titulo,
        conteudo: resto,
      }
      clausulas.push(atual)
    } else if (trimmed) {
      if (atual) {
        buffer.push(trimmed)
      } else {
        // Texto antes da primeira cláusula — criar cláusula "PREAMBULO"
        atual = { ordem: 0, titulo: 'PREAMBULO', conteudo: trimmed }
        clausulas.push(atual)
      }
    }
  }

  flushBuffer()

  // Se não encontrou nenhuma cláusula, retorna o texto inteiro como uma única cláusula
  if (clausulas.length === 0 && texto.trim()) {
    return [{ ordem: 1, titulo: 'CONTEUDO', conteudo: texto.trim() }]
  }

  return clausulas
}

/**
 * Cria um template com suas cláusulas.
 */
export async function criarTemplate(params: {
  titulo: string
  descricao?: string | null
  categoria?: string | null
  variaveis: Array<{ nome: string; label: string; tipo: string; obrigatorio: boolean; placeholder?: string | null }>
  textoCompleto: string
}) {
  const { userId } = await exigirAcessoGeradorDocumentos()

  const clausulas = separarClausulas(params.textoCompleto)

  const template = await db.$transaction(async (tx) => {
    const novo = await tx.documentoTemplate.create({
      data: {
        titulo: params.titulo,
        descricao: params.descricao ?? null,
        categoria: params.categoria ?? null,
        variaveisJson: params.variaveis,
        status: 'ATIVO',
        criadoPorId: userId,
      },
    })

    for (const cl of clausulas) {
      await tx.documentoClasula.create({
        data: {
          templateId: novo.id,
          ordem: cl.ordem,
          titulo: cl.titulo,
          conteudo: cl.conteudo,
          tipo: 'TEXTO',
          editavel: true,
        },
      })
    }

    return novo
  })

  return { success: true, data: template }
}

/**
 * Lista templates ativos (com cláusulas).
 */
export async function listarTemplates() {
  const { userId, isAdmin } = await exigirAcessoGeradorDocumentos()

  const where = isAdmin ? {} : { criadoPorId: userId }

  const templates = await db.documentoTemplate.findMany({
    where: { ...where, status: 'ATIVO' },
    include: {
      clausulas: { orderBy: { ordem: 'asc' } },
    },
    orderBy: { criadoEm: 'desc' },
  })

  return { success: true, data: templates }
}

/**
 * Atualiza um template. Se textoCompleto mudou, re-separa cláusulas.
 */
export async function atualizarTemplate(params: {
  id: string
  titulo?: string
  descricao?: string | null
  categoria?: string | null
  variaveis?: Array<{ nome: string; label: string; tipo: string; obrigatorio: boolean; placeholder?: string | null }>
  textoCompleto?: string
}) {
  const { userId, isAdmin } = await exigirAcessoGeradorDocumentos()

  const template = await db.documentoTemplate.findFirst({
    where: { id: params.id, ...(isAdmin ? {} : { criadoPorId: userId }) },
  })

  if (!template) {
    return { success: false, error: 'Template não encontrado' }
  }

  await db.$transaction(async (tx) => {
    await tx.documentoTemplate.update({
      where: { id: params.id },
      data: {
        ...(params.titulo && { titulo: params.titulo }),
        ...(params.descricao !== undefined && { descricao: params.descricao }),
        ...(params.categoria !== undefined && { categoria: params.categoria }),
        ...(params.variaveis && { variaveisJson: params.variaveis }),
      },
    })

    // Se texto mudou, re-separa cláusulas
    if (params.textoCompleto) {
      await tx.documentoClasula.deleteMany({ where: { templateId: params.id } })

      const clausulas = separarClausulas(params.textoCompleto)
      for (const cl of clausulas) {
        await tx.documentoClasula.create({
          data: {
            templateId: params.id,
            ordem: cl.ordem,
            titulo: cl.titulo,
            conteudo: cl.conteudo,
            tipo: 'TEXTO',
            editavel: true,
          },
        })
      }
    }
  })

  return { success: true }
}

/**
 * Arquiva um template (soft delete).
 */
export async function arquivarTemplate(id: string) {
  const { userId, isAdmin } = await exigirAcessoGeradorDocumentos()

  const template = await db.documentoTemplate.findFirst({
    where: { id, ...(isAdmin ? {} : { criadoPorId: userId }) },
  })

  if (!template) {
    return { success: false, error: 'Template não encontrado' }
  }

  await db.documentoTemplate.update({
    where: { id },
    data: { status: 'ARQUIVADO' },
  })

  return { success: true }
}
