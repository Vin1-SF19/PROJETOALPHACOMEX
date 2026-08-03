"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getTema } from "@/lib/temas";
import AlphaPresetsConfig from "../AlphaPresets";
import { isAdminRole } from "@/lib/roles";


export default function PresetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [videos, setVideos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user && !isAdminRole(session.user.role)) {
      router.push("/PainelAlpha");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const user = session?.user as any;
  const temaConfig = getTema(user?.tema_interface || "blue");

  return (
    <main className="min-h-screen bg-[#020617] p-8 lg:p-16 text-white relative overflow-x-hidden">
        
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] ${temaConfig.glow} blur-[150px] rounded-full opacity-50 transition-all duration-700`} />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-12">
          <div className="mt-8">
            <h1 className="text-4xl font-black uppercase italic tracking-tighter">
              Gestão de <span className={temaConfig.text}>Presets</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 italic">Configuração de Trilhas e Provas</p>
          </div>
        </header>


        <AlphaPresetsConfig 
          temaConfig={temaConfig} 
          videosDoSkills={videos} 
          usuariosCadastrados={usuarios}
        />
      </div>
    </main>
  );
}
