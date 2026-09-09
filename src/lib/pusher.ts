import Pusher from "pusher-js";

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim();
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim();

// Realtime é opcional para a renderização da aplicação. Uma configuração
// ausente nunca pode derrubar a hidratação inteira do painel no navegador.
export const pusherClient: Pusher | null =
  typeof window !== "undefined" && pusherKey && pusherCluster
    ? new Pusher(pusherKey, {
        cluster: pusherCluster,
        channelAuthorization: {
          endpoint: "/api/pusher/auth",
          transport: "ajax",
        },
      })
    : null;
