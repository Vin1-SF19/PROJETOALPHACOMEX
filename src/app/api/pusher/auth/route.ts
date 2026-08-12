import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/roles";
import { auth } from "../../../../../auth";
import { pusherServer } from "@/lib/pusher-server.ts";
import {
  CHAMADO_USUARIO_CHANNEL_PREFIX,
  extrairUsuarioIdDoCanalChamados,
  podeReceberNovosChamados,
} from "@/lib/chamados/notificacoes";
import { NOTA_USUARIO_CHANNEL_PREFIX, extrairUsuarioIdDoCanalNotas } from "@/lib/notas/notificacoes";
import {
  BPM_PIPELINE_CHANNEL_PREFIX,
  extrairPipelineIdCanalBpm,
} from "@/lib/bpm/realtime";
import { checarAcessoBpmPipeline } from "@/lib/bpm/ownership";

const ADMIN_CHANNELS = ["private-admin-chamados", "private-parceiros-precadastros"];
const ALL_USER_CHANNELS = ["private-holerite-alerts", "private-metas-alpha"];
const CHECKLIST_ROLES = ["OPERACIONAL"];
const CHECKLIST_CHANNELS = ["private-checklist-docs"];

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new NextResponse("Não autorizado", { status: 401 });
    }

    const formData = await req.formData();
    const socketId = formData.get("socket_id") as string;
    const channelName = formData.get("channel_name") as string;

    if (channelName?.startsWith(BPM_PIPELINE_CHANNEL_PREFIX)) {
      const pipelineId = extrairPipelineIdCanalBpm(channelName);
      if (!pipelineId) {
        return new NextResponse("Canal inválido", { status: 403 });
      }

      const podeAcessar = await checarAcessoBpmPipeline(
        pipelineId,
        Number(session.user.id),
      );
      if (!podeAcessar) {
        return new NextResponse("Proibido", { status: 403 });
      }

      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (ADMIN_CHANNELS.includes(channelName)) {
      const role = session.user.role ?? "";
      if (!podeReceberNovosChamados(role)) {
        return new NextResponse("Proibido", { status: 403 });
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (channelName.startsWith(CHAMADO_USUARIO_CHANNEL_PREFIX)) {
      const channelUserId = extrairUsuarioIdDoCanalChamados(channelName);
      if (channelUserId === null || channelUserId !== Number(session.user.id)) {
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

    if (ALL_USER_CHANNELS.includes(channelName)) {
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (CHECKLIST_CHANNELS.includes(channelName)) {
      const role = session.user.role ?? "";
    if (!isAdminRole(role) && !CHECKLIST_ROLES.includes(role)) {
        return new NextResponse("Proibido", { status: 403 });
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

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
