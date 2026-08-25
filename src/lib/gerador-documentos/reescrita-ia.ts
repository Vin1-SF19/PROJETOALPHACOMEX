import db from '@/lib/prisma'
import { exigirAcessoGeradorDocumentos } from './validacao'

/**
 * Monta o prompt de reescrita de cláusula conforme especificação obrigatória.
 */
function montarPromptReescrita(params: {
  textoCompleto: string
  ordem: number
  titulo: string
  textoAtual: string
  descricaoAlteracao: string
}): string {
  return `Você é um assistente jurídico especializado em reescrita de cláusulas contratuais.

CONTEXTO DO CONTRATO COMPLETO:
${params.textoCompleto}

CLÁUSULA ATUAL A SER REESCRITA (ordem ${params.ordem}): "${params.titulo}"
${params.textoAtual}

DESCRIÇÃO DA ALTERAÇÃO SOLICITADA:
${params.descricaoAlteracao}

INSTRUÇÕES:
- Reescreva EXCLUSIVAMENTE a cláusula acima.
- Mantenha a numeração e o título da cláusula.
- Não altere nenhuma outra cláusula.
- Não adicione nem remova cláusulas.
- Retorne APENAS o texto reescrito da cláusula, sem comentários, sem markdown, sem explicações.
- Mantenha o tom formal e jurídico.
- Preserve as variáveis {{nome}} que existirem no texto.`
}

/**
 * Chama a API Onyx para reescrever uma cláusula.
 * Usa ONYX_API_URL + ONYX_API_KEY (ou token_onyx do usuário).
 */
async function chamarOnyx(prompt: string, userId: number): Promise<string> {
  // Resolver token: prioridade para token_onyx do usuário, fallback ONYX_API_KEY
  let token = process.env.ONYX_API_KEY
  if (!token) {
    const usuario = await db.usuarios.findUnique({
      where: { id: userId },
      select: { token_onyx: true },
    })
    token = usuario?.token_onyx ?? undefined
  }

  if (!token) {
    throw new Error('Onyx não configurado: ONYX_API_KEY ausente e usuário sem token_onyx')
  }

  const baseUrl = process.env.ONYX_API_URL
  if (!baseUrl) {
    throw new Error('ONYX_API_URL não configurada')
  }

  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: process.env.ONYX_AGENT_USER_ID,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Onyx retornou ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json()

  // Extrair texto da resposta — formato pode variar
  const texto =
    data?.choices?.[0]?.message?.content ??
    data?.message ??
    data?.response ??
    data?.text ??
    (typeof data === 'string' ? data : JSON.stringify(data))

  return texto.trim()
}

/**
 * Reescreve uma cláusula de um documento gerado via Onyx.
 * Valida ownership, monta prompt com contexto completo, chama Onyx, atualiza cláusula.
 */
export async function reescreverClausula(params: {
  documentoId: string
  clausulaId: string
  descricaoAlteracao: string
}) {
  const { userId, isAdmin } = await exigirAcessoGeradorDocumentos()

  // Buscar documento com todas as cláusulas (para contexto completo)
  const documento = await db.documentoGerado.findFirst({
    where: { id: params.documentoId, ...(isAdmin ? {} : { criadoPorId: userId }) },
    include: {
      clausulas: { orderBy: { ordem: 'asc' } },
    },
  })

  if (!documento) {
    return { success: false, error: 'Documento não encontrado', code: 'NOT_FOUND' }
  }

  // Encontrar a cláusula alvo
  const clausula = documento.clausulas.find((c) => c.id === params.clausulaId)
  if (!clausula) {
    return { success: false, error: 'Cláusula não encontrada neste documento', code: 'CLAUSULA_NOT_FOUND' }
  }

  // Montar texto completo do documento (todas as cláusulas)
  const textoCompleto = documento.clausulas
    .map((c) => `${c.titulo}\n${c.conteudo}`)
    .join('\n\n')

  // Montar prompt
  const prompt = montarPromptReescrita({
    textoCompleto,
    ordem: clausula.ordem,
    titulo: clausula.titulo,
    textoAtual: clausula.conteudo,
    descricaoAlteracao: params.descricaoAlteracao,
  })

  // Chamar Onyx
  let textoReescrito: string
  try {
    textoReescrito = await chamarOnyx(prompt, userId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido na chamada Onyx'
    return { success: false, error: msg, code: 'ONYX_ERROR' }
  }

  // Validar resposta mínima
  if (!textoReescrito || textoReescrito.length < 10) {
    return { success: false, error: 'Resposta da IA vazia ou insuficiente', code: 'ONYX_EMPTY_RESPONSE' }
  }

  // Atualizar cláusula
  const clausulaAtualizada = await db.documentoClasulaGerada.update({
    where: { id: params.clausulaId },
    data: {
      conteudo: textoReescrito,
      reescritoPorIA: true,
      instrucaoIA: params.descricaoAlteracao,
    },
  })

  return { success: true, data: clausulaAtualizada }
}
