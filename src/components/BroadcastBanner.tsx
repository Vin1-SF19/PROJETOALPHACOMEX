"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, X } from "lucide-react";
import { isAdminRole } from "@/lib/roles";

export default function BroadcastBanner() {
  const { data: session } = useSession();
  const [aviso, setAviso] = useState<any>(null);
  const [visivel, setVisivel] = useState(false);

  const escutarBroadcast = useCallback(async () => {
    if (isAdminRole(session?.user?.role)) return;

    try {
      const res = await fetch(`/api/broadcast?t=${Date.now()}`); 
      if (!res.ok) return;
      
      const data = await res.json();
      
      if (data && data.id) {
        if (data.id !== aviso?.id) {
          setAviso(data);
          setVisivel(true);
          setTimeout(() => setVisivel(false), 180000);
        }
      } else {
        setVisivel(false);
      }
    } catch (e) {
    }
  }, [session, aviso?.id]);

  useEffect(() => {
    if (isAdminRole(session?.user?.role)) return;

    escutarBroadcast();
    const interval = setInterval(escutarBroadcast, 15000); 
    return () => clearInterval(interval);
  }, [session, escutarBroadcast]);

  if (!visivel || !aviso || isAdminRole(session?.user?.role)) return null;

  const estilos: any = {
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
