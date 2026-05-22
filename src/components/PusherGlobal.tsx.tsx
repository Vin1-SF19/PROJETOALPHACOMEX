"use client";

import { useEffect } from "react";
import { pusherClient } from "@/lib/pusher";
import { useSession } from "next-auth/react";
import { create } from "zustand"; // Opcional: use Zustand ou Context para gerenciar o estado global

interface PresenceStore {
  usuariosOnline: number[];
  setUsuariosOnline: (ids: number[]) => void;
}

export const usePresence = create<PresenceStore>((set) => ({
  usuariosOnline: [],
  setUsuariosOnline: (ids) => set({ usuariosOnline: ids }),
}));

export function PusherGlobal() {
  const { data: session } = useSession();
  const setUsuariosOnline = usePresence((state) => state.setUsuariosOnline);

  useEffect(() => {
    if (!session?.user?.id) return;

    const presenceChannel = pusherClient.subscribe("presence-alpha-comm");

    presenceChannel.bind("pusher:subscription_succeeded", (members: any) => {
      const ids: number[] = [];
      members.each((member: any) => ids.push(Number(member.id)));
      setUsuariosOnline(ids);
    });

    presenceChannel.bind("pusher:member_added", (member: any) => {
      setUsuariosOnline([...new Set([...usePresence.getState().usuariosOnline, Number(member.id)])]);
    });

    presenceChannel.bind("pusher:member_removed", (member: any) => {
      setUsuariosOnline(usePresence.getState().usuariosOnline.filter(id => id !== Number(member.id)));
    });

    return () => {
      try {
        pusherClient.unsubscribe("presence-alpha-comm");
      } catch {
        // ignore cleanup errors on closed connection
      }
    };
  }, [session]);

  return null; // Este componente não renderiza nada, apenas gerencia o socket
}