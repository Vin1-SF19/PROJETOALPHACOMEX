import db from "@/lib/prisma";
import { canalReservadoChecklist } from "@/lib/checklist/realtime";
import { obterAtorChamados, podeVerChamado, chamadoAcessoSelect } from "@/lib/chamados/acesso";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isParceirosAdminRole } from "@/lib/roles";
import { auth } from "../../../../../auth";
import { pusherServer } from "@/lib/pusher-server.ts";
import {
  CHAMADO_USUARIO_CHANNEL_PREFIX,
  extrairUsuarioIdDoCanalChamados,
  CHAT_CHAMADO_CHANNEL_PREFIX,
  extrairChamadoIdDoCanalChat,
} from "@/lib/chamados/notificacoes";
import { NOTA_USUARIO_CHANNEL_PREFIX, extrairUsuarioIdDoCanalNotas } from "@/lib/notas/notificacoes";
import {
  CALENDARIO_ALPHA_USUARIO_CHANNEL_PREFIX,
  extrairUsuarioIdDoCanalCalendarioAlpha,
} from "@/lib/google-calendar/notificacoes";
import {
  BPM_PIPELINE_CHANNEL_PREFIX,
  extrairPipelineIdCanalBpm,
} from "@/lib/bpm/realtime";
import { BPM_TAREFA_USUARIO_CHANNEL_PREFIX, extrairUsuarioIdCanalTarefasBpm } from "@/lib/bpm/notificacoes-tarefas";
import { checarAcessoModuloBpm, checarAcessoRealtimeBpmPipeline } from "@/lib/bpm/ownership";

const ADMIN_CHANNELS = ["private-admin-chamados"];
const PARCEIROS_PRECADASTROS_CHANNEL = "private-parceiros-precadastros";
const ALL_USER_CHANNELS = ["private-holerite-alerts", "private-metas-alpha"];

const channelAuthSchema = z.object({
  socketId: z.string().min(1).refine((value) => value.trim().length > 0),
  channelName: z.string().min(1).refine((value) => value.trim().length > 0),
});

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new NextResponse("Não autorizado", { status: 401 });
    }

    const formData = await req.formData();
    const input = channelAuthSchema.safeParse({
      socketId: formData.get("socket_id"),
      channelName: formData.get("channel_name"),
    });
    if (!input.success) {
      return new NextResponse("Dados inválidos", { status: 400 });
    }
    const { socketId, channelName } = input.data;

    if (canalReservadoChecklist(channelName)) {
      return new NextResponse("Proibido", { status: 403 });
    }

    if (channelName?.startsWith(BPM_TAREFA_USUARIO_CHANNEL_PREFIX)) {
      const usuarioId = extrairUsuarioIdCanalTarefasBpm(channelName);
      if (usuarioId === null || usuarioId !== Number(session.user.id) || !await checarAcessoModuloBpm(usuarioId)) {
        return new NextResponse("Proibido", { status: 403 });
      }
      return NextResponse.json(pusherServer.authorizeChannel(socketId, channelName));
    }

    if (channelName?.startsWith(BPM_PIPELINE_CHANNEL_PREFIX)) {
      const pipelineId = extrairPipelineIdCanalBpm(channelName);
      if (!pipelineId) {
        return new NextResponse("Canal inválido", { status: 403 });
      }

      const podeAcessar = await checarAcessoRealtimeBpmPipeline(
        pipelineId,
        Number(session.user.id),
      );
      if (!podeAcessar) {
        return new NextResponse("Proibido", { status: 403 });
      }

      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (channelName?.startsWith(CHAT_CHAMADO_CHANNEL_PREFIX)) {
      const chamadoId = extrairChamadoIdDoCanalChat(channelName);
      const ator = await obterAtorChamados(session.user.id);
      if (!chamadoId || !ator) return new NextResponse("Proibido", { status: 403 });
      const chamado = await db.chamados.findUnique({ where: { id: chamadoId }, select: chamadoAcessoSelect });
      if (!chamado || !podeVerChamado(ator, chamado)) return new NextResponse("Proibido", { status: 403 });
      return NextResponse.json(pusherServer.authorizeChannel(socketId, channelName));
    }

    if (ADMIN_CHANNELS.includes(channelName)) {
      const ator = await obterAtorChamados(session.user.id);
      if (!ator?.visaoGlobal) {
        return new NextResponse("Proibido", { status: 403 });
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (channelName === PARCEIROS_PRECADASTROS_CHANNEL) {
      const role = session.user.role ?? "";
      if (!isParceirosAdminRole(role)) {
        return new NextResponse("Proibido", { status: 403 });
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (channelName.startsWith(CHAMADO_USUARIO_CHANNEL_PREFIX)) {
      const channelUserId = extrairUsuarioIdDoCanalChamados(channelName);
      if (channelUserId === null || channelUserId !== Number(session.user.id) || !await obterAtorChamados(session.user.id)) {
        return new NextResponse("Proibido", { status: 403 });
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (channelName.startsWith(NOTA_USUARIO_CHANNEL_PREFIX)) {
      const channelUserId = extrairUsuarioIdDoCanalNotas(channelName);
      if (channelUserId === null || channelUserId !== Number(session.user.id)) {
        return new NextResponse("Proibido", { status: 403 });
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (channelName.startsWith(CALENDARIO_ALPHA_USUARIO_CHANNEL_PREFIX)) {
      const channelUserId = extrairUsuarioIdDoCanalCalendarioAlpha(channelName);
      if (channelUserId === null || channelUserId !== Number(session.user.id)) {
        return new NextResponse("Proibido", { status: 403 });
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (ALL_USER_CHANNELS.includes(channelName)) {
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (channelName.startsWith("chat-chamado-")) return new NextResponse("Proibido", { status: 403 });

    const presenceData = {
      user_id: session.user.id.toString(),
      user_info: {
        name: session.user.nome,
      },
    };

    const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("Erro no Pusher Auth:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
