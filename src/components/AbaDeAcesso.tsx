"use client";
import { Lock } from "lucide-react";
import { isAdminRole } from "@/lib/roles";

interface AbaProps {
  permissaoRequerida: string;
  children: React.ReactNode;
  userPermissions?: string[]; 
  userRole?: string;          
}

export function AbaDeAcesso({ permissaoRequerida, children, userPermissions, userRole }: AbaProps) {
  
  
  const temAcesso = 
  isAdminRole(userRole) ||
    userPermissions?.includes(permissaoRequerida);

  if (!temAcesso) {
    return (
      <div 
        onClick={() => alert("Acesso negado! Peça permissão ao Administrador.")}
        className="relative cursor-not-allowed group h-full"
      >
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-[2px] rounded-3xl transition-all">
          <Lock className="w-8 h-8 text-white mb-2" />
          <span className="text-white text-xs font-bold uppercase">Bloqueado</span>
        </div>
        
        <div className="filter grayscale opacity-40 pointer-events-none h-full">
          {children}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
