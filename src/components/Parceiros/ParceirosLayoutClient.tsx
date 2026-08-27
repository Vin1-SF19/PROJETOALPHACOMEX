"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getTema } from "@/lib/temas";
import { FlowButton } from "@/components/ui/flow-button";
import {
  Handshake,
  LayoutDashboard,
  UserPlus,
  Repeat,
  Link2,
  Users,
  Settings2,
  CircleHelp,
  MoreHorizontal,
  PlayCircle,
  Menu,
  X,
} from "lucide-react";

const NAV_PAGINAS = [
  { href: "/PainelAlpha/Parceiros", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/PainelAlpha/Parceiros/Aquisicao", label: "Aquisição", icon: UserPlus, exact: true },
  { href: "/PainelAlpha/Parceiros/Relacionamento", label: "Relacionamento", icon: Repeat, exact: true },
  { href: "/PainelAlpha/Parceiros/Indicacoes", label: "Indicação", icon: Link2, exact: true },
  { href: "/PainelAlpha/Parceiros/Lista", label: "Parceiros", icon: Users, exact: true },
  { href: "/PainelAlpha/Parceiros/Configuracoes", label: "Configurações", icon: Settings2, exact: true },
] as const;

// Ações — não são telas próprias, disparam um recurso já existente dentro da tela "Parceiros"
// (?abrir= consumido por ParceirosClient.tsx). Navegam pra lá de qualquer ponto do submenu.
const NAV_ACOES = [
  { abrir: "tutorial", label: "Tutoriais", icon: CircleHelp },
  { abrir: "acoes", label: "Ações", icon: MoreHorizontal },
  { abrir: "video", label: "Vídeo Introdutório", icon: PlayCircle },
] as const;

export default function ParceirosLayoutClient({
  temaName,
  children,
}: {
  temaName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visual = getTema(temaName);
  const accent = visual.accent;
  const [open, setOpen] = useState(false);

  const irParaAcao = (abrir: string) => {
    setOpen(false);
    router.push(`/PainelAlpha/Parceiros/Lista?abrir=${abrir}`);
  };

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `rgba(${accent},0.2)` }}
            >
              <Handshake size={15} style={{ color: `rgb(${accent})` }} />
            </div>
            <span className="font-black text-white tracking-tight text-sm uppercase">Parceiros</span>
          </div>
          <p className="text-[10px] text-slate-500 pl-9">Canais e Parcerias</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {NAV_PAGINAS.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <FlowButton
              key={href}
              icon={icon}
              label={label}
              href={href}
              active={active}
              onClick={() => setOpen(false)}
              accent={accent}
            />
          );
        })}

        <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
          {NAV_ACOES.map(({ abrir, label, icon }) => (
            <FlowButton
              key={abrir}
              icon={icon}
              label={label}
              onClick={() => irParaAcao(abrir)}
              accent={accent}
            />
          ))}
        </div>
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-[#020617] flex relative">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed md:static inset-y-0 left-0 z-50 w-64 md:w-56",
          "flex flex-col shrink-0",
          "border-r border-white/5 bg-slate-950/20 backdrop-blur-md",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        style={{ borderColor: `rgba(${accent},0.1)` }}
      >
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-slate-950/20 backdrop-blur-md sticky top-0 z-30"
          style={{ borderColor: `rgba(${accent},0.1)` }}
        >
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: `rgba(${accent},0.2)` }}
            >
              <Handshake size={13} style={{ color: `rgb(${accent})` }} />
            </div>
            <span className="font-black text-white text-sm uppercase tracking-tight">Parceiros</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
