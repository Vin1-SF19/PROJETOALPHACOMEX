"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Palette, Check } from "lucide-react";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { atualizarInterfaceAction } from "@/actions/preferencias";
import { getTema } from "@/lib/temas";

const TEMAS = [
  { id: "blue", label: "Alpha Blue", color: "bg-blue-600" },
  { id: "emerald", label: "Protocolo Green", color: "bg-emerald-600" },
  { id: "rose", label: "Cyber Rose", color: "bg-rose-600" },
  { id: "amber", label: "Warning Gold", color: "bg-amber-600" },
  { id: "violet", label: "Nebula Violet", color: "bg-violet-600" },
  { id: "cyan", label: "Electric Cyan", color: "bg-cyan-500" },
  { id: "fuchsia", label: "Deep Fuchsia", color: "bg-fuchsia-600" },
  { id: "toxic", label: "Toxic Lime", color: "bg-lime-500" },
  { id: "crimson", label: "Crimson Red", color: "bg-red-600" },
  { id: "midnight", label: "Midnight Blue", color: "bg-indigo-700" },
  { id: "lavender", label: "Soft Lavender", color: "bg-purple-400" },
  { id: "pink", label: "Alpha Pink", color: "bg-pink-500" },
];

/**
 * Submenu (hover) de seleção de tema, para ser usado dentro de um DropdownMenu.
 * Clicar numa cor já salva a preferência (sem botão "salvar") e aplica na hora.
 */
export function SeletorTemaSubmenu() {
  const { data: session, update } = useSession();
  const atual = (session?.user as { tema_interface?: string } | undefined)?.tema_interface ?? "blue";

  const [tema, setTema] = useState(atual);
  const [salvando, setSalvando] = useState<string | null>(null);

  const escolher = async (id: string) => {
    if (id === tema || salvando) return;
    const anterior = tema;
    setTema(id);          // feedback otimista
    setSalvando(id);

    // Aplica a cor imediatamente
    document.documentElement.style.setProperty("--alpha-primary", getTema(id).accent);

    // Mantém a densidade atual (não mexe nela)
    const densidade = (session?.user as { densidade_painel?: string } | undefined)?.densidade_painel ?? "default";
    const res = await atualizarInterfaceAction(id, densidade);

    if (res?.success) {
      localStorage.setItem("alpha-theme-temp", id);
      await update({ ...session, user: { ...session?.user, tema_interface: id } });
      // Recarrega para o tema propagar em todo o painel (mesmo padrão da página antiga)
      setTimeout(() => window.location.reload(), 250);
    } else {
      setTema(anterior); // reverte em caso de falha
      document.documentElement.style.setProperty("--alpha-primary", getTema(anterior).accent);
      setSalvando(null);
    }
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="flex items-center gap-3 p-3 rounded-2xl text-slate-400 cursor-pointer border border-transparent hover:border-indigo-500/30 hover:bg-indigo-600/10 hover:text-indigo-400 focus:bg-indigo-600/10 focus:text-indigo-400 data-[state=open]:bg-indigo-600/10 data-[state=open]:text-indigo-400 transition-all duration-300 group outline-none">
        <Palette size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest italic">Interface Alpha</span>
      </DropdownMenuSubTrigger>

      <DropdownMenuPortal>
      <DropdownMenuSubContent
        sideOffset={8}
        collisionPadding={12}
        className="w-[260px] p-3 rounded-2xl border border-white/10 bg-[#0a1020] shadow-2xl z-[100]"
      >
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 px-1 pb-2">Esquema de cores</p>
        <div className="grid grid-cols-4 gap-2">
          {TEMAS.map((t) => {
            const ativo = tema === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => escolher(t.id)}
                title={t.label}
                aria-label={t.label}
                aria-pressed={ativo}
                disabled={!!salvando}
                className="relative aspect-square rounded-xl grid place-items-center transition-all hover:scale-105 disabled:opacity-60"
                style={{
                  border: ativo ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  background: ativo ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.3)",
                }}
              >
                <span className={`h-6 w-6 rounded-full ${t.color} shadow-inner ${ativo ? "ring-2 ring-white/30" : ""}`} />
                {ativo && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white grid place-items-center shadow">
                    <Check size={10} className="text-black" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[9px] text-slate-600 px-1 pt-2.5 leading-tight">Clique numa cor para aplicar — salva automaticamente.</p>
      </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
