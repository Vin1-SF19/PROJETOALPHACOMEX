'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import GlobalSidebar, { SidebarMobileToggle } from './GlobalSidebar';
import TabBar, { Tab } from './TabBar';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useAdminChamadosNotifications } from '@/hooks/useAdminChamadosNotifications';
import NotificationToast from '@/components/chamados/NotificationToast';
import { HoleriteNotificacaoGlobal } from '@/components/holerites/HoleriteNotificacaoGlobal';
import { MODULOS_REGISTRY } from '@/lib/modulos-registry';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLabelForUrl(url: string): string {
  const mod = MODULOS_REGISTRY.find(m => url === m.href || url.startsWith(m.href + '/'));
  if (mod) return mod.label;
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Página';
}

const STORAGE_KEY = 'painel_alpha_tabs_v1';

// ── Props ─────────────────────────────────────────────────────────────────────

interface PainelLayoutClientProps {
  children: React.ReactNode;
  permissoes: string[];
  role: string;
  nome: string;
  imagemUrl?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PainelLayoutClient({
  children,
  permissoes,
  role,
  nome,
  imagemUrl,
}: PainelLayoutClientProps) {
  const { isCollapsed, isMobileOpen, toggleCollapse, toggleMobile, closeMobile } = useSidebarState();
  const pathname = usePathname();

  useAdminChamadosNotifications(role);

  // ── Embedded detection (running inside an iframe) ─────────────────────────
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [tvMode, setTvMode] = useState(false);

  useEffect(() => {
    try {
      setIsEmbedded(window !== window.top);
    } catch {
      setIsEmbedded(true);
    }
  }, []);

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
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initIframeLoaded, setInitIframeLoaded] = useState(false);
  const initTabIdRef = useRef<string>('');
  const initialPathnameRef = useRef(pathname);

  // Initialize: restore from localStorage or create from current URL
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as
        | { tabs: Tab[]; activeId: string }
        | null;
      if (saved?.tabs?.length) {
        setTabs(saved.tabs);
        const restoredActive = saved.activeId ?? saved.tabs[0].id;
        setActiveId(restoredActive);
        initTabIdRef.current = restoredActive;
        return;
      }
    } catch { /* ignore */ }

    const id = `tab-${Date.now()}`;
    initTabIdRef.current = id;
    setTabs([{ id, url: pathname, label: getLabelForUrl(pathname) }]);
    setActiveId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist tabs whenever they change
  useEffect(() => {
    if (tabs.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [tabs, activeId]);

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
      const idx = prev.findIndex(t => t.id === id);
      const filtered = prev.filter(t => t.id !== id);

      if (filtered.length === 0) {
        // Última aba fechada → volta para home
        const homeId = `tab-${Date.now()}`;
        setActiveId(homeId);
        return [{ id: homeId, url: '/PainelAlpha', label: 'Início' }];
      }

      setActiveId(curr => {
        if (curr !== id) return curr;
        return filtered[Math.max(0, idx - 1)].id;
      });
      return filtered;
    });
  }, []);

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
      <HoleriteNotificacaoGlobal authenticated />

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
        />
      )}

      {/* Mobile hamburger */}
      {!tvMode && (
        <div className="lg:hidden fixed top-4 left-4 z-[55]">
          <SidebarMobileToggle onClick={toggleMobile} />
        </div>
      )}

      {/* Main content area */}
      <div className={`transition-all duration-300 ease-in-out ${tvMode ? '' : sidebarOffset} flex flex-col h-screen`}>

        {/* Tab bar */}
        {!tvMode && (
          <TabBar
            tabs={tabs}
            activeId={activeId}
            onActivate={setActiveId}
            onClose={closeTab}
          />
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
                className="w-full h-full border-none absolute inset-0"
                style={{ display: visible ? 'block' : 'none' }}
                onLoad={() => {
                  if (isInitTab) setInitIframeLoaded(true);
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
        </div>
      </div>
    </>
  );
}
