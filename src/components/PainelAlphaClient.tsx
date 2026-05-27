"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Globe, ShieldCheck, ArrowRight, Cpu,
  Bell, Zap, Search, Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AbaDeAcesso } from "@/components/AbaDeAcesso";
import Pusher from "pusher-js";
import { getTema, TemaAlpha } from "@/lib/temas";
import { MODULOS_REGISTRY, CATEGORIAS, ModuloRegistryItem } from "@/lib/modulos-registry";

export default function PainelAlphaClient({ session, chamadosIniciais, configBanco, permissoesEfetivas }: any) {
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [notificacoesLive, setNotificacoesLive] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  const userName   = session?.user?.nome || session?.user?.name || "Operador";
  const userRole   = session?.user?.role || "USER";
  const isAdmin    = userRole === "Admin";
  const isCeo      = userRole === "CEO";
  const isRh       = userRole === "RECURSOS HUMANOS";
  const isFinc     = userRole === "FINANCEIRO";

  const userPermissions: string[] = useMemo(() => {
    // Prefer server-resolved permissions (includes SetorPermissao + UsuarioPermissaoOverride)
    if (Array.isArray(permissoesEfetivas) && permissoesEfetivas.length > 0) {
      return permissoesEfetivas.map((x: string) => String(x));
    }
    // Fallback: stale JWT (only used if page was server-rendered without permissoesEfetivas)
    const p = session?.user?.permissoes;
    if (Array.isArray(p)) return p.map((x: string) => String(x));
    if (typeof p === "string" && p.length > 0) return p.split(",").map((x: string) => x.trim());
    return [];
  }, [session, permissoesEfetivas]);

  const temaNome     = configBanco?.tema || "blue";
  const densidade    = configBanco?.densidade || "default";
  const style        = getTema(temaNome);

  const totalNotificacoes = useMemo(() => {
    const lista = chamadosIniciais || [];
    const doBanco = lista.reduce((acc: number, c: any) => acc + (c._count?.mensagens || 0), 0);
    return doBanco + (notificacoesLive || 0);
  }, [chamadosIniciais, notificacoesLive]);

  const temNotificacao = totalNotificacoes > 0;

  useEffect(() => {
    if (!mounted || !chamadosIniciais?.length) return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });
    chamadosIniciais.forEach((c: any) => {
      const ch = pusher.subscribe(`chat-${c.id}`);
      ch.bind("nova-mensagem", (data: any) => {
        if (data.autorId !== session?.user?.id) setNotificacoesLive(prev => prev + 1);
      });
    });
    return () => {
      chamadosIniciais.forEach((c: any) => pusher.unsubscribe(`chat-${c.id}`));
      pusher.disconnect();
    };
  }, [mounted, chamadosIniciais, session?.user?.id]);

  // ── Filter + group ────────────────────────────────────────
  const byCategory = useMemo(() => {
    const busca = searchTerm.toLowerCase();

    const filtered = MODULOS_REGISTRY.filter(m => {
      if (m.adminOnly && !isAdmin && !isCeo) {
        const roleOk = m.allowedRoles?.includes(userRole);
        if (!roleOk) return false;
      }
      const temAcesso = isAdmin || isCeo ||
        m.allowedRoles?.includes(userRole) ||
        userPermissions.some(p => p.toLowerCase() === m.permission?.toLowerCase());
      if (!temAcesso) return false;
      if (busca && !m.label.toLowerCase().includes(busca)) return false;
      return true;
    });

    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(m => {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    });

    return groups;
  }, [searchTerm, isAdmin, isCeo, userPermissions, userRole]);

  if (!mounted) return null;

  const isAdminOrCeo = isAdmin || isCeo;
  const compact      = densidade === "compact";

  const gridClass = compact
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <main className={`min-h-screen bg-[#020617] text-slate-200 overflow-x-hidden relative font-sans selection:${style.glow.replace("10", "30")}`}>

      {/* Background glows */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] ${style.glow} blur-[150px] rounded-full`} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <img src="/FundoLogin.png" alt="" className="w-full h-full object-cover opacity-50" />
      </div>

      <div className={`relative z-10 mx-auto p-4 lg:p-10 flex flex-col gap-8 ${compact ? "max-w-[1920px]" : "max-w-[1800px]"}`}>

        {/* Header */}
        <header className="w-full rounded-2xl sm:rounded-[2.5rem] border border-white/5 bg-slate-900/20 backdrop-blur-3xl p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-8 shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center gap-4 sm:gap-6 w-full lg:w-auto">
            {/* Logo mark */}
            <div className="relative group shrink-0">
              <div className={`h-14 w-14 sm:h-20 sm:w-20 rounded-2xl sm:rounded-[1.8rem] bg-gradient-to-br ${style.bg} to-slate-900 flex items-center justify-center text-white shadow-2xl group-hover:rotate-6 transition-all duration-500`}>
                <Cpu size={28} strokeWidth={1.5} className="sm:hidden" />
                <Cpu size={40} strokeWidth={1.5} className="hidden sm:block" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-emerald-500 border-4 border-[#0b1120] animate-pulse" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase italic tracking-tighter text-white">
                Painel <span className={style.text}>Alpha</span>
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-2 text-slate-500 font-bold uppercase text-[9px] tracking-[0.2em]">
                  <Globe size={12} className={style.text} /> Rede: <span className="text-emerald-500">Sincronizada</span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-slate-500 font-bold uppercase text-[9px] tracking-[0.2em]">
                  <Zap size={12} className="text-amber-500 fill-amber-500/20" /> Status: <span className="text-white italic">Criptografado</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 w-full lg:max-w-md relative group lg:mx-4">
            <Search className={`absolute left-4 top-3.5 text-slate-600 group-focus-within:${style.text} transition-colors`} size={16} />
            <Input
              placeholder="BUSCAR MÓDULO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`h-11 sm:h-12 bg-black/40 border-white/5 rounded-xl sm:rounded-2xl pl-10 sm:pl-12 text-[10px] font-black uppercase tracking-widest placeholder:text-slate-700 transition-all w-full`}
            />
          </div>

        </header>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {[
            {
              label: "Nível de Acesso", value: userRole, icon: ShieldCheck,
              color: `${style.text} ${style.glow}`,
              href: isRh || isAdmin || isCeo || isFinc ? "/PainelAlpha/PainelTarefas/GerenciarTarefas/GerenciamentoUserTarefa" : undefined,
            },
            { label: "Alpha Comm", value: "Canal de mensagens", icon: Zap, color: "text-blue-500 bg-blue-500/10", href: "/PainelAlpha/AlphaComm" },
            {
              label: "Notificações",
              value: temNotificacao ? `${totalNotificacoes} Pendentes` : "Limpo",
              icon: Bell,
              color: temNotificacao ? "text-amber-500 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)]" : "text-amber-500 bg-amber-500/10",
              active: temNotificacao,
            },
            { label: "Sistema Alpha", value: "Explorar Notas de Atualização", icon: Zap, color: "text-purple-500 bg-purple-500/10", href: "/PainelAlpha/Guia" },
          ].map((stat, i) => {
            const Content = (
              <div className={`p-5 h-full rounded-[1.8rem] border flex items-center gap-4 transition-all duration-500 group overflow-hidden relative ${stat.active ? "bg-amber-600/10 border-amber-500/50 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.2)]" : "bg-slate-900/40 border-white/5"} ${stat.href ? "cursor-pointer hover:border-purple-500/40 hover:bg-slate-900/80 active:scale-[0.98]" : "cursor-default"}`}>
                <div className={`p-3 rounded-xl relative z-10 transition-all duration-500 ${stat.color} ${stat.active ? "scale-110" : ""} ${stat.href ? "group-hover:scale-110" : ""}`}>
                  <stat.icon size={20} className={stat.active ? "animate-bounce" : ""} />
                </div>
                <div className="relative z-10">
                  <p className={`text-[9px] font-black uppercase tracking-widest ${stat.active ? "text-amber-400" : "text-slate-500"}`}>{stat.label}</p>
                  <p className="text-xs font-black text-white uppercase italic tracking-tight">{stat.value}</p>
                </div>
                {stat.href && <ArrowRight size={14} className="absolute right-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-purple-500" />}
              </div>
            );
            return stat.href ? (
              <Link key={i} href={stat.href} className="block no-underline h-full">{Content}</Link>
            ) : (
              <div key={i} className="h-full">{Content}</div>
            );
          })}
        </section>

        {/* ── CATEGORIAS ── */}
        {CATEGORIAS.filter(cat => !!byCategory[cat.id]?.length).map(cat => (
          <section key={cat.id}>
            <div className="flex items-center gap-3 mb-6 px-1">
              <span className={`w-2 h-2 rounded-full ${CAT_DOT[cat.id]}`} />
              <h2 className={`text-sm font-black uppercase italic tracking-[0.4em] opacity-80 ${CAT_LABEL[cat.id]}`}>
                {cat.label}
              </h2>
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                {byCategory[cat.id].length} módulo{byCategory[cat.id].length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className={`grid gap-4 ${gridClass}`}>
              {byCategory[cat.id].map(mod => (
                <ModuloCard
                  key={mod.id}
                  mod={mod}
                  isAdmin={isAdminOrCeo}
                  userPermissions={userPermissions}
                  userRole={userRole}
                  style={style}
                  compact={compact}
                />
              ))}
            </div>
          </section>
        ))}

      </div>
    </main>
  );
}

// ── Category helpers ──────────────────────────────────────
const CAT_DOT: Record<string, string> = {
  operacional: "bg-blue-500",
  comercial:   "bg-indigo-400",
  financeiro:  "bg-emerald-500",
  pessoas:     "bg-rose-500",
  infra:       "bg-amber-500",
  admin:       "bg-slate-500",
};

const CAT_LABEL: Record<string, string> = {
  operacional: "text-blue-400",
  comercial:   "text-indigo-400",
  financeiro:  "text-emerald-400",
  pessoas:     "text-rose-400",
  infra:       "text-amber-400",
  admin:       "text-slate-400",
};

// ── ModuloCard ────────────────────────────────────────────
function ModuloCard({
  mod, isAdmin, userPermissions, userRole, style, compact,
}: {
  mod: ModuloRegistryItem;
  isAdmin: boolean;
  userPermissions: string[];
  userRole: string;
  style: TemaAlpha;
  compact: boolean;
}) {
  const temAcesso = isAdmin ||
    mod.allowedRoles?.includes(userRole) ||
    userPermissions.some(p => p.toLowerCase() === mod.permission?.toLowerCase());

  function openModuleTab(e: React.MouseEvent) {
    if (!temAcesso) { e.preventDefault(); return; }
    e.preventDefault();
    window.parent.postMessage({ type: 'ALPHA_OPEN_TAB', url: mod.href, label: mod.label }, '*');
  }

  if (compact) {
    return (
      <AbaDeAcesso permissaoRequerida={mod.id} userRole={isAdmin ? "Admin" : "User"} userPermissions={userPermissions}>
        <Link
          href={temAcesso ? mod.href : "#"}
          onClick={openModuleTab}
          className={`group relative h-28 rounded-[2rem] border transition-all p-5 flex items-center gap-5 overflow-hidden ${style.border} hover:${style.border.replace("20", "40")} shadow-lg ${style.shadow}`}
        >
          <div className="p-3 bg-white/5 rounded-2xl border border-white/5 group-hover:scale-110 transition-transform duration-500 shrink-0">
            <img src={mod.img} alt="" className={`w-8 h-8 object-contain transition-all duration-500 ${!temAcesso ? "grayscale opacity-30" : ""}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-[10px] font-black uppercase italic tracking-tighter truncate group-hover:${style.text} transition-colors`}>{mod.label}</h3>
            <span className={`text-[7px] font-black uppercase tracking-widest ${temAcesso ? "text-emerald-500" : "text-red-500"}`}>
              {temAcesso ? "● Disponível" : "○ Restrito"}
            </span>
          </div>
          <ArrowRight size={14} className={`ml-auto ${style.text} opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300`} />
        </Link>
      </AbaDeAcesso>
    );
  }

  return (
    <AbaDeAcesso permissaoRequerida={mod.id} userRole={isAdmin ? "Admin" : "User"} userPermissions={userPermissions}>
      <div className={`group relative h-auto sm:h-[360px] lg:h-[420px] rounded-2xl sm:rounded-[3rem] border border-white/5 bg-slate-950/40 p-6 sm:p-10 flex flex-col justify-between transition-all duration-700 hover:-translate-y-1 sm:hover:-translate-y-3 ${temAcesso ? `hover:${style.border.replace("20", "50")} hover:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]` : "opacity-60 grayscale"} shadow-2xl overflow-hidden backdrop-blur-xl`}>

        <div className={`absolute -top-24 -right-24 w-80 h-80 bg-gradient-to-br ${style.bg} blur-[100px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 rounded-full`} />

        <div className="relative z-10">
          <div className="mb-4 sm:mb-8 flex items-center justify-between">
            <div className={`p-3 sm:p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:${style.border} group-hover:bg-white/10 transition-all duration-500`}>
              <img src={mod.img} alt={mod.label} className={`w-8 h-8 sm:w-12 sm:h-12 object-contain filter drop-shadow-lg transition-transform duration-700 group-hover:scale-110 ${!temAcesso ? "grayscale opacity-50" : ""}`} />
            </div>
            <span className={`text-[8px] font-black uppercase tracking-[0.3em] px-3 py-1 bg-black/40 rounded-lg border border-white/5 group-hover:${style.text} transition-colors`}>
              {temAcesso ? mod.tag : "RESTRITO"}
            </span>
          </div>

          <h3 className={`text-xl font-black text-white uppercase italic tracking-tighter mb-3 leading-tight group-hover:${style.text} transition-colors line-clamp-2`}>
            {mod.label}
          </h3>

          <p className="text-slate-500 text-[11px] leading-relaxed font-bold uppercase tracking-tight opacity-70 group-hover:opacity-100 transition-opacity italic line-clamp-3">
            {temAcesso ? mod.desc : "ACESSO NEGADO: CONSULTE O ADMINISTRADOR DO SISTEMA ALPHA."}
          </p>
        </div>

        <div className="relative z-10 pt-4">
          <Link href={temAcesso ? mod.href : "#"} onClick={openModuleTab}>
            <Button className={`cursor-pointer w-full h-14 border rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-[9px] transition-all duration-500 ${temAcesso ? `bg-slate-900/80 ${style.text} ${style.border.replace("20", "40")} hover:${style.bg} hover:text-white hover:border-transparent` : "bg-slate-950 text-slate-800 border-white/5 cursor-not-allowed"}`}>
              <span className="flex items-center justify-center gap-2">
                {temAcesso ? (
                  <><span>Acessar</span><ArrowRight size={14} /></>
                ) : (
                  <><Lock size={14} /><span>Bloqueado</span></>
                )}
              </span>
            </Button>
          </Link>
        </div>
      </div>
    </AbaDeAcesso>
  );
}
