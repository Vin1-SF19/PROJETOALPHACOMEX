'use client';

import React from 'react';
import GlobalSidebar, { SidebarMobileToggle } from './GlobalSidebar';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useAdminChamadosNotifications } from '@/hooks/useAdminChamadosNotifications';
import NotificationToast from '@/components/chamados/NotificationToast';
import { HoleriteNotificacaoGlobal } from '@/components/holerites/HoleriteNotificacaoGlobal';

interface PainelLayoutClientProps {
  children: React.ReactNode;
  permissoes: string[];
  role: string;
  nome: string;
  imagemUrl?: string | null;
}

export default function PainelLayoutClient({
  children,
  permissoes,
  role,
  nome,
  imagemUrl,
}: PainelLayoutClientProps) {
  const { isCollapsed, isMobileOpen, toggleCollapse, toggleMobile, closeMobile } = useSidebarState();

  useAdminChamadosNotifications(role);

  if (role === 'TV') {
    return <>{children}</>;
  }

  return (
    <>
      <NotificationToast />
      <HoleriteNotificacaoGlobal authenticated />
      <GlobalSidebar
        permissoes={permissoes}
        role={role}
        nome={nome}
        imagemUrl={imagemUrl}
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onToggleCollapse={toggleCollapse}
        onCloseMobile={closeMobile}
      />

      {/* Mobile hamburger — top-left fixed, only shows on small screens */}
      <div className="lg:hidden fixed top-4 left-4 z-[55]">
        <SidebarMobileToggle onClick={toggleMobile} />
      </div>

      {/* Main content: offset by sidebar width on desktop */}
      <div
        className={`transition-all duration-250 ease-in-out ${isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}
      >
        {children}
      </div>
    </>
  );
}
