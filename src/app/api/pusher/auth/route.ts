import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { pusherServer } from "@/lib/pusher-server.ts";

const ADMIN_ROLES = ["Admin", "CEO"];
const ADMIN_CHANNELS = ["private-admin-chamados"];
const ALL_USER_CHANNELS = ["private-holerite-alerts"];

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new NextResponse("Não autorizado", { status: 401 });
    }

    const formData = await req.formData();
    const socketId = formData.get("socket_id") as string;
    const channelName = formData.get("channel_name") as string;

    if (ADMIN_CHANNELS.includes(channelName)) {
      const role = session.user.role ?? "";
      if (!ADMIN_ROLES.includes(role)) {
        return new NextResponse("Proibido", { status: 403 });
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channelName);
      return NextResponse.json(authResponse);
    }

    if (ALL_USER_CHANNELS.includes(channelName)) {
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