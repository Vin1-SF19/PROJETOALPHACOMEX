'use server'

import { revalidatePath } from 'next/cache'
import { criarTemplate, listarTemplates, atualizarTemplate, arquivarTemplate } from '@/lib/gerador-documentos/templates'
import { gerarDocumento, aprovarDocumento, atualizarClausulaGerada } from '@/lib/gerador-documentos/geracao'
import { reescreverClausula } from '@/lib/gerador-documentos/reescrita-ia'
import { templateSchema, atualizarTemplateSchema, gerarDocumentoSchema, reescreverClausulaSchema } from '@/lib/gerador-documentos/validacao'

const ROTA_BASE = '/PainelAlpha/GeradorDocumentos'

export async function CriarTemplate(params: unknown) {
  try {
    const parsed = templateSchema.safeParse(params)
    if (!parsed.success) {
      return { success: false, error: 'Dados inválidos', details: parsed.error.flatten() }
    }
    const resultado = await criarTemplate(parsed.data)
    if (resultado.success) revalidatePath(ROTA_BASE)
    return resultado
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: msg }
  }
}

export async function ListarTemplates() {
  try {
    return await listarTemplates()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: msg, data: [] }
  }
}

export async function AtualizarTemplate(params: unknown) {
  try {
    const parsed = atualizarTemplateSchema.safeParse(params)
    if (!parsed.success) {
      return { success: false, error: 'Dados inválidos', details: parsed.error.flatten() }
    }
    const resultado = await atualizarTemplate(parsed.data)
    if (resultado.success) revalidatePath(ROTA_BASE)
    return resultado
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: msg }
  }
}

export async function ArquivarTemplate(id: string) {
  try {
    const resultado = await arquivarTemplate(id)
    if (resultado.success) revalidatePath(ROTA_BASE)
    return resultado
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: msg }
  }
}

export async function GerarDocumento(params: unknown) {
  try {
    const parsed = gerarDocumentoSchema.safeParse(params)
    if (!parsed.success) {
      return { success: false, error: 'Dados inválidos', details: parsed.error.flatten() }
    }
    return await gerarDocumento(parsed.data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: msg }
  }
}

export async function ReescreverClausula(params: unknown) {
  try {
    const parsed = reescreverClausulaSchema.safeParse(params)
    if (!parsed.success) {
      return { success: false, error: 'Dados inválidos', details: parsed.error.flatten() }
    }
    return await reescreverClausula(parsed.data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: msg }
  }
}

export async function AprovarDocumento(documentoId: string) {
  try {
    const resultado = await aprovarDocumento(documentoId)
    if (resultado.success) revalidatePath(`${ROTA_BASE}/conferencia`)
    return resultado
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: msg }
  }
}

export async function AtualizarClausulaGerada(params: unknown) {
  try {
    const { documentoId, clausulaId, conteudo } = params as { documentoId: string; clausulaId: string; conteudo: string }
    if (!documentoId || !clausulaId || !conteudo) {
      return { success: false, error: 'Parâmetros inválidos' }
    }
    const resultado = await atualizarClausulaGerada({ documentoId, clausulaId, conteudo })
    if (resultado.success) revalidatePath(`${ROTA_BASE}/conferencia`)
    return resultado
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return { success: false, error: msg }
  }
}
