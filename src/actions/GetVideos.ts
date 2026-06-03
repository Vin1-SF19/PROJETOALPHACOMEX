"use server"
import db from "@/lib/prisma";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

export async function getVideos() {
    try {
        const videos = await db.videos.findMany({
            orderBy: {
                ordem: 'asc'
            },
            include: {
                modulo: {
                    include: {
                        modulo: true
                    }
                }
            }
        });

        return videos.map((v: typeof videos[number]) => ({
            ...v,
            ordem: v.ordem ?? 0,
            modulo: v.modulo ? v.modulo.map((m: typeof v.modulo[number]) => m.modulo) : []
        }));

    } catch (error) {
        console.error("Erro Crítico ao buscar vídeos no banco:", error);
        return [];
    }
}

export async function getVideosDoModulo(moduloId: string) {
    try {
        const dados = await db.moduloVideo.findMany({
            where: { moduloId },
            include: { video: true },
            orderBy: { ordem: 'asc' }
        });
        return dados.map((item: typeof dados[number]) => ({ ...item.video, ordem: item.ordem }));
    } catch (error) {
        return [];
    }
}

export async function createVideo(input: {
    titulo: string;
    setor: string;
    url: string;
    descricao?: string;
    thumbUrl?: string;
    tamanho?: string;
    modulosIds: string[];
}) {
    try {
        const idsValidos = input.modulosIds.filter(id => id && id.length > 0);

        const video = await db.videos.create({
            data: {
                titulo: input.titulo,
                setor: input.setor,
                url: input.url,
                descricao: input.descricao || "",
                thumbUrl: input.thumbUrl || "",
                tamanho: input.tamanho || "",
                modulo: {
                    create: idsValidos.map((mId: string) => ({
                        modulo: {
                            connect: { id: mId }
                        }
                    }))
                }
            }
        });

        revalidatePath("/PainelAlpha/AlphaSkills/Gerenciamento");
        return { success: true, video };
    } catch (error: any) {
        console.error("ERRO NO CREATE:", error);
        return { success: false, error: error.message };
    }
}

export async function updateVideoOrder(moduloId: string, videoIds: string[]) {
    try {
        const updates = videoIds.map((id, index) =>
            db.moduloVideo.update({
                where: {
                    moduloId_videoId: { moduloId, videoId: id }
                },
                data: { ordem: index }
            })
        );

        await db.$transaction(updates);
        revalidatePath("/PainelAlpha/AlphaSkills");
        return { success: true };
    } catch (error) {
        console.error("Erro ao ordenar:", error);
        return { success: false, message: "Erro ao ordenar" };
    }
}

export async function deleteVideo(id: string, videoUrl: string, thumbUrl?: string) {
    try {
        await db.videos.deleteMany({
            where: { id }
        });

        try {
            const options = { token: process.env.SKILLS_READ_WRITE_TOKEN };
            if (videoUrl) await del(videoUrl, options);
            if (thumbUrl) await del(thumbUrl, options);
        } catch (blobErr) {
            console.warn("Arquivos não limpos no Blob.");
        }

        revalidatePath("/PainelAlpha/AlphaSkills");
        return { success: true };
    } catch (error) {
        console.error("Erro ao deletar:", error);
        return { success: false, error: "Erro ao deletar vídeo." };
    }
}

export async function updateVideoData(id: string, data: any) {
    try {
        const idsValidos = data.modulosIds.filter((mid: any) => mid);

        const video = await db.videos.update({
            where: { id },
            data: {
                titulo: data.titulo,
                descricao: data.descricao,
                url: data.url,
                thumbUrl: data.thumbUrl,
                setor: data.setor,
                modulo: {
                    deleteMany: {},
                    create: idsValidos.map((moduloId: string) => ({
                        modulo: {
                            connect: { id: moduloId }
                        }
                    }))
                }
            }
        });

        revalidatePath("/PainelAlpha/AlphaSkills");
        return video;
    } catch (error) {
        console.error("Erro ao atualizar vídeo:", error);
        throw error;
    }
}

export async function createModulo(
    nome: string,
    imagemUrl: string,
    descricao: string,
    aprendizado: string,
    bloqueado: boolean,
    requerModuloId: string | null = null,
    percentualMinimo: number = 100,
    cursosIds: string[] = []
) {
    try {
        let setor = 'Geral'
        if (cursosIds.length > 0) {
            const cursos = await db.curso.findMany({
                where: { id: { in: cursosIds } },
                include: { setores: true }
            })
            const setoresUnicos = [...new Set(cursos.flatMap(c => c.setores.map(s => s.setor)))]
            if (setoresUnicos.length > 0) setor = setoresUnicos.join(', ')
        }

        const modulo = await db.modulos.create({
            data: {
                nome,
                setor,
                imagemUrl,
                descricao,
                aprendizado,
                bloqueado,
                percentualMinimo,
                requerModuloId,
                ...(cursosIds.length > 0 && {
                    cursos: {
                        create: cursosIds.map((cursoId, i) => ({ cursoId, ordem: i }))
                    }
                })
            }
        })
        revalidatePath("/PainelAlpha/AlphaSkills/Gerenciamento");
        return { success: true, id: modulo.id };
    } catch (error) {
        return { success: false };
    }
}

export async function getModulos() {
    try {
        return await db.modulos.findMany({
            orderBy: { nome: 'asc' },
            include: {
                cursos: {
                    include: {
                        curso: { select: { id: true, nome: true, capa: true } }
                    },
                    orderBy: { ordem: 'asc' },
                    take: 1,
                }
            }
        });
    } catch (error) {
        console.error("Erro ao buscar módulos:", error);
        return [];
    }
}

export async function updateModulo(
    id: string,
    nome: string,
    imagemUrl: string,
    descricao?: string,
    aprendizado?: string,
    bloqueado?: boolean,
    requerModuloId: string | null = null,
    percentualMinimo: number = 100,
    cursosIds: string[] = []
) {
    try {
        let setor = 'Geral'
        if (cursosIds.length > 0) {
            const cursos = await db.curso.findMany({
                where: { id: { in: cursosIds } },
                include: { setores: true }
            })
            const setoresUnicos = [...new Set(cursos.flatMap(c => c.setores.map(s => s.setor)))]
            if (setoresUnicos.length > 0) setor = setoresUnicos.join(', ')
        }

        await db.cursoModulo.deleteMany({ where: { moduloId: id } })

        await db.modulos.update({
            where: { id },
            data: {
                nome,
                setor,
                imagemUrl,
                descricao,
                aprendizado,
                bloqueado,
                requerModuloId,
                percentualMinimo,
                ...(cursosIds.length > 0 && {
                    cursos: {
                        create: cursosIds.map((cursoId, i) => ({ cursoId, ordem: i }))
                    }
                })
            }
        })
        revalidatePath("/PainelAlpha/AlphaSkills/Gerenciamento");
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

export async function marcarAulaComoConcluida(userId: string, aulaId: string) {
    try {
        await db.progressoAula.upsert({
            where: {
                userId_aulaId: { userId, aulaId }
            },
            update: { concluido: true },
            create: { userId, aulaId, concluido: true }
        });

        revalidatePath("/PainelAlpha/AlphaSkills");
        return { success: true };
    } catch (error) {
        console.error("Erro no Banco:", error);
        return { success: false };
    }
}

export async function getUserProgresso(userId: string) {
    return await db.progressoAula.findMany({
        where: { userId }
    });
}

export async function salvarProgresso(userId: string, aulaId: string) {
    await db.progressoAula.upsert({
        where: { userId_aulaId: { userId, aulaId } },
        update: { concluido: true },
        create: { userId, aulaId, concluido: true }
    });
}

export async function getVideosAction() {
    try {
        const videos = await db.videos.findMany({
            select: {
                id: true,
                titulo: true,
                setor: true,
            },
            orderBy: {
                titulo: 'asc'
            }
        });
        return videos;
    } catch (error) {
        console.error("Erro ao buscar vídeos:", error);
        return [];
    }
}