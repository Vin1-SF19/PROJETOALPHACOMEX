'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { CrmSpaceBackground } from './CRMBackground';
import { PerfilEmpresaProvider } from '@/components/PerfilEmpresaGlobal';

interface CRMLayoutClientProps {
  children: React.ReactNode;
  session?: unknown;
  standaloneUrl?: string;
}

export default function CRMLayoutClient({ children, session: _session, standaloneUrl }: CRMLayoutClientProps) {
  return (
    <PerfilEmpresaProvider>
      <div className="relative min-h-screen overflow-x-hidden text-slate-100">
        <CrmSpaceBackground />

        <div className="relative z-10 min-h-screen">
          <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
              {standaloneUrl ? (
                <Link
                  href={standaloneUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  Abrir em nova guia
                </Link>
              ) : null}

              {children}
            </div>
          </main>
        </div>
      </div>
    </PerfilEmpresaProvider>
  );
}
