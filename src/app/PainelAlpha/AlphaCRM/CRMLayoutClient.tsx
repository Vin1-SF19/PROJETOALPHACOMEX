"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { getTema } from "@/lib/temas";
import { CrmSpaceBackground } from "./CRMBackground";
import { PerfilEmpresaProvider } from "@/components/PerfilEmpresaGlobal";
import { FlowButton } from "@/components/ui/flow-button";
import type { Session } from "next-auth";
import { isAdminRole } from "@/lib/roles";
import {
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  ClipboardCheck,
  Settings2,
  Zap,
  Menu,
  X,
  AlertTriangle,
  BookOpen,
  CalendarClock,
} from "lucide-react";

const NAV = [
  { href: "/PainelAlpha/AlphaCRM", label: "Dashboard", icon: LayoutDashboard, exact: true, adminOnly: false },
  { href: "/PainelAlpha/AlphaCRM/pipelines", label: "Pipelines", icon: KanbanSquare, exact: true, adminOnly: false },
  { href: "/PainelAlpha/AlphaCRM/tarefas", label: "Tarefas", icon: ListChecks, exact: false, adminOnly: false },
  { href: "/PainelAlpha/AlphaCRM/pendencias", label: "Pendências", icon: AlertTriangle, exact: false, adminOnly: false },
  { href: "/PainelAlpha/AlphaCRM/automacoes", label: "Automações", icon: Zap, exact: false, adminOnly: true },
  { href: "/PainelAlpha/AlphaCRM/admin", label: "Configurações", icon: Settings2, exact: false, adminOnly: true },
  { href: "/PainelAlpha/AlphaCRM/admin/checklists", label: "Checklists", icon: ClipboardCheck, exact: false, adminOnly: true },
  { href: "/PainelAlpha/AlphaCRM/admin/conhecimento", label: "Base de Conhecimento", icon: BookOpen, exact: false, adminOnly: true },
  { href: "/PainelAlpha/AlphaCRM/admin/cadencias", label: "Cadências", icon: CalendarClock, exact: false, adminOnly: true },
];

export default function CRMLayout({ children, session }: { children: React.ReactNode; session: Session | null }) {
  const pathname = usePathname();
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);
  const accent = visual.accent;
  const role = session?.user?.role ?? null;
  const isAdmin = isAdminRole(role);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Parallax leve: projeta posição do mouse em CSS vars (somente decorativo)
  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      el.style.setProperty("--mouse-x", (x * -1).toFixed(3));
      el.style.setProperty("--mouse-y", (y * -1).toFixed(3));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [reducedMotion]);

  const sidebarContent = (
    <>
      {/* Logo — marca com destaque */}
      <div className="relative px-5 pt-6 pb-5">
        <div
          className="pointer-events-none absolute inset-x-6 -bottom-px h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(0,230,195,0.28), transparent)" }}
          aria-hidden
        />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span
                className="relative grid h-9 w-9 place-items-center rounded-xl"
                style={{
                  border: "1px solid rgba(0,230,195,0.32)",
                  background: "linear-gradient(155deg, rgba(0,230,195,0.24), rgba(52,133,255,0.06))",
                  boxShadow: "0 0 22px -6px rgba(0,230,195,0.5), 0 1px 0 0 rgba(255,255,255,0.14) inset",
                }}
              >
                <KanbanSquare size={17} style={{ color: "rgb(0,230,195)", filter: "drop-shadow(0 0 6px rgba(0,230,195,0.6))" }} />
              </span>
              <span
                className="text-[15px] font-black tracking-tight uppercase text-white"
                style={{ textShadow: "0 0 18px rgba(0,230,195,0.35)" }}
              >
                Alpha<span className="text-[hsl(168,100%,55%)]">CRM</span>
              </span>
            </div>
            <p className="pl-0 text-[10.5px] font-medium tracking-wide text-[hsl(215,18%,46%)]">
              Gestão de Processos
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden -mr-1 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar menu"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1.5">
        {NAV.filter((item) => !item.adminOnly || isAdmin).map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname.startsWith(href) &&
              !NAV.some((item) => item.href.length > href.length && pathname.startsWith(item.href));
          return (
            <FlowButton
              key={href}
              icon={Icon}
              label={label}
              href={href}
              active={active}
              onClick={() => setOpen(false)}
              accent={accent}
              tone={accent}
            />
          );
        })}
      </nav>
    </>
  );

  return (
    <div ref={rootRef} className="crm-scope min-h-screen flex relative" style={{ background: "linear-gradient(180deg,#050b16,#020617)" }}>
      {/* ── Background espacial ── */}
      <CrmSpaceBackground />

      {/* ── Mobile overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar — static on md+, drawer on mobile ── */}
      <aside
        className={[
          "fixed md:static inset-y-0 left-0 z-50 w-64 md:w-56",
          "flex flex-col shrink-0 relative",
          "border-r bg-slate-950/30 backdrop-blur-xl",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        style={{
          borderColor: "rgba(120,200,255,0.06)",
          background: "linear-gradient(180deg, rgba(10,20,38,0.55), rgba(6,12,24,0.5))",
          boxShadow: "inset -1px 0 0 0 rgba(0,230,195,0.05)",
        }}
      >
        {sidebarContent}
        {/* Glow abstrato no rodapé, integrado ao ambiente */}
        <div className="pointer-events-none relative mt-auto h-14" aria-hidden>
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-[70%] rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(0,230,195,0.35), transparent)",
              boxShadow: "0 0 18px 2px rgba(0,230,195,0.25)",
            }}
          />
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-slate-950/35 backdrop-blur-xl sticky top-0 z-30"
          style={{ borderColor: "rgba(0,230,195,0.12)" }}
        >
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span
              className="grid h-6 w-6 place-items-center rounded-lg"
              style={{
                background: "linear-gradient(155deg, rgba(0,230,195,0.28), rgba(52,133,255,0.08))",
                border: "1px solid rgba(0,230,195,0.3)",
              }}
            >
              <KanbanSquare size={13} style={{ color: "rgb(0,230,195)" }} />
            </span>
            <span className="font-black text-white text-sm uppercase tracking-tight">
              Alpha<span className="text-[hsl(168,100%,55%)]">CRM</span>
            </span>
          </div>
        </div>

        <main className="crm-scroll flex-1 overflow-auto">
          <PerfilEmpresaProvider>{children}</PerfilEmpresaProvider>
        </main>
      </div>
    </div>
  );
}
