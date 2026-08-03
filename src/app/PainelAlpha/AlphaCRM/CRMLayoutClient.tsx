"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getTema } from "@/lib/temas";
import type { Session } from "next-auth";
import { isAdminRole } from "@/lib/roles";
import {
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  Settings2,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { href: "/PainelAlpha/AlphaCRM", label: "Dashboard", icon: LayoutDashboard, exact: true, adminOnly: false },
  { href: "/PainelAlpha/AlphaCRM/tarefas", label: "Tarefas", icon: ListChecks, exact: false, adminOnly: false },
  { href: "/PainelAlpha/AlphaCRM/admin", label: "Configurações", icon: Settings2, exact: false, adminOnly: true },
];

export default function CRMLayout({ children, session }: { children: React.ReactNode; session: Session | null }) {
  const pathname = usePathname();
  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface || "blue";
  const visual = getTema(temaNome);
  const accent = visual.accent;
  const role = session?.user?.role ?? null;
  const isAdmin = isAdminRole(role);

  const [open, setOpen] = useState(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `rgba(${accent},0.2)` }}
            >
              <KanbanSquare size={15} style={{ color: `rgb(${accent})` }} />
            </div>
            <span className="font-black text-white tracking-tight text-sm uppercase">Alpha CRM</span>
          </div>
          <p className="text-[10px] text-slate-500 pl-9">Gestão de Processos</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.filter((item) => !item.adminOnly || isAdmin).map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={
                active
                  ? { background: `rgba(${accent},0.15)`, color: `rgb(${accent})` }
                  : { color: "#94a3b8" }
              }
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-[#020617] flex">
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
          "flex flex-col shrink-0",
          "border-r border-white/5 bg-slate-950",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        style={{ borderColor: `rgba(${accent},0.1)` }}
      >
        {sidebarContent}
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-slate-950/80 sticky top-0 z-30"
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
              <KanbanSquare size={13} style={{ color: `rgb(${accent})` }} />
            </div>
            <span className="font-black text-white text-sm uppercase tracking-tight">Alpha CRM</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
