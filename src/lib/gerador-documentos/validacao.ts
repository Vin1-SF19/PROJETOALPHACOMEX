import { auth } from '@/auth'
import { isAdminRole } from '@/lib/roles'
import { z } from 'zod'

export const PERMISSAO_MODULO = 'geradorDocumentos'

export interface SessaoGeradorDocumentos {
  userId: number
  role: string | null
  isAdmin: boolean
}

export async function exigirAcessoGeradorDocumentos(): Promise<SessaoGeradorDocumentos> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const userId = Number(session.user.id)
  const role = (session.user as any).role as string | null
  const permissoes: string[] = (session.user as any).permissoes ?? []
  const isAdmin = isAdminRole(role)

  if (!isAdmin && !permissoes.includes(PERMISSAO_MODULO)) {
    throw new Error('Permissão negada: geradorDocumentos')
  }

  return { userId, role, isAdmin }
}

export const templateSchema = z.object({
  titulo: z.string().min(1).max(200),
  descricao: z.string().max(2000).optional().nullable(),
  categoria: z.string().max(100).optional().nullable(),
  variaveis: z.array(
    z.object({
      nome: z.string().regex(/^[a-z_][a-z0-9_]*$/),
      label: z.string().min(1).max(100),
      tipo: z.enum(['texto', 'moeda', 'data', 'numero', 'textarea']),
      obrigatorio: z.boolean().default(true),
      placeholder: z.string().max(200).optional().nullable(),
    })
  ).default([]),
  textoCompleto: z.string().min(1),
})

export const gerarDocumentoSchema = z.object({
  templateId: z.string().min(1),
  variaveis: z.record(z.string()),
  moduloOrigem: z.string().max(100).optional().nullable(),
})

export const reescreverClausulaSchema = z.object({
  documentoId: z.string().min(1),
  clausulaId: z.string().min(1),
  descricaoAlteracao: z.string().min(1).max(2000),
})

export const atualizarTemplateSchema = z.object({
  id: z.string().min(1),
  titulo: z.string().min(1).max(200).optional(),
  descricao: z.string().max(2000).optional().nullable(),
  categoria: z.string().max(100).optional().nullable(),
  variaveis: z.array(
    z.object({
      nome: z.string().regex(/^[a-z_][a-z0-9_]*$/),
      label: z.string().min(1).max(100),
      tipo: z.enum(['texto', 'moeda', 'data', 'numero', 'textarea']),
      obrigatorio: z.boolean().default(true),
      placeholder: z.string().max(200).optional().nullable(),
    })
  ).optional(),
  textoCompleto: z.string().min(1).optional(),
})
