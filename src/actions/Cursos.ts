'use server'
import db from '@/lib/prisma'
import { auth } from '../../auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { isAdminRole } from '@/lib/roles'

const SETORES_VALIDOS = ["T.I", "Comercial", "Operacional", "Financeiro", "Recursos-Humanos", "Serviços Gerais"]

export async function getAllCursos() {
    try {
        const cursos = await db.curso.findMany({
            orderBy: { ordem: 'asc' },
            include: {
                setores: true,
                modulos: {
                    orderBy: { ordem: 'asc' },
                    include: { modulo: true }
                }
            }
        })
        return cursos.map(c => ({
            id: c.id,
            nome: c.nome,
            descricao: c.descricao,
            capa: c.capa,
            ordem: c.ordem,
            setores: c.setores.map(s => s.setor),
            modulos: c.modulos.map(cm => ({
                ...cm.modulo,
                ordemNoCurso: cm.ordem
            }))
        }))
    } catch {
        return []
    }
}

export async function getCursosPorSetor(setor: string | null) {
    try {
        const where = setor && setor !== 'Todos'
            ? { setores: { some: { setor } } }
            : {}
        const cursos = await db.curso.findMany({
            where,
            orderBy: { ordem: 'asc' },
            include: {
                setores: true,
                modulos: {
                    orderBy: { ordem: 'asc' },
                    include: { modulo: true }
                }
            }
        })
        return cursos.map(c => ({
            id: c.id,
            nome: c.nome,
            descricao: c.descricao,
            capa: c.capa,
            ordem: c.ordem,
            setores: c.setores.map(s => s.setor),
            modulos: c.modulos.map(cm => ({
                ...cm.modulo,
                ordemNoCurso: cm.ordem
            }))
        }))
    } catch {
        return []
    }
}

export async function listarCursosParaSelect() {
    try {
        return await db.curso.findMany({
            select: { id: true, nome: true },
            orderBy: { nome: 'asc' }
        })
    } catch {
        return []
    }
}

export async function listarSetoresDistintos() {
    return SETORES_VALIDOS
}

const criarCursoSchema = z.object({
    nome: z.string().min(1).max(200),
    descricao: z.string().max(2000).optional(),
    capa: z.string().optional(),
    setores: z.array(z.string().min(1)).min(1),
    modulosIds: z.array(z.string()).optional().default([]),
})

export async function criarCurso(payload: unknown) {
    const session = await auth()
    if (!session?.user || (!isAdminRole(session.user.role) && session.user.role !== 'Master')) {
        return { success: false, error: 'Sem permissão' }
    }

    const result = criarCursoSchema.safeParse(payload)
    if (!result.success) return { success: false, error: result.error.flatten() }

    const { nome, descricao, capa, setores, modulosIds } = result.data
    const setoresValidos = setores.filter(s => SETORES_VALIDOS.includes(s))
    if (setoresValidos.length === 0) return { success: false, error: 'Nenhum setor válido' }

    try {
        const curso = await db.curso.create({
            data: {
                nome,
                descricao,
                capa: capa || null,
                setores: {
                    create: setoresValidos.map(s => ({ setor: s }))
                },
                ...(modulosIds.length > 0 && {
                    modulos: {
                        create: modulosIds.map((moduloId, i) => ({ moduloId, ordem: i }))
                    }
                })
            }
        })
        revalidatePath('/PainelAlpha/AlphaSkills')
        return { success: true, id: curso.id }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

const editarCursoSchema = z.object({
    id: z.string(),
    nome: z.string().min(1).max(200),
    descricao: z.string().max(2000).optional(),
    capa: z.string().optional(),
    setores: z.array(z.string().min(1)).min(1),
    modulosIds: z.array(z.string()).optional().default([]),
})

export async function editarCurso(payload: unknown) {
    const session = await auth()
    if (!session?.user || (!isAdminRole(session.user.role) && session.user.role !== 'Master')) {
        return { success: false, error: 'Sem permissão' }
    }

    const result = editarCursoSchema.safeParse(payload)
    if (!result.success) return { success: false, error: result.error.flatten() }

    const { id, nome, descricao, capa, setores, modulosIds } = result.data
    const setoresValidos = setores.filter(s => SETORES_VALIDOS.includes(s))

    try {
        await db.cursoSetor.deleteMany({ where: { cursoId: id } })
        await db.cursoModulo.deleteMany({ where: { cursoId: id } })
        await db.curso.update({
            where: { id },
            data: {
                nome,
                descricao,
                capa: capa || null,
                setores: {
                    createMany: { data: setoresValidos.map(s => ({ setor: s })) }
                },
                ...(modulosIds.length > 0 && {
                    modulos: {
                        createMany: { data: modulosIds.map((moduloId, i) => ({ moduloId, ordem: i })) }
                    }
                })
            }
        })
        revalidatePath('/PainelAlpha/AlphaSkills')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deletarCurso(id: string) {
    const session = await auth()
    if (!session?.user || (!isAdminRole(session.user.role) && session.user.role !== 'Master')) {
        return { success: false, error: 'Sem permissão' }
    }
    try {
        await db.curso.delete({ where: { id } })
        revalidatePath('/PainelAlpha/AlphaSkills')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function vincularModuloACurso(cursoId: string, moduloId: string) {
    const session = await auth()
    if (!session?.user || (!isAdminRole(session.user.role) && session.user.role !== 'Master')) {
        return { success: false, error: 'Sem permissão' }
    }
    try {
        await db.cursoModulo.upsert({
            where: { cursoId_moduloId: { cursoId, moduloId } },
            create: { cursoId, moduloId },
            update: {}
        })
        revalidatePath('/PainelAlpha/AlphaSkills')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function desvincularModuloDeCurso(cursoId: string, moduloId: string) {
    const session = await auth()
    if (!session?.user || (!isAdminRole(session.user.role) && session.user.role !== 'Master')) {
        return { success: false, error: 'Sem permissão' }
    }
    try {
        await db.cursoModulo.delete({
            where: { cursoId_moduloId: { cursoId, moduloId } }
        })
        revalidatePath('/PainelAlpha/AlphaSkills')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateModuloOrderInCurso(cursoId: string, moduloIds: string[]) {
    const session = await auth()
    if (!session?.user || (!isAdminRole(session.user.role) && session.user.role !== 'Master')) {
        return { success: false, error: 'Sem permissão' }
    }
    try {
        await db.$transaction(
            moduloIds.map((moduloId, index) =>
                db.cursoModulo.update({
                    where: { cursoId_moduloId: { cursoId, moduloId } },
                    data: { ordem: index },
                })
            )
        )
        revalidatePath('/PainelAlpha/AlphaSkills')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
