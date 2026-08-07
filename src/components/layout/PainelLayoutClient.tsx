'use client';
/* eslint-disable react-hooks/refs -- padrão SSR intencional: refs de init lidos no render para o fallback */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import GlobalSidebar, { SidebarMobileToggle } from './GlobalSidebar';
import { TabBar } from './TabBar';
import { arrayMove } from '@dnd-kit/sortable';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useChamadosNotifications } from '@/hooks/useAdminChamadosNotifications';
import { useChecklistNotifications } from '@/hooks/useChecklistNotifications';
import NotificationToast from '@/components/chamados/NotificationToast';
import { HoleriteNotificacaoGlobal } from '@/components/holerites/HoleriteNotificacaoGlobal';
import ChecklistNotificationToast from '@/components/Checklist/ChecklistNotificationToast';
import { MODULOS_REGISTRY } from '@/lib/modulos-registry';
import BibbleWeatherWidget from '@/components/BibbleChatHome/BibbleWeatherWidget';
import OnboardingModal from './OnboardingModal';
import { NotesGlobalTaskbar } from '@/components/Notas/NotesGlobalTaskbar';
import { NotaNotificacaoToast } from '@/components/Notas/NotaNotificacaoToast';
import { useNotasNotifications } from '@/hooks/useNotasNotifications';
import { useNotasLembretesPendentes } from '@/hooks/useNotasLembretesPendentes';
import type { OnboardingVideo } from '@/lib/onboarding';
import { signOut } from 'next-auth/react';
import { urlRepresentaLoginDoPainel } from '@/lib/auth/navegacao-sessao';
import {
  ensurePinnedHome,
  getTabsStorageKey,
  HOME_LABEL,
  HOME_TAB_ID,
  HOME_URL,
  parseStoredTabsState,
  type PainelTab,
} from '@/lib/painel-tabs';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLabelForUrl(url: string): string {
  const mod = MODULOS_REGISTRY.find(m => url === m.href || url.startsWith(m.href + '/'));
  if (mod) return mod.label;
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Página';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PainelLayoutClientProps {
  children: React.ReactNode;
  permissoes: string[];
  role: string;
  userId: number;
  nome: string;
  imagemUrl?: string | null;
  temaName?: string;
  onboardingVisto?: boolean;
  onboardingVideo?: OnboardingVideo | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PainelLayoutClient({
  children,
  permissoes,
  role,
  userId,
  nome,
  imagemUrl,
  temaName,
  onboardingVisto = true,
  onboardingVideo = null,
}: PainelLayoutClientProps) {
  const { isCollapsed, isMobileOpen, toggleCollapse, toggleMobile, closeMobile } = useSidebarState();
  const pathname = usePathname();

  // Onboarding obrigatório: mostra o vídeo até o usuário marcar como visto
  const [onboardingDone, setOnboardingDone] = useState(false);
  const showOnboarding = !onboardingVisto && !onboardingDone && !!onboardingVideo;

  useChamadosNotifications(role, userId);
  useNotasNotifications(userId);
  useNotasLembretesPendentes();
  useChecklistNotifications(role);

  // ── Embedded detection (running inside an iframe) ─────────────────────────
  // Lazy initializer: detecta no primeiro render client-side, evita flash de sidebar dupla
  const [isEmbedded] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return window !== window.top; } catch { return true; }
  });
  const [tvMode, setTvMode] = useState(false);

  // Recebe postMessage dos iframes filhos (ex: Modo TV do Painel de Metas)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ALPHA_TV_MODE') {
        setTvMode(e.data.active === true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<PainelTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tabsHydrated, setTabsHydrated] = useState(false);
  const [initIframeLoaded, setInitIframeLoaded] = useState(false);
  const initTabIdRef = useRef<string>('');
  const initialPathnameRef = useRef(pathname);
  const encerrandoSessaoRef = useRef(false);
  const tabsStorageKey = getTabsStorageKey(userId);

  // Initialize: restore from localStorage or create from current URL
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- inicialização das abas a partir do localStorage/URL */
    try {
      const saved = parseStoredTabsState(localStorage.getItem(tabsStorageKey));
      if (saved) {
        setTabs(saved.tabs);
        setActiveId(saved.activeId);
        initTabIdRef.current = saved.activeId;
        setTabsHydrated(true);
        return;
      }
    } catch { /* ignore */ }

    // Fresh: home fixa + (se não estiver na home) a aba da página atual
    const onHome = pathname === HOME_URL || pathname === HOME_URL + '/';
    if (onHome) {
      initTabIdRef.current = HOME_TAB_ID;
      setTabs([{ id: HOME_TAB_ID, url: HOME_URL, label: HOME_LABEL, pinned: true }]);
      setActiveId(HOME_TAB_ID);
    } else {
      const id = `tab-${Date.now()}`;
      initTabIdRef.current = id;
      setTabs([
        { id: HOME_TAB_ID, url: HOME_URL, label: HOME_LABEL, pinned: true },
        { id, url: pathname, label: getLabelForUrl(pathname) },
      ]);
      setActiveId(id);
    }
    setTabsHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist tabs whenever they change
  useEffect(() => {
    if (!tabsHydrated || tabs.length === 0 || !activeId) return;

    try {
      localStorage.setItem(tabsStorageKey, JSON.stringify({ tabs, activeId }));
    } catch { /* localStorage may be unavailable in restricted browsing modes */ }
  }, [tabs, activeId, tabsHydrated, tabsStorageKey]);

  // ── Tab management ────────────────────────────────────────────────────────

  const openTab = useCallback((url: string, label: string) => {
    setTabs(prev => {
      const existing = prev.find(t => t.url === url);
      if (existing) {
        setActiveId(existing.id);
        return prev;
      }
      const id = `tab-${Date.now()}`;
      setActiveId(id);
      return [...prev, { id, url, label }];
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const target = prev.find(t => t.id === id);
      if (target?.pinned) return prev; // aba fixa (IAlpha) não fecha

      const idx = prev.findIndex(t => t.id === id);
      const filtered = prev.filter(t => t.id !== id);

      if (filtered.length === 0) {
        // Segurança: recria a home fixa
        setActiveId(HOME_TAB_ID);
        return [{ id: HOME_TAB_ID, url: HOME_URL, label: HOME_LABEL, pinned: true }];
      }

      setActiveId(curr => {
        if (curr !== id) return curr;
        return filtered[Math.max(0, idx - 1)].id;
      });
      return filtered;
    });
  }, []);

  const reorderTabs = useCallback((draggedId: string, targetId: string) => {
    setTabs(prev => {
      const oldIndex = prev.findIndex(tab => tab.id === draggedId);
      const newIndex = prev.findIndex(tab => tab.id === targetId);
      const draggedTab = prev[oldIndex];
      const targetTab = prev[newIndex];

      if (
        oldIndex < 0 ||
        newIndex < 0 ||
        oldIndex === newIndex ||
        draggedTab?.pinned ||
        targetTab?.pinned
      ) {
        return prev;
      }

      return ensurePinnedHome(arrayMove(prev, oldIndex, newIndex));
    });
  }, []);

  // Recebe ALPHA_OPEN_TAB dos iframes filhos (ex: PainelAlpha abrindo módulo em nova aba)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ALPHA_OPEN_TAB' && e.data.url) {
        openTab(e.data.url, e.data.label || getLabelForUrl(e.data.url));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [openTab]);

  // ── Embedded: render children only, no sidebar/tabs ──────────────────────

  if (isEmbedded || role === 'TV') {
    return <>{children}</>;
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const activeTab = tabs.find(t => t.id === activeId);
  const activeUrl = activeTab?.url ?? pathname;
  const openUrls = tabs.map(t => t.url);

  // Show children (SSR content) only while the initial tab's iframe hasn't loaded
  // AND the server-rendered page matches the current tab URL
  const showChildrenFallback =
    !initIframeLoaded &&
    tabs.length > 0 &&
    activeId === initTabIdRef.current &&
    (activeUrl === initialPathnameRef.current ||
      initialPathnameRef.current.startsWith(activeUrl + '/'));

  const sidebarOffset = isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]';

  return (
    <>
      <NotificationToast />
      <ChecklistNotificationToast />
      <HoleriteNotificacaoGlobal authenticated />
      <NotaNotificacaoToast />

      {!tvMode && (
        <GlobalSidebar
          permissoes={permissoes}
          openUrls={openUrls}
          role={role}
          nome={nome}
          imagemUrl={imagemUrl}
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          onToggleCollapse={toggleCollapse}
          onCloseMobile={closeMobile}
          onOpenTab={openTab}
          activeUrl={activeUrl}
          temaName={temaName}
        />
      )}

      {/* Mobile hamburger */}
      {!tvMode && (
        <div className="lg:hidden fixed top-4 left-4 z-[55]">
          <SidebarMobileToggle onClick={toggleMobile} />
        </div>
      )}

      {/* Main content area */}
      <div className={`transition-all duration-300 ease-in-out ${tvMode ? '' : sidebarOffset} flex flex-col h-dvh`}>

        {/* Tab bar + widget de clima */}
        {!tvMode && (
          <div className="relative flex items-center shrink-0 h-10 bg-[#030813] border-b border-white/[0.06]">
            <div className="flex-1 min-w-0 overflow-hidden">
              <TabBar
                tabs={tabs}
                activeId={activeId}
                onActivate={setActiveId}
                onClose={closeTab}
                onReorder={reorderTabs}
              />
            </div>
            <div className="shrink-0 pr-3">
              <BibbleWeatherWidget />
            </div>
          </div>
        )}

        {/* Page content */}
        <div className="flex-1 overflow-hidden relative">

          {/* SSR fallback shown while initial iframe loads */}
          {showChildrenFallback && (
            <div className="absolute inset-0 overflow-auto z-10 bg-[#020617]">
              {children}
            </div>
          )}

          {/* One iframe per tab — inactive ones are hidden but STAY MOUNTED */}
          {tabs.map(tab => {
            const isActive = tab.id === activeId;
            const isInitTab = tab.id === initTabIdRef.current;
            const visible = isActive && (!isInitTab || initIframeLoaded);

            return (
              <iframe
                key={tab.id}
                src={tab.url}
                title={tab.label}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="w-full h-full border-none absolute inset-0"
                style={{ display: visible ? 'block' : 'none' }}
                onLoad={(event) => {
                  if (isInitTab) setInitIframeLoaded(true);
                  try {
                    const href = event.currentTarget.contentWindow?.location.href;
                    if (
                      href &&
                      urlRepresentaLoginDoPainel(href, window.location.origin) &&
                      !encerrandoSessaoRef.current
                    ) {
                      encerrandoSessaoRef.current = true;
                      void signOut({ redirectTo: '/' });
                    }
                  } catch {
                    // Um iframe cross-origin não participa da autenticação do painel.
                  }
                }}
              />
            );
          })}

          {/* Loading state during initialization */}
          {tabs.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <span className="text-2xl font-black italic text-slate-800 animate-pulse">α</span>
            </div>
          )}

          {/* Onboarding — só na aba inicial (IAlpha); outros módulos ficam livres */}
          {showOnboarding && onboardingVideo && activeUrl === HOME_URL && (
            <OnboardingModal video={onboardingVideo} onDone={() => setOnboardingDone(true)} />
          )}
        </div>
      </div>

      {/* Camada global de notas — fora do container de iframes, sobreposta ao rodapé de qualquer módulo aberto. Recuada pela mesma largura da sidebar em telas lg+ para nunca cobri-la. */}
      {!tvMode && <NotesGlobalTaskbar userId={userId} sidebarOffsetClass={sidebarOffset} />}
    </>
  );
}
