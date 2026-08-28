'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import localFont from 'next/font/local';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, CheckSquare, ListTodo, ClipboardList,
  CalendarDays, Wrench, BarChart3, UserCheck, Target,
  Megaphone, Trophy, Landmark, FileSearch, ScanSearch,
  Scale, FileText, GraduationCap, BookOpen, KeyRound,
  FileStack, Users, Briefcase, TrendingUp, Layers, Shield,
  X, PanelLeft, User, Pin, ChevronLeft, ChevronRight, ChevronDown,
  Instagram, Activity, Handshake, Cable, MonitorPlay, CalendarClock, Compass, HandCoins,
  StickyNote, Search, Map,
  FolderKanban, Radar, Users2, Clapperboard, CircleDollarSign,
  Contact, LibraryBig, FolderOpen, CalendarRange, MessagesSquare,
  Globe, ExternalLink, Settings, Cloud, Server, ShieldCheck, Wallet, Building2, Link2,
  Plus, Pencil, Bot,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LogoutButton from '@/components/LogoutUser';
import { SeletorTemaSubmenu } from '@/components/SeletorTemaSubmenu';
import { CATEGORIAS, GRUPOS_SIDEBAR, MODULOS_REGISTRY, podeVisualizarModulo, type ModuloRegistryItem } from '@/lib/modulos-registry';
import { ModalBroadcast } from '@/components/ModalBroadcast';
import { getTema } from '@/lib/temas';
import { isAdminRole } from '@/lib/roles';
import { NotesLauncherButton } from '@/components/Notas/NotesLauncherButton';
import { useElementWidth } from '@/hooks/useElementWidth';
import { ModalLinkExterno, type LinkExternoEditavel } from '@/components/layout/ModalLinkExterno';
import { ListarLinksExternosGestao, type LinkExternoVisivel } from '@/actions/LinksExternos';

const sfProDisplay = localFont({
  src: '../../../public/fonts/sidebar/SF-Pro-Display-Bold.otf',
  weight: '700',
  variable: '--font-sf-pro-sidebar',
  display: 'swap',
});

// ── Icon map ──────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare, CheckSquare, ListTodo, ClipboardList,
  CalendarDays, Wrench, BarChart3, UserCheck, Target,
  Megaphone, Trophy, Landmark, FileSearch, ScanSearch,
  Scale, FileText, GraduationCap, BookOpen, KeyRound,
  FileStack, Users, Briefcase, TrendingUp, Layers, Shield,
  Instagram, Handshake, Cable, MonitorPlay, CalendarClock, Compass, HandCoins,
  StickyNote, Map,
  FolderKanban, Radar, Users2, Clapperboard, CircleDollarSign,
  Contact, LibraryBig, FolderOpen, CalendarRange, MessagesSquare,
  Globe, ExternalLink, Settings, Cloud, Server, ShieldCheck, Wallet, Building2, Link2,
  Bot,
};

const ACTIVE_BG: Record<string, string> = {
  operacional: 'bg-blue-500/15 border-blue-500/40 text-blue-400',
  comercial:   'bg-indigo-500/15 border-indigo-500/40 text-indigo-400',
  financeiro:  'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
  pessoas:     'bg-rose-500/15 border-rose-500/40 text-rose-400',
  infra:       'bg-amber-500/15 border-amber-500/40 text-amber-400',
  admin:       'bg-slate-500/15 border-slate-500/40 text-slate-400',
};

const CAT_COLORS: Record<string, string> = {
  operacional: 'text-blue-400',
  comercial:   'text-indigo-400',
  financeiro:  'text-emerald-400',
  pessoas:     'text-rose-400',
  infra:       'text-amber-400',
  admin:       'text-slate-400',
};

const TOOLTIP_ACCENT: Record<string, string> = {
  operacional: '59, 130, 246',
  comercial:   '99, 102, 241',
  financeiro:  '16, 185, 129',
  pessoas:     '244, 63, 94',
  infra:       '245, 158, 11',
  admin:       '148, 163, 184',
};

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// ── Props ─────────────────────────────────────────────────
interface GlobalSidebarProps {
  permissoes: string[];
  role: string;
  nome: string;
  imagemUrl?: string | null;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse?: () => void;
  onCloseMobile: () => void;
  onOpenTab?: (href: string, label: string) => void;
  activeUrl?: string;
  openUrls?: string[];
  temaName?: string;
  /** Reporta a largura REAL (renderizada) da sidebar desktop — permite que elementos irmãos
   *  (ex: barra global de notas) encostem exatamente onde ela termina, sem depender de um
   *  valor fixo espelhado que pode dessincronizar do CSS real. */
  onWidthChange?: (width: number) => void;
  /** Links visíveis para o usuário atual (já filtrados no server por role/visivelPara). */
  linksExternos?: LinkExternoVisivel[];
}

export default function GlobalSidebar({
  permissoes,
  role,
  nome,
  imagemUrl,
  isCollapsed,
  isMobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onOpenTab,
  activeUrl,
  openUrls = [],
  temaName,
  onWidthChange,
  linksExternos = [],
}: GlobalSidebarProps) {
  const pathname = usePathname();
  const isAdmin = isAdminRole(role);
  const temAcessoNotas = isAdmin || permissoes.includes('notas');
  // Use activeUrl (tab-aware) for highlighting; fallback to pathname
  const effectiveUrl = activeUrl ?? pathname;

  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const tema = getTema(temaName ?? "blue");

  // Links Externos: estado local espelhado (otimista) — não depende de router.refresh() para essa lista pequena.
  const [links, setLinks] = useState<LinkExternoEditavel[]>(
    linksExternos.map(l => ({ ...l, visivelPara: 'TODOS' })),
  );
  const [modalLinkAberto, setModalLinkAberto] = useState(false);
  const [linkEmEdicao, setLinkEmEdicao] = useState<LinkExternoEditavel | null>(null);

  const asideRef = useRef<HTMLElement>(null);
  const [tooltip, setTooltip] = useState<{ label: string; top: number; category: string } | null>(null);

  useElementWidth(asideRef, onWidthChange ?? (() => {}));

  const showTooltip = (e: React.MouseEvent<HTMLElement>, label: string, category: string) => {
    if (!isCollapsed || !asideRef.current) return;
    const itemRect = e.currentTarget.getBoundingClientRect();
    const asideRect = asideRef.current.getBoundingClientRect();
    setTooltip({ label, top: itemRect.top - asideRect.top + itemRect.height / 2, category });
  };
  const hideTooltip = () => setTooltip(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('painel_alpha_sidebar_pins') ?? '[]') as string[];
      if (stored.length > 0) setPinnedIds(stored); // eslint-disable-line react-hooks/set-state-in-effect
    } catch { /* ignore */ }
  }, []);

  const togglePin = (id: string) => {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      localStorage.setItem('painel_alpha_sidebar_pins', JSON.stringify(next));
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Admin precisa do `visivelPara` real de cada link (a prop `linksExternos` já vem filtrada/sem esse campo) —
  // busca uma vez ao montar, só para quem gerencia. `linksGestaoCarregado` evita que o botão de editar
  // abra o modal com `visivelPara: 'TODOS'` hardcoded do estado inicial antes desse fetch resolver
  // (clicar editar + salvar nessa janela sobrescreveria a visibilidade real do link silenciosamente).
  const [linksGestaoCarregado, setLinksGestaoCarregado] = useState(false);
  useEffect(() => {
    if (!isAdminRole(role)) return;
    ListarLinksExternosGestao().then(res => {
      if (res.success) setLinks(res.links);
      setLinksGestaoCarregado(true);
    });
  }, [role]);

  const abrirModalCriarLink = () => { setLinkEmEdicao(null); setModalLinkAberto(true); };
  const abrirModalEditarLink = (link: LinkExternoEditavel) => { setLinkEmEdicao(link); setModalLinkAberto(true); };
  const fecharModalLink = () => setModalLinkAberto(false);

  const handleLinkSalvo = (link: LinkExternoVisivel) => {
    setLinks(prev => {
      const semVisivelPara = { ...link, visivelPara: linkEmEdicao?.id === link.id ? linkEmEdicao.visivelPara : 'TODOS' };
      const existe = prev.some(l => l.id === link.id);
      return existe ? prev.map(l => (l.id === link.id ? semVisivelPara : l)) : [...prev, semVisivelPara];
    });
  };

  const handleLinkExcluido = (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  // Close mobile drawer on route change
  useEffect(() => {
    onCloseMobile();
  }, [pathname, onCloseMobile]);

  // ESC closes mobile
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCloseMobile]);

  // Desktop: clicar fora da sidebar EXPANDIDA → recolhe (só quando aberta)
  useEffect(() => {
    if (isCollapsed || !onToggleCollapse) return;
    const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

    const onMouseDown = (e: MouseEvent) => {
      if (!isDesktop()) return;
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        onToggleCollapse();
      }
    };
    // Clicar dentro de um módulo (iframe) tira o foco da janela → recolhe
    const onWindowBlur = () => {
      window.setTimeout(() => {
        if (isDesktop() && document.activeElement?.tagName === 'IFRAME') {
          onToggleCollapse();
        }
      }, 0);
    };

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [isCollapsed, onToggleCollapse]);

  const modulos = MODULOS_REGISTRY.filter(m =>
    !m.hidden && podeVisualizarModulo(m, { permissoes, role }),
  );

  const buscaNormalizada = normalizarTexto(busca);
  const modulosVisiveis = buscaNormalizada
    ? modulos.filter(m =>
        [m.label, m.id, m.tag, m.desc, ...(m.aliases ?? [])]
          .filter((valor): valor is string => Boolean(valor))
          .some(valor => normalizarTexto(valor).includes(buscaNormalizada)),
      )
    : modulos;

  const adminModulos = isAdmin ? modulosVisiveis.filter(m => m.category === 'admin') : [];
  const nonAdminModulos = isAdmin ? modulosVisiveis.filter(m => m.category !== 'admin') : modulosVisiveis;
  const pinnedModulos = pinnedIds
    .map(id => nonAdminModulos.find(m => m.id === id))
    .filter((m): m is typeof nonAdminModulos[number] => !!m);
  const unpinnedModulos = nonAdminModulos.filter(m => !pinnedIds.includes(m.id));
  const nenhumResultado = buscaNormalizada.length > 0 && modulosVisiveis.length === 0;

  // Módulos soltos (sem grupo funcional) renderizam como itens de topo, fora de qualquer gaveta
  const modulosSoltos = unpinnedModulos.filter(m => !m.grupo);
  // Grupos com pelo menos 1 módulo visível — grupo sem nenhum módulo (ex: sem permissão) não renderiza
  const gruposComModulos = GRUPOS_SIDEBAR
    .map(grupo => ({ grupo, itens: unpinnedModulos.filter(m => m.grupo === grupo.id) }))
    .filter(g => g.itens.length > 0);
  // Durante busca ativa, grupos com resultado abrem automaticamente (sem sobrescrever o estado manual)
  const gruposEfetivamenteAbertos = buscaNormalizada
    ? new Set([...openGroups, ...gruposComModulos.map(g => g.grupo.id)])
    : openGroups;

  const adminCat = CATEGORIAS.find(c => c.id === 'admin');

  const initials = nome?.substring(0, 2).toUpperCase() || 'OP';

  // ── Item de módulo individual — reaproveitado por soltos, agrupados e collapsed ──
  // `compact`: variante menor/centralizada usada dentro de uma gaveta aberta em modo collapsed.
  const renderModuloItem = (mod: ModuloRegistryItem, compact = false) => {
    const Icon = ICON_MAP[mod.iconName] ?? FileText;
    const isActive = effectiveUrl === mod.href || effectiveUrl.startsWith(mod.href + '/');
    const isOpen = !isActive && openUrls.some(u => u === mod.href || u.startsWith(mod.href + '/'));
    const isPinned = pinnedIds.includes(mod.id);
    const activeClass = isActive
      ? ACTIVE_BG[mod.category]
      : isOpen
      ? 'text-slate-400 bg-white/[0.03] border-white/[0.07] hover:text-white hover:bg-white/5'
      : 'text-slate-500 hover:text-white hover:bg-white/5 border-transparent';

    return (
      <div
        key={mod.id}
        className="relative group/item"
        onMouseEnter={(e) => showTooltip(e, mod.label, mod.category)}
        onMouseLeave={hideTooltip}
      >
        <Link
          href={mod.href}
          aria-label={mod.label}
          onClick={onOpenTab ? (e) => { e.preventDefault(); onOpenTab(mod.href, mod.label); } : undefined}
          className={`
            flex items-center gap-3 rounded-xl border transition-all duration-200 group
            ${isCollapsed ? 'justify-center' : 'px-3 py-2.5 pr-8'}
            ${compact ? 'p-1.5 mx-auto w-fit' : isCollapsed ? 'px-3 py-2.5' : ''}
            ${activeClass}
          `}
        >
          <Icon
            size={compact ? 14 : isCollapsed ? 16 : 19}
            className={`shrink-0 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`}
          />
          {!isCollapsed && (
            <span
              style={{ fontFamily: 'var(--font-sf-pro-sidebar)' }}
              className="text-[11.5px] font-black uppercase tracking-tight truncate leading-none"
            >
              {mod.label}
            </span>
          )}
          {isActive && !isCollapsed && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          )}
          {isOpen && !isCollapsed && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" title="Aba aberta em background" />
          )}
          {isOpen && isCollapsed && (
            <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-slate-500" />
          )}
        </Link>
        {!isCollapsed && (
          <button
            onClick={e => { e.preventDefault(); togglePin(mod.id); }}
            title={isPinned ? 'Desafixar' : 'Fixar no topo'}
            className={`
              absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all duration-200
              ${isPinned
                ? 'text-amber-400 opacity-100'
                : 'text-slate-600 opacity-0 group-hover/item:opacity-100 hover:text-amber-400'}
            `}
          >
            <Pin size={11} className={isPinned ? 'fill-amber-400' : ''} />
          </button>
        )}
      </div>
    );
  };

  // ── Item de link externo — mesmo padrão visual de renderModuloItem, mas <a target="_blank">
  //    (não é rota interna) + controles de editar/excluir só para admin. ──
  const renderLinkExternoItem = (link: LinkExternoEditavel, compact = false) => {
    const Icon = ICON_MAP[link.iconName] ?? Globe;

    return (
      <div
        key={link.id}
        className="relative group/item"
        onMouseEnter={(e) => showTooltip(e, link.label, 'infra')}
        onMouseLeave={hideTooltip}
      >
        <a
          href={link.url}
          onClick={(e) => {
            e.preventDefault();
            if (onOpenTab) onOpenTab(link.url, link.label);
            else window.open(link.url, '_blank', 'noopener,noreferrer');
          }}
          aria-label={link.label}
          className={`
            flex items-center gap-3 rounded-xl border transition-all duration-200 group
            ${isCollapsed ? 'justify-center' : 'px-3 py-2.5'}
            ${compact ? 'p-1.5 mx-auto w-fit' : isCollapsed ? 'px-3 py-2.5' : ''}
            ${isAdmin && !isCollapsed ? 'pr-8' : ''}
            text-slate-500 hover:text-white hover:bg-white/5 border-transparent
          `}
        >
          <Icon
            size={compact ? 14 : isCollapsed ? 16 : 19}
            className="shrink-0 transition-transform duration-200 group-hover:scale-110"
          />
          {!isCollapsed && (
            <span
              style={{ fontFamily: 'var(--font-sf-pro-sidebar)' }}
              className="text-[11.5px] font-black uppercase tracking-tight truncate leading-none"
            >
              {link.label}
            </span>
          )}
        </a>
        {isAdmin && !isCollapsed && (
          <button
            onClick={(e) => { e.preventDefault(); if (linksGestaoCarregado) abrirModalEditarLink(link); }}
            disabled={!linksGestaoCarregado}
            title={linksGestaoCarregado ? 'Editar ou excluir' : 'Carregando...'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-600 opacity-0 group-hover/item:opacity-100 hover:text-white transition-all duration-200 disabled:cursor-wait disabled:hover:text-slate-600"
          >
            <Pencil size={11} />
          </button>
        )}
      </div>
    );
  };

  // ── Sidebar inner content ──
  const SidebarContent = (
    <div className={`flex flex-col h-full ${sfProDisplay.variable}`}>
      {/* Logo */}
      <div className="flex items-center h-16 shrink-0 border-b border-white/5 px-4 justify-between">
        {isCollapsed ? (
          <Link
            href="/PainelAlpha"
            onClick={onOpenTab ? (e) => { e.preventDefault(); onOpenTab('/PainelAlpha', 'Início'); } : undefined}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          >
            <Image src="/A.PNG" alt="Logo" width={32} height={32} className="object-contain" />
          </Link>
        ) : (
          <Link
            href="/PainelAlpha"
            onClick={onOpenTab ? (e) => { e.preventDefault(); onOpenTab('/PainelAlpha', 'Início'); } : undefined}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
              <Image src="/A.PNG" alt="Logo" width={32} height={32} className="object-contain" />
            </div>
            <span className="text-white font-black uppercase italic tracking-tighter text-sm truncate">
              Painel<span className={tema.text}>Alpha</span>
            </span>
          </Link>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
            className="p-1.5 rounded-xl text-slate-600 hover:text-white hover:bg-white/5 transition-all cursor-pointer shrink-0"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* Busca de módulos */}
      {!isCollapsed && (
        <div className="shrink-0 px-2 pt-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar módulo..."
              aria-label="Buscar módulo"
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-white/5 border border-white/5 text-[11px] font-medium text-white placeholder:text-slate-600 outline-none focus:border-white/15 focus:bg-white/[0.07] transition-all"
            />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-0.5 custom-scrollbar">
        {nenhumResultado && (
          <p className="px-3 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
            Nenhum módulo encontrado
          </p>
        )}

        {/* Pinned — sempre no topo, fora de qualquer gaveta */}
        {pinnedModulos.map(mod => renderModuloItem(mod))}

        {/* Módulos soltos (sem grupo funcional) */}
        {modulosSoltos.map(mod => renderModuloItem(mod))}

        {/* Grupos funcionais — accordion (expandido) ou gaveta de ícone único (collapsed) */}
        {gruposComModulos.map(({ grupo, itens }, idx) => {
          const GrupoIcon = ICON_MAP[grupo.iconName] ?? Layers;
          const isGrupoAberto = gruposEfetivamenteAbertos.has(grupo.id);

          if (isCollapsed) {
            const grupoActiveClass = itens.some(mod => effectiveUrl === mod.href || effectiveUrl.startsWith(mod.href + '/'))
              ? ACTIVE_BG[itens[0].category]
              : 'text-slate-500 hover:text-white hover:bg-white/5 border-transparent';

            return (
              <div key={grupo.id}>
                {idx > 0 && (
                  <div className="flex justify-center my-1">
                    <div className="w-4 h-px bg-white/10" />
                  </div>
                )}
                <button
                  onClick={() => toggleGroup(grupo.id)}
                  onMouseEnter={(e) => showTooltip(e, grupo.label, itens[0].category)}
                  onMouseLeave={hideTooltip}
                  aria-expanded={isGrupoAberto}
                  aria-controls={`grupo-painel-collapsed-${grupo.id}`}
                  aria-label={grupo.label}
                  className={`flex items-center justify-center w-full px-3 py-2.5 rounded-xl border transition-all duration-200 ${grupoActiveClass}`}
                >
                  <GrupoIcon size={16} className="shrink-0" />
                </button>
                {isGrupoAberto && (
                  <div id={`grupo-painel-collapsed-${grupo.id}`} className="flex flex-col items-center gap-0.5 py-1">
                    {itens.map(mod => renderModuloItem(mod, true))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={grupo.id} className="pt-1">
              <button
                onClick={() => toggleGroup(grupo.id)}
                aria-expanded={isGrupoAberto}
                aria-controls={`grupo-painel-${grupo.id}`}
                className="flex items-center gap-2 px-3 py-2 w-full rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all duration-200 group"
              >
                <GrupoIcon size={15} className="shrink-0" />
                <span
                  style={{ fontFamily: 'var(--font-sf-pro-sidebar)' }}
                  className="text-[10px] font-black uppercase tracking-[0.2em] truncate"
                >
                  {grupo.label}
                </span>
                <ChevronDown
                  size={14}
                  className={`ml-auto shrink-0 transition-transform duration-200 ${isGrupoAberto ? 'rotate-180' : ''}`}
                />
              </button>
              {isGrupoAberto && (
                <div id={`grupo-painel-${grupo.id}`} className="space-y-0.5 pl-1 pt-0.5">
                  {itens.map(mod => renderModuloItem(mod))}
                </div>
              )}
            </div>
          );
        })}

        {/* Sistema Externo — bloco separado dos 10 grupos: dado dinâmico (não MODULOS_REGISTRY),
            sempre visível pra admin mesmo vazio, com controles de criar/editar/excluir. */}
        {(links.length > 0 || isAdmin) && (() => {
          const isGrupoAberto = openGroups.has('sistemaExterno');

          if (isCollapsed) {
            return (
              <div key="sistemaExterno">
                {gruposComModulos.length > 0 && (
                  <div className="flex justify-center my-1">
                    <div className="w-4 h-px bg-white/10" />
                  </div>
                )}
                <button
                  onClick={() => toggleGroup('sistemaExterno')}
                  onMouseEnter={(e) => showTooltip(e, 'Sistema Externo', 'infra')}
                  onMouseLeave={hideTooltip}
                  aria-expanded={isGrupoAberto}
                  aria-controls="grupo-painel-collapsed-sistemaExterno"
                  aria-label="Sistema Externo"
                  className="flex items-center justify-center w-full px-3 py-2.5 rounded-xl border transition-all duration-200 text-slate-500 hover:text-white hover:bg-white/5 border-transparent"
                >
                  <Globe size={16} className="shrink-0" />
                </button>
                {isGrupoAberto && (
                  <div id="grupo-painel-collapsed-sistemaExterno" className="flex flex-col items-center gap-0.5 py-1">
                    {links.map(link => renderLinkExternoItem(link, true))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key="sistemaExterno" className="pt-1">
              <div className="flex items-center gap-2 px-3 py-2 w-full rounded-xl text-slate-500 group">
                <button
                  onClick={() => toggleGroup('sistemaExterno')}
                  aria-expanded={isGrupoAberto}
                  aria-controls="grupo-painel-sistemaExterno"
                  className="flex items-center gap-2 flex-1 min-w-0 hover:text-white transition-colors duration-200"
                >
                  <Globe size={15} className="shrink-0" />
                  <span
                    style={{ fontFamily: 'var(--font-sf-pro-sidebar)' }}
                    className="text-[10px] font-black uppercase tracking-[0.2em] truncate"
                  >
                    Sistema Externo
                  </span>
                </button>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); abrirModalCriarLink(); }}
                    title="Adicionar sistema externo"
                    className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  >
                    <Plus size={13} />
                  </button>
                )}
                <button
                  onClick={() => toggleGroup('sistemaExterno')}
                  aria-label="Expandir Sistema Externo"
                  className="shrink-0"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 hover:text-white ${isGrupoAberto ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              {isGrupoAberto && (
                <div id="grupo-painel-sistemaExterno" className="space-y-0.5 pl-1 pt-0.5">
                  {links.length === 0 && isAdmin && (
                    <button
                      onClick={abrirModalCriarLink}
                      className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-white/10 text-slate-500 hover:text-white hover:border-white/20 transition-all duration-200 text-[10px] font-black uppercase tracking-tight"
                    >
                      <Plus size={14} />
                      Inserir sistema externo
                    </button>
                  )}
                  {links.map(link => renderLinkExternoItem(link))}
                </div>
              )}
            </div>
          );
        })()}

        <ModalLinkExterno
          open={modalLinkAberto}
          onClose={fecharModalLink}
          linkEmEdicao={linkEmEdicao}
          onSalvo={handleLinkSalvo}
          onExcluido={handleLinkExcluido}
        />

        {/* Admin section — only if admin has modules */}
        {isAdmin && adminModulos.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && adminCat && (
              <div className="flex items-center gap-2 px-3 mb-2">
                {(() => { const CatIcon = ICON_MAP[adminCat.iconName] ?? Layers; return <CatIcon size={11} className={CAT_COLORS['admin']} />; })()}
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
                  {adminCat.label}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            )}
            {isCollapsed && (
              <div className="flex justify-center mb-1">
                <div className="w-4 h-px bg-white/10" />
              </div>
            )}
            <div className="space-y-0.5">
              {adminModulos.map(mod => {
                const Icon = ICON_MAP[mod.iconName] ?? FileText;
                const isActive = effectiveUrl === mod.href || effectiveUrl.startsWith(mod.href + '/');
                const activeClass = isActive ? ACTIVE_BG['admin'] : 'text-slate-500 hover:text-white hover:bg-white/5 border-transparent';

                return (
                  <div
                    key={mod.id}
                    className="relative"
                    onMouseEnter={(e) => showTooltip(e, mod.label, 'admin')}
                    onMouseLeave={hideTooltip}
                  >
                  <Link
                    href={mod.href}
                    aria-label={mod.label}
                    onClick={onOpenTab ? (e) => { e.preventDefault(); onOpenTab(mod.href, mod.label); } : undefined}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 group
                      ${isCollapsed ? 'justify-center' : ''}
                      ${activeClass}
                    `}
                  >
                    <Icon
                      size={16}
                      className={`shrink-0 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`}
                    />
                    {!isCollapsed && (
                      <span className="text-[10px] font-black uppercase tracking-tight truncate leading-none">
                        {mod.label}
                      </span>
                    )}
                    {isActive && !isCollapsed && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                    )}
                  </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer: avatar + dropdown */}
      <div className={`shrink-0 border-t border-white/5 p-3 flex flex-col gap-1 ${isCollapsed ? 'items-center' : ''}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title={isCollapsed ? nome : undefined}
              className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all group w-full outline-none cursor-pointer ${isCollapsed ? 'justify-center' : ''}`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {imagemUrl ? (
                  <Image src={imagemUrl} alt={nome} width={32} height={32} className="object-cover w-full h-full" unoptimized />
                ) : (
                  <span className="text-blue-400 font-black text-[9px]">{initials}</span>
                )}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-black text-white uppercase italic tracking-tight truncate">{nome}</p>
                  <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest truncate">{role}</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-64 bg-[#0b1120]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[200]"
          >
            <DropdownMenuLabel className="p-3 mb-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em]">Painel Alpha</span>
                <span className="text-sm font-black text-white uppercase italic truncate">{nome}</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest italic">Online</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-white/5 mx-2" />

            <div className="py-3 space-y-2">
              <DropdownMenuItem
                onClick={() => onOpenTab?.('/PainelAlpha/InfosPerfil/Perfil', 'Meu Dossiê')}
                className="flex items-center gap-3 p-3 rounded-2xl text-slate-400 cursor-pointer border border-transparent hover:border-blue-500/30 hover:bg-blue-600/10 hover:text-blue-400 focus:bg-blue-600/10 focus:text-blue-400 transition-all duration-300 group outline-none"
              >
                <User size={16} className="group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest italic">Meu Dossiê</span>
              </DropdownMenuItem>

              <SeletorTemaSubmenu />
            </div>

            {isAdmin && (
              <>
                <DropdownMenuSeparator className="bg-white/5 mx-2" />
                <div className="py-3 space-y-2">
                  <DropdownMenuItem
                    onClick={() => setIsBroadcastOpen(true)}
                    className="flex items-center gap-3 p-3 rounded-2xl text-slate-400 cursor-pointer border border-transparent hover:border-amber-500/30 hover:bg-amber-600/10 hover:text-amber-400 focus:bg-amber-600/10 focus:text-amber-400 transition-all duration-300 group outline-none"
                  >
                    <Megaphone size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Broadcast</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onOpenTab?.('/PainelAlpha/UsuariosOnline', 'Agentes Online')}
                    className="flex items-center gap-3 p-3 rounded-2xl text-slate-400 cursor-pointer border border-transparent hover:border-emerald-500/30 hover:bg-emerald-600/10 hover:text-emerald-400 focus:bg-emerald-600/10 focus:text-emerald-400 transition-all duration-300 group outline-none"
                  >
                    <Activity size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Agentes Online</span>
                  </DropdownMenuItem>
                </div>
              </>
            )}

            <DropdownMenuSeparator className="bg-white/5 mx-2" />

            <div className="p-2 mt-2">
              <LogoutButton variant="inline" />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {temAcessoNotas && <NotesLauncherButton isCollapsed={isCollapsed} />}
      </div>
    </div>
  );

  return (
    <>
      <ModalBroadcast
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        style={tema}
      />

      {/* ── Desktop sidebar ── */}
      <aside
        ref={asideRef}
        className={`
          hidden lg:flex flex-col fixed left-0 top-0 z-50 h-dvh
          bg-[#060c1a]/95 backdrop-blur-xl border-r border-white/5
          transition-all duration-250 ease-in-out
          ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}
        `}
      >
        {SidebarContent}

        {/* Tooltip customizado — renderizado fora do nav para escapar do overflow:hidden */}
        <AnimatePresence>
          {isCollapsed && tooltip && (
            <motion.div
              key={tooltip.label}
              className="absolute pointer-events-none"
              style={{ left: 80, top: tooltip.top, transform: 'translateY(-50%)', zIndex: 200 }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
            >
              {/* Seta apontando para o ícone */}
              <div
                className="absolute right-full top-1/2 -translate-y-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderRight: '5px solid rgba(14, 20, 38, 0.97)',
                  borderTop: '4px solid transparent',
                  borderBottom: '4px solid transparent',
                }}
              />
              {/* Conteúdo */}
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl whitespace-nowrap"
                style={{
                  background: 'rgba(8, 14, 28, 0.97)',
                  border: `1px solid rgba(${TOOLTIP_ACCENT[tooltip.category] ?? '148,163,184'}, 0.2)`,
                  boxShadow: `0 8px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03), 0 0 12px rgba(${TOOLTIP_ACCENT[tooltip.category] ?? '148,163,184'}, 0.08)`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: `rgba(${TOOLTIP_ACCENT[tooltip.category] ?? '148,163,184'}, 1)`,
                    boxShadow: `0 0 6px rgba(${TOOLTIP_ACCENT[tooltip.category] ?? '148,163,184'}, 0.7)`,
                  }}
                />
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {tooltip.label}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* ── Mobile: hamburger trigger (rendered in layout) + drawer ── */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
              onClick={onCloseMobile}
              aria-hidden
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-[70] w-[260px] bg-[#060c1a] border-r border-white/5 flex flex-col"
            >
              <button
                onClick={onCloseMobile}
                aria-label="Fechar menu"
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Hamburger button (used in header on mobile) ────────────
export function SidebarMobileToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Abrir menu"
      className="lg:hidden p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
    >
      <PanelLeft size={18} />
    </button>
  );
}
