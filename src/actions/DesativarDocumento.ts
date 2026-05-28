'use server'

import { auth } from '../../auth'
import db from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schema = z.object({
  documentoId: z.number().int().positive(),
})

const ROLES_COM_PERMISSAO = ['admin', 'ceo', 'master', 'ti']

export async function desativarDocumento(documentoId: number) {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Não autenticado' }

  const role = (session.user.role as string | undefined)?.toLowerCase() ?? ''
  if (!ROLES_COM_PERMISSAO.includes(role)) {
    return { success: false, error: 'Sem permissão para desativar documentos' }
  }

  const parsed = schema.safeParse({ documentoId })
  if (!parsed.success) return { success: false, error: 'ID inválido' }

  await db.documentos.update({
    where: { id: parsed.data.documentoId },
    data: { status: 'INATIVO' },
  })

  await db.auditoria.create({
    data: {
      userId: parseInt(session.user.id as string),
      acao: 'DESATIVAR_POP',
      detalhes: `Documento #${parsed.data.documentoId} desativado pelo usuário ${session.user.email ?? ''}`,
    },
  })

  revalidatePath('/PainelAlpha/DocsAlpha')
  return { success: true }
}
