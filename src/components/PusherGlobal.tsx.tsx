"use client";

import { useEffect } from "react";
import { pusherClient } from "@/lib/pusher";
import { useSession } from "next-auth/react";
import { create } from "zustand"; // Opcional: use Zustand ou Context para gerenciar o estado global

interface PresenceStore {
  usuariosOnline: number[];
  setUsuariosOnline: (ids: number[]) => void;
}

interface PresenceMember { id: string | number }
interface PresenceMembers { each: (callback: (member: PresenceMember) => void) => void }

function isPresenceMember(value: unknown): value is PresenceMember {
  return typeof value === "object" && value !== null && "id" in value &&
    (typeof value.id === "string" || typeof value.id === "number");
}

function isPresenceMembers(value: unknown): value is PresenceMembers {
  return typeof value === "object" && value !== null && "each" in value && typeof value.each === "function";
}

export const usePresence = create<PresenceStore>((set) => ({
  usuariosOnline: [],
  setUsuariosOnline: (ids) => set({ usuariosOnline: ids }),
}));

export function PusherGlobal() {
  const { data: session } = useSession();
  const setUsuariosOnline = usePresence((state) => state.setUsuariosOnline);

  useEffect(() => {
    const client = pusherClient;
    if (!session?.user?.id || !client) return;

    const presenceChannel = client.subscribe("presence-alpha-comm");

    presenceChannel.bind("pusher:subscription_succeeded", (members: unknown) => {
      if (!isPresenceMembers(members)) return;
      const ids: number[] = [];
      members.each((member: PresenceMember) => ids.push(Number(member.id)));
      setUsuariosOnline(ids);
    });

    presenceChannel.bind("pusher:member_added", (member: unknown) => {
      if (!isPresenceMember(member)) return;
      setUsuariosOnline([...new Set([...usePresence.getState().usuariosOnline, Number(member.id)])]);
    });

    presenceChannel.bind("pusher:member_removed", (member: unknown) => {
      if (!isPresenceMember(member)) return;
      setUsuariosOnline(usePresence.getState().usuariosOnline.filter(id => id !== Number(member.id)));
    });

    return () => {
      try {
        client.unsubscribe("presence-alpha-comm");
      } catch {
        // ignore cleanup errors on closed connection
      }
    };
  }, [session, setUsuariosOnline]);

  return null; // Este componente não renderiza nada, apenas gerencia o socket
}
