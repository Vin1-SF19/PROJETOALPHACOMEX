"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, X } from "lucide-react";
import { isAdminRole } from "@/lib/roles";

type Aviso = { id: string | number; tipo: "warning" | "error" | "info"; mensagem: string };

export default function BroadcastBanner() {
  const { data: session } = useSession();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [visivel, setVisivel] = useState(false);
  const avisoIdRef = useRef<Aviso["id"] | undefined>(undefined);

  useEffect(() => {
    if (isAdminRole(session?.user?.role)) return;
    let active = true;
    let dismissalTimeout: ReturnType<typeof setTimeout> | undefined;

    const escutarBroadcast = async () => {
      try {
        const res = await fetch(`/api/broadcast?t=${Date.now()}`);
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (!active) return;

        if (data && typeof data === "object" && "id" in data &&
            (typeof data.id === "string" || typeof data.id === "number") &&
            "mensagem" in data && typeof data.mensagem === "string" &&
            "tipo" in data && (data.tipo === "warning" || data.tipo === "error" || data.tipo === "info")) {
          if (data.id !== avisoIdRef.current) {
            avisoIdRef.current = data.id;
            setAviso(data as Aviso);
            setVisivel(true);
            if (dismissalTimeout) clearTimeout(dismissalTimeout);
            dismissalTimeout = setTimeout(() => setVisivel(false), 180000);
          }
        } else {
          avisoIdRef.current = undefined;
          setVisivel(false);
        }
      } catch {
        // A próxima sondagem tenta novamente após uma falha de rede.
      }
    };

    void escutarBroadcast();
    const interval = setInterval(() => void escutarBroadcast(), 15000);
    return () => {
      active = false;
      clearInterval(interval);
      if (dismissalTimeout) clearTimeout(dismissalTimeout);
    };
  }, [session?.user?.role]);

  if (!visivel || !aviso || isAdminRole(session?.user?.role)) return null;

  const estilos: Record<Aviso["tipo"], string> = {
    warning: "bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-amber-500/20",
    error: "bg-red-500/10 border-red-500/50 text-red-500 shadow-red-500/20",
    info: "bg-blue-500/10 border-blue-500/50 text-blue-500 shadow-blue-500/20"
  };

  return (
    <div className={`w-full border-b backdrop-blur-md p-3 relative z-50 animate-in slide-in-from-top duration-700 ${estilos[aviso.tipo] || estilos.warning}`}>
      <div className="max-w-[1800px] mx-auto flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] italic">
        <AlertTriangle size={16} className="animate-pulse" />
        <span className="text-center">{aviso.mensagem}</span>
        <button onClick={() => setVisivel(false)} className="absolute right-6 cursor-pointer opacity-40 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
