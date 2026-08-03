"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, ShieldCheck } from "lucide-react";
import LogoutButton from "./LogoutUser";
import { SeletorTemaSubmenu } from "./SeletorTemaSubmenu";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { isAdminRole } from "@/lib/roles";

interface UserDropdownProps {
    userName: string;
    userRole: string;
    userImage?: string | null;
}

export function UserDropdown({ userName, userRole }: UserDropdownProps) {
    const router = useRouter();
    const { data: session, update } = useSession();

    const navigateTo = (url: string, label: string) => {
        if (typeof window !== 'undefined' && window.parent !== window) {
            window.parent.postMessage({ type: 'ALPHA_OPEN_TAB', url, label }, '*');
        } else {
            router.push(url);
        }
    };

    const userImage = session?.user?.imagemUrl;
    const fotoFinal = userImage || session?.user?.imagemUrl || (session?.user as any)?.image;
    const initials = userName?.substring(0, 2).toUpperCase() || "OP";




    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild className="cursor-pointer">
                <button className="flex items-center gap-4 bg-black/40 p-2 pl-4 rounded-[2rem] border border-white/5 shadow-inner hover:bg-slate-900/60 hover:border-blue-500/30 transition-all outline-none group shrink-0">
                    <div className="flex flex-col items-end border-r border-white/10 pr-4">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5 group-hover:text-blue-400 transition-colors">
                            Identidade Ativa
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white italic tracking-tight uppercase max-w-[120px] truncate">
                                {userName}
                            </span>
                            <ShieldCheck
                                size={14}
                                className={isAdminRole(userRole) ? "text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "text-blue-500"}
                            />
                        </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                        {fotoFinal ? (
                            <img
                                key={fotoFinal} 
                                src={fotoFinal}
                                alt="Perfil"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="text-blue-400 font-black text-[10px]">{initials}</span>
                        )}
                    </div>
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-64 bg-[#0b1120]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200"
            >
                <DropdownMenuLabel className="p-3 mb-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em]">Painel Alpha</span>
                        <span className="text-sm font-black text-white uppercase italic truncate">{userName}</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest italic">Online</span>
                        </div>
                    </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="bg-white/5 mx-2" />

                <div className="py-3 space-y-2"> 
                    <DropdownMenuItem
                        onClick={() => navigateTo("/PainelAlpha/InfosPerfil/Perfil", "Meu Dossiê")}
                        className="flex items-center gap-3 p-3 rounded-2xl text-slate-400 cursor-pointer border border-transparent hover:border-blue-500/30 hover:bg-blue-600/10 hover:text-blue-400 focus:bg-blue-600/10 focus:text-blue-400 transition-all duration-300 group outline-none"
                    >
                        <User size={16} className="group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Meu Dossiê</span>
                    </DropdownMenuItem>

                    <SeletorTemaSubmenu />
                </div>


                <DropdownMenuSeparator className="bg-white/5 mx-2" />

                <div className="p-2 mt-2">
                    <LogoutButton variant="inline" />
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
