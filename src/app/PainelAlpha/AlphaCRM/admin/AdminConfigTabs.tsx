"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  CalendarClock,
  ClipboardCheck,
  KanbanSquare,
} from "lucide-react";

const ADMIN_TABS = [
  {
    href: "/PainelAlpha/AlphaCRM/admin",
    label: "Pipelines",
    icon: KanbanSquare,
    active: (pathname: string) =>
      pathname === "/PainelAlpha/AlphaCRM/admin" ||
      pathname.startsWith("/PainelAlpha/AlphaCRM/admin/pipelines/"),
  },
  {
    href: "/PainelAlpha/AlphaCRM/admin/automacoes",
    label: "Automações",
    icon: Bot,
    active: (pathname: string) =>
      pathname.startsWith("/PainelAlpha/AlphaCRM/admin/automacoes"),
  },
  {
    href: "/PainelAlpha/AlphaCRM/admin/checklists",
    label: "Checklists",
    icon: ClipboardCheck,
    active: (pathname: string) =>
      pathname.startsWith("/PainelAlpha/AlphaCRM/admin/checklists"),
  },
  {
    href: "/PainelAlpha/AlphaCRM/admin/conhecimento",
    label: "Base de Conhecimento",
    icon: BookOpen,
    active: (pathname: string) =>
      pathname.startsWith("/PainelAlpha/AlphaCRM/admin/conhecimento"),
  },
  {
    href: "/PainelAlpha/AlphaCRM/admin/cadencias",
    label: "Cadências",
    icon: CalendarClock,
    active: (pathname: string) =>
      pathname.startsWith("/PainelAlpha/AlphaCRM/admin/cadencias"),
  },
] as const;

export function AdminConfigTabs() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-xl sm:px-6">
      <nav
        aria-label="Áreas das configurações do CRM"
        className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.025] p-1"
      >
        {ADMIN_TABS.map(({ href, label, icon: Icon, active }) => {
          const selecionada = active(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={selecionada ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition-colors ${
                selecionada
                  ? "bg-cyan-400/15 text-cyan-100"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
