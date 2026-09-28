'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { CrmSpaceBackground } from './CRMBackground';
import { PerfilEmpresaProvider } from '@/components/PerfilEmpresaGlobal';
import type { Session } from 'next-auth';
import { getCrmBackDestination } from './crm-back-destination';

interface CRMLayoutClientProps {
  children: React.ReactNode;
  session: Session | null;
  standaloneUrl?: string;
}

export default function CRMLayoutClient({ children, standaloneUrl }: CRMLayoutClientProps) {
  const pathname = usePathname();
  const backDestination = getCrmBackDestination(pathname);

  return (
    <div className="crm-scope relative flex min-h-screen" style={{ background: 'linear-gradient(180deg,#050b16,#020617)' }}>
      <CrmSpaceBackground />
      <main className="crm-scroll relative z-10 min-w-0 flex-1 overflow-auto">
        <PerfilEmpresaProvider>
          {backDestination || standaloneUrl ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 sm:px-7 lg:px-10">
              {backDestination ? (
                <Link
                  href={backDestination}
                  aria-label={backDestination.endsWith('/admin') ? 'Voltar para Configurações' : 'Voltar para a Home do CRM'}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-300/30 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Voltar
                </Link>
              ) : <span />}
              {standaloneUrl ? (
                <Link
                  href={standaloneUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  Abrir CRM independente
                </Link>
              ) : null}
            </div>
          ) : null}
          {children}
        </PerfilEmpresaProvider>
      </main>
    </div>
  );
}
