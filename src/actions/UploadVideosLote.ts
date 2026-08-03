'use server'
import db from '@/lib/prisma'
import { auth } from '../../auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { isAdminRole } from '@/lib/roles'

const videoSchema = z.object({
    titulo: z.string().min(1).max(200),
    descricao: z.string().max(2000).optional(),
    url: z.string().url(),
    thumbUrl: z.string().optional(),
    tamanho: z.string().optional(),
})

const payloadSchema = z.object({
    videos: z.array(videoSchema).min(1).max(20),
    moduloId: z.string().min(1),
})

export async function uploadVideosLote(payload: unknown) {
    const session = await auth()
    if (!session?.user || (!isAdminRole(session.user.role) && session.user.role !== 'Master')) {
        return { success: false, error: 'Sem permissão', count: 0, erros: [] }
    }

    const result = payloadSchema.safeParse(payload)
    if (!result.success) return { success: false, error: 'Payload inválido', count: 0, erros: [] }

    const { videos, moduloId } = result.data

    const modulo = await db.modulos.findUnique({ where: { id: moduloId } })
    if (!modulo) return { success: false, error: 'Módulo não encontrado', count: 0, erros: [] }

    const setor = modulo.setor || 'Geral'
    let criados = 0
    const erros: string[] = []

    for (let i = 0; i < videos.length; i++) {
        const v = videos[i]
        try {
            await db.videos.create({
                data: {
                    titulo: v.titulo,
                    setor,
                    url: v.url,
                    descricao: v.descricao || '',
                    thumbUrl: v.thumbUrl || '',
                    tamanho: v.tamanho || '',
                    modulo: {
                        create: [{ modulo: { connect: { id: moduloId } }, ordem: i }]
                    }
                }
            })
            criados++
        } catch (e: any) {
            const msg = e.message?.includes('Unique') || e.message?.includes('unique')
                ? 'Título já existe'
                : 'Erro ao salvar'
            erros.push(`"${v.titulo}": ${msg}`)
        }
    }

    revalidatePath('/PainelAlpha/AlphaSkills')
    revalidatePath(`/PainelAlpha/AlphaSkills/modulo/${moduloId}`)

    return { success: true, count: criados, erros }
}
