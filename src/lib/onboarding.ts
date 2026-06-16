import db from "@/lib/prisma";

/**
 * Vídeo de onboarding obrigatório (introdução ao IAlpha).
 * Busca o primeiro vídeo do curso configurado em Alpha Skills.
 * Nome do curso configurável via env (default "Introdução ao IAlpha").
 */
const CURSO_NOME = process.env.ONBOARDING_CURSO_NOME ?? "Introdução ao IAlpha";

export interface OnboardingVideo {
  url: string;
  titulo: string;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export async function getOnboardingVideo(): Promise<OnboardingVideo | null> {
  try {
    // 1. Acha o curso de forma tolerante (acento/maiúsculas), com fallback heurístico
    const cursos = await db.curso.findMany({ select: { id: true, nome: true } });
    if (!cursos.length) return null;

    const target = norm(CURSO_NOME);
    const match =
      cursos.find(c => norm(c.nome) === target) ??
      cursos.find(c => norm(c.nome).includes("introdu") && norm(c.nome).includes("alpha"));
    if (!match) return null;

    // 2. Pega o primeiro vídeo do primeiro módulo do curso
    const curso = await db.curso.findUnique({
      where: { id: match.id },
      include: {
        modulos: {
          orderBy: { ordem: "asc" },
          take: 1,
          include: {
            modulo: {
              include: {
                videos: { orderBy: { ordem: "asc" }, take: 1, include: { video: true } },
              },
            },
          },
        },
      },
    });

    const v = curso?.modulos[0]?.modulo?.videos[0]?.video;
    return v ? { url: v.url, titulo: v.titulo } : null;
  } catch {
    return null;
  }
}
