import { redirect } from 'next/navigation';
import { acessoCatcher } from '@/lib/alpha-catcher/access';
import CatcherClient from './CatcherClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Alpha Catcher – Alpha' };

export default async function AlphaCatcherPage() {
  const acesso = await acessoCatcher();
  if (acesso.status !== 200) redirect(acesso.status === 401 ? '/' : '/PainelAlpha');
  return <CatcherClient temaInicial={acesso.tema!} />;
}
