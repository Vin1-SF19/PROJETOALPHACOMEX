'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CrmSpaceBackground } from './CRMBackground';
import { CRMTemaOnda, CRMTemaToggle, useCrmTema } from './CRMTema';
import { PerfilEmpresaProvider } from '@/components/PerfilEmpresaGlobal';
import type { Session } from 'next-auth';
import { getCrmBackDestination } from './crm-back-destination';
import type { CrmTema } from './crm-tema';
import { cn } from '@/lib/utils';

interface CRMLayoutClientProps {
  children: React.ReactNode;
  session: Session | null;
  temaInicial: CrmTema;
}

export default function CRMLayoutClient({ children, temaInicial }: CRMLayoutClientProps) {
  const pathname = usePathname();
  const backDestination = getCrmBackDestination(pathname);
  const isPipelineBoard = /^\/PainelAlpha\/AlphaCRM\/pipeline\/[^/]+\/?$/.test(pathname);
  const { tema, alternar, onda, encerrarOnda } = useCrmTema(temaInicial);

  return (
    <div
      data-crm-tema={tema}
      className={cn('crm-scope crm-fundo-base relative flex', isPipelineBoard ? 'h-dvh min-h-0 overflow-hidden' : 'min-h-screen')}
    >
      <CrmSpaceBackground />
      <main className={cn('crm-scroll relative z-10 min-w-0 flex-1', isPipelineBoard ? 'flex min-h-0 flex-col overflow-hidden' : 'overflow-auto')}>
        <PerfilEmpresaProvider>
          {/* Na Home não há "Voltar": a barra flutua sobre o canto vazio do cabeçalho. */}
          <div
            className={cn(
              'flex shrink-0 flex-wrap items-center gap-3 px-5 pt-4 sm:px-7 lg:px-10',
              backDestination ? 'justify-between' : 'pointer-events-none absolute inset-x-0 top-0 z-20 justify-end',
            )}
          >
            {backDestination ? (
              <Link
                href={backDestination}
                aria-label={backDestination.endsWith('/admin') ? 'Voltar para Configurações' : 'Voltar para a Home do CRM'}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-300/30 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar
              </Link>
            ) : null}
            <div className="pointer-events-auto">
              <CRMTemaToggle tema={tema} onAlternar={alternar} />
            </div>
          </div>
          {children}
        </PerfilEmpresaProvider>
      </main>
      <CRMTemaOnda onda={onda} onFim={encerrarOnda} />
    </div>
  );
}
