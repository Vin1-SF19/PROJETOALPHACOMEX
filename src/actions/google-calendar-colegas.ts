"use server";

import { revalidatePath } from "next/cache";

import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import { listarEventosPagina } from "@/lib/google-calendar/client";
import { isAdminRole, proximaCorColega } from "@/lib/google-calendar/colegas";
import { GoogleCalendarError } from "@/lib/google-calendar/errors";
import { corHexSchema } from "@/lib/validations/google-calendar";
import db from "@/lib/prisma";

const JANELA_MAXIMA_PAGINAS_COLEGA = 10; // teto de segurança — ver sync.ts para o mesmo racional

type ResultadoAcao<T> = { success: true; data: T } | { success: false; error: string };

async function obterUsuarioAtual(userId: number) {
  return db.usuarios.findUnique({ where: { id: userId }, select: { role: true, email: true, nome: true } });
}

/** Admin/CEO sempre tem permissão; qualquer outro usuário precisa de uma linha em GoogleCalendarPermissaoColegas. */
async function temPermissaoCompartilhamento(userId: number, role: string | undefined): Promise<boolean> {
  if (isAdminRole(role)) return true;
  const registro = await db.googleCalendarPermissaoColegas.findUnique({ where: { userId } });
  return registro !== null;
}

/** Lista colaboradores ATIVOS que podem ser adicionados à visão do usuário (exclui a si mesmo e quem já foi adicionado). */
export async function listarUsuariosParaCompartilhar(): Promise<ResultadoAcao<{ id: number; nome: string; email: string }[]>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const usuarioAtual = await obterUsuarioAtual(acesso.userId);
  const callerPermitido = await temPermissaoCompartilhamento(acesso.userId, usuarioAtual?.role);
  if (!callerPermitido) {
    return { success: false, error: "Você ainda não tem permissão para compartilhar agenda com colegas. Peça a um Admin para liberar." };
  }

  const jaAdicionados = await db.googleCalendarColegaVisivel.findMany({
    where: { userId: acesso.userId },
    select: { colegaId: true },
  });
  const idsExcluidos = new Set([acesso.userId, ...jaAdicionados.map((c) => c.colegaId)]);

  // A permissão controla só quem pode USAR o botão de adicionar (já checado acima) — qualquer
  // colaborador ativo pode ser alvo, permitido ou não (ex.: líder liberado adiciona a agenda de
  // um colaborador comum do time, que nunca vai ter essa permissão).
  const usuarios = await db.usuarios.findMany({
    where: { status: "ATIVO", id: { notIn: Array.from(idsExcluidos) } },
    select: { id: true, nome: true, email: true },
    orderBy: { nome: "asc" },
  });

  return { success: true, data: usuarios };
}

/** Colegas já adicionados à visão do usuário logado, com cor e visibilidade. */
export async function listarColegasVisiveis() {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false as const, error: "Não autorizado." };

  const colegas = await db.googleCalendarColegaVisivel.findMany({
    where: { userId: acesso.userId },
    include: { colega: { select: { id: true, nome: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return { success: true as const, data: colegas };
}

export async function adicionarColegaVisivel(colegaId: number): Promise<ResultadoAcao<{ id: string }>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  if (!Number.isInteger(colegaId) || colegaId === acesso.userId) {
    return { success: false, error: "Colega inválido." };
  }

  const usuarioAtual = await obterUsuarioAtual(acesso.userId);
  const callerPermitido = await temPermissaoCompartilhamento(acesso.userId, usuarioAtual?.role);
  if (!callerPermitido) {
    return { success: false, error: "Você ainda não tem permissão para compartilhar agenda com colegas. Peça a um Admin para liberar." };
  }

  // Só quem adiciona precisa estar permitido — o alvo pode ser qualquer colaborador ativo,
  // permitido ou não (ex.: líder liberado adicionando a agenda de alguém do time).
  const colega = await db.usuarios.findUnique({ where: { id: colegaId }, select: { id: true, status: true } });
  if (!colega || colega.status !== "ATIVO") return { success: false, error: "Colaborador não encontrado." };

  const totalAtual = await db.googleCalendarColegaVisivel.count({ where: { userId: acesso.userId } });

  const registro = await db.googleCalendarColegaVisivel.upsert({
    where: { userId_colegaId: { userId: acesso.userId, colegaId } },
    create: { userId: acesso.userId, colegaId, cor: proximaCorColega(totalAtual), visivel: true },
    update: { visivel: true },
    select: { id: true },
  });

  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true, data: registro };
}

export async function removerColegaVisivel(colegaId: number): Promise<{ success: boolean; error?: string }> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  await db.googleCalendarColegaVisivel.deleteMany({ where: { userId: acesso.userId, colegaId } });
  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true };
}

export async function alternarVisibilidadeColega(colegaId: number, visivel: boolean): Promise<{ success: boolean; error?: string }> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  await db.googleCalendarColegaVisivel.updateMany({
    where: { userId: acesso.userId, colegaId },
    data: { visivel },
  });
  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true };
}

/** Personaliza a cor usada para diferenciar este colega na grade do usuário logado. */
export async function personalizarCorColega(colegaId: number, cor: string): Promise<{ success: boolean; error?: string }> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = corHexSchema.safeParse(cor);
  if (!validacao.success) return { success: false, error: validacao.error.issues[0]?.message ?? "Cor inválida." };

  await db.googleCalendarColegaVisivel.updateMany({
    where: { userId: acesso.userId, colegaId },
    data: { cor: validacao.data },
  });
  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true };
}

export interface EventoColegaDTO {
  id: string;
  googleEventId: string;
  status: string;
  titulo: string | null;
  inicioEm: string | null;
  fimEm: string | null;
  diaInteiro: boolean;
  etag: string;
  linkMeet: string | null;
  colegaId: number;
  colegaNome: string;
  colegaEmail: string;
  cor: string;
  gravavel: boolean;
}

/**
 * Lê a agenda de um colega ao vivo (sem cache/syncToken — é uma visão "de relance", não a agenda
 * própria do usuário). Exige que o colega esteja na lista de visibilidade do viewer OU que o
 * viewer seja Admin/CEO (que enxerga qualquer colaborador, decisão confirmada com o usuário).
 * Também exige que o viewer continue com a permissão de compartilhamento ativa — se um Admin
 * revogar depois de o compartilhamento já existir, o acesso para de funcionar imediatamente. O
 * colega (dono da agenda) NÃO precisa ter essa permissão — ela só controla quem pode usar o botão
 * de adicionar/consultar, não quem pode ser consultado.
 */
export async function listarEventosDeColega(
  colegaId: number,
  inicioISO: string,
  fimISO: string,
): Promise<ResultadoAcao<EventoColegaDTO[]>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const usuarioAtual = await obterUsuarioAtual(acesso.userId);
  const admin = isAdminRole(usuarioAtual?.role);

  const colega = await db.usuarios.findUnique({ where: { id: colegaId }, select: { id: true, nome: true, email: true } });
  if (!colega) return { success: false, error: "Colaborador não encontrado." };

  if (!admin) {
    const callerPermitido = await temPermissaoCompartilhamento(acesso.userId, usuarioAtual?.role);
    if (!callerPermitido) {
      return { success: false, error: "Você não tem mais permissão para usar o compartilhamento de agenda." };
    }

    const compartilhado = await db.googleCalendarColegaVisivel.findUnique({
      where: { userId_colegaId: { userId: acesso.userId, colegaId } },
    });
    if (!compartilhado || !compartilhado.visivel) {
      return { success: false, error: "Você não tem acesso à agenda deste colaborador." };
    }
  }

  const corRegistro = await db.googleCalendarColegaVisivel.findUnique({
    where: { userId_colegaId: { userId: acesso.userId, colegaId } },
    select: { cor: true },
  });
  const cor = corRegistro?.cor ?? "#f97316";

  try {
    const eventos: EventoColegaDTO[] = [];
    let pageToken: string | undefined;
    let paginas = 0;

    do {
      const pagina = await listarEventosPagina({
        emailUsuario: colega.email,
        calendarId: colega.email,
        pageToken,
        timeMin: inicioISO,
        timeMax: fimISO,
      });
      paginas += 1;

      for (const evento of pagina.eventos) {
        if (evento.status === "cancelled") continue;
        eventos.push({
          id: `colega-${colega.id}-${evento.googleEventId}`,
          googleEventId: evento.googleEventId,
          status: evento.status,
          titulo: evento.titulo,
          inicioEm: evento.inicio.dataHora ?? evento.inicio.data ?? null,
          fimEm: evento.fim.dataHora ?? evento.fim.data ?? null,
          diaInteiro: Boolean(evento.inicio.data && !evento.inicio.dataHora),
          etag: evento.etag,
          linkMeet: evento.linkMeet,
          colegaId: colega.id,
          colegaNome: colega.nome,
          colegaEmail: colega.email,
          cor,
          gravavel: admin,
        });
      }

      pageToken = pagina.proximoPageToken ?? undefined;
    } while (pageToken && paginas < JANELA_MAXIMA_PAGINAS_COLEGA);

    return { success: true, data: eventos };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError) return { success: false, error: erro.message };
    throw erro;
  }
}

export interface UsuarioPermissaoColegaDTO {
  id: number;
  nome: string;
  email: string;
  role: string;
  permitido: boolean;
}

/** Admin-only: lista todos os colaboradores ATIVOS com o status atual da permissão de compartilhamento. */
export async function listarPermissoesColegasTodosUsuarios(): Promise<ResultadoAcao<UsuarioPermissaoColegaDTO[]>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const usuarioAtual = await obterUsuarioAtual(acesso.userId);
  if (!isAdminRole(usuarioAtual?.role)) return { success: false, error: "Só Admin/CEO pode gerenciar essa permissão." };

  const usuarios = await db.usuarios.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true, email: true, role: true, permissaoColegasCalendario: { select: { userId: true } } },
    orderBy: { nome: "asc" },
  });

  return {
    success: true,
    data: usuarios.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      permitido: isAdminRole(u.role) || Boolean(u.permissaoColegasCalendario),
    })),
  };
}

/** Admin-only: concede ou revoga a permissão de um usuário usar o compartilhamento de agenda entre colegas. */
export async function alternarPermissaoColegas(alvoUserId: number, permitir: boolean): Promise<{ success: boolean; error?: string }> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const usuarioAtual = await obterUsuarioAtual(acesso.userId);
  if (!isAdminRole(usuarioAtual?.role)) return { success: false, error: "Só Admin/CEO pode gerenciar essa permissão." };

  if (!Number.isInteger(alvoUserId)) return { success: false, error: "Usuário inválido." };

  if (permitir) {
    await db.googleCalendarPermissaoColegas.upsert({
      where: { userId: alvoUserId },
      create: { userId: alvoUserId, concedidoPor: acesso.userId },
      update: {},
    });
  } else {
    await db.googleCalendarPermissaoColegas.deleteMany({ where: { userId: alvoUserId } });
  }

  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true };
}
