import { randomUUID } from 'crypto'
import db from '@/lib/prisma'
import { exigirAcessoGeradorDocumentos } from './validacao'

/**
 * Substitui variáveis {{nome}} no texto pelos valores fornecidos.
 * Retorna { texto, variaveisFaltantes } — se faltantes não vazio, o texto NÃO é substituído.
 */
export function substituirVariaveis(
  texto: string,
  variaveis: Record<string, string>,
  variaveisObrigatorias: string[] = []
): { texto: string; variaveisFaltantes: string[] } {
  // Extrair todas as variáveis {{nome}} presentes no texto
  const regex = /\{\{(\w+)\}\}/g
  const encontradas = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(texto)) !== null) {
    encontradas.add(match[1])
  }

  // Verificar obrigatórias
  const faltantes = variaveisObrigatorias.filter((v) => !variaveis[v] && !variaveis[v]?.trim())

  if (faltantes.length > 0) {
    return { texto, variaveisFaltantes: faltantes }
  }

  // Substituir
  const resultado = texto.replace(/\{\{(\w+)\}\}/g, (_, nome: string) => {
    return variaveis[nome] ?? ''
  })

  return { texto: resultado, variaveisFaltantes: [] }
}

/**
 * Gera um documento a partir de um template + variáveis.
 * Cria DocumentoGerado + DocumentoClasulaGerada[].
 * Retorna { documentoId, tokenAcesso, urlConferencia }.
 */
export async function gerarDocumento(params: {
  templateId: string
  variaveis: Record<string, string>
  moduloOrigem?: string | null
}) {
  const { userId } = await exigirAcessoGeradorDocumentos()

  // Buscar template com cláusulas
  const template = await db.documentoTemplate.findFirst({
    where: { id: params.templateId, status: 'ATIVO' },
    include: {
      clausulas: { orderBy: { ordem: 'asc' } },
    },
  })

  if (!template) {
    return { success: false, error: 'Template não encontrado ou inativo', code: 'TEMPLATE_NOT_FOUND' }
  }

  // Extrair variáveis obrigatórias do template
  const variaveisTemplate = (template.variaveisJson as Array<{ nome: string; obrigatorio: boolean }>) ?? []
  const obrigatorias = variaveisTemplate.filter((v) => v.obrigatorio).map((v) => v.nome)

  // Validar variáveis obrigatórias
  const faltantes = obrigatorias.filter((v) => !params.variaveis[v]?.trim())
  if (faltantes.length > 0) {
    return {
      success: false,
      error: `Variáveis obrigatórias ausentes: ${faltantes.join(', ')}`,
      code: 'VARIABLES_MISSING',
      faltantes,
    }
  }

  // Gerar token único
  const tokenAcesso = randomUUID()

  // Criar documento + cláusulas em transação
  const documento = await db.$transaction(async (tx) => {
    const novo = await tx.documentoGerado.create({
      data: {
        templateId: template.id,
        titulo: template.titulo,
        variaveisJson: params.variaveis,
        status: 'RASCUNHO',
        tokenAcesso,
        criadoPorId: userId,
      },
    })

    for (const cl of template.clausulas) {
      const { texto: conteudoSubstituido } = substituirVariaveis(cl.conteudo, params.variaveis)
      await tx.documentoClasulaGerada.create({
        data: {
          documentoId: novo.id,
          ordem: cl.ordem,
          titulo: cl.titulo,
          conteudo: conteudoSubstituido,
          conteudoOriginal: cl.conteudo,
          reescritoPorIA: false,
        },
      })
    }

    return novo
  })

  const urlConferencia = `/PainelAlpha/GeradorDocumentos/conferencia/${tokenAcesso}`

  return {
    success: true,
    data: {
      documentoId: documento.id,
      tokenAcesso,
      urlConferencia,
    },
  }
}

/**
 * Busca documento + cláusulas por token (para tela de conferência).
 */
export async function obterDocumentoPorToken(token: string) {
  const documento = await db.documentoGerado.findFirst({
    where: { tokenAcesso: token },
    include: {
      clausulas: { orderBy: { ordem: 'asc' } },
      template: { select: { titulo: true, categoria: true } },
    },
  })

  if (!documento) {
    return { success: false, error: 'Documento não encontrado', code: 'NOT_FOUND' }
  }

  return { success: true, data: documento }
}

/**
 * Atualiza o conteúdo de uma cláusula gerada.
 */
export async function atualizarClausulaGerada(params: {
  documentoId: string
  clausulaId: string
  conteudo: string
}) {
  const { userId, isAdmin } = await exigirAcessoGeradorDocumentos()

  const documento = await db.documentoGerado.findFirst({
    where: { id: params.documentoId, ...(isAdmin ? {} : { criadoPorId: userId }) },
  })

  if (!documento) {
    return { success: false, error: 'Documento não encontrado' }
  }

  const clausula = await db.documentoClasulaGerada.update({
    where: { id: params.clausulaId },
    data: { conteudo: params.conteudo },
  })

  return { success: true, data: clausula }
}

/**
 * Aprova/finaliza um documento.
 */
export async function aprovarDocumento(documentoId: string) {
  const { userId, isAdmin } = await exigirAcessoGeradorDocumentos()

  const documento = await db.documentoGerado.findFirst({
    where: { id: documentoId, ...(isAdmin ? {} : { criadoPorId: userId }) },
  })

  if (!documento) {
    return { success: false, error: 'Documento não encontrado' }
  }

  await db.documentoGerado.update({
    where: { id: documentoId },
    data: { status: 'FINALIZADO', finalizadoEm: new Date() },
  })

  return { success: true }
}
