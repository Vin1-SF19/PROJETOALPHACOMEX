import { encaminharWorkerCatcher } from '@/lib/alpha-catcher/worker-client';
import { NextResponse } from 'next/server';
import { acessoCatcher } from '@/lib/alpha-catcher/access';
import { historicoCatcher } from '@/lib/alpha-catcher/historico';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const acesso = await acessoCatcher();
  if (acesso.status !== 200) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: acesso.status });
  const valor = new URL(req.url).searchParams.get('cursor');
  const cursor = valor === null ? undefined : Number(valor);
  if (cursor !== undefined && (!/^\d+$/.test(valor!) || !Number.isSafeInteger(cursor) || cursor <= 0)) return NextResponse.json({ error: 'Página inválida.' }, { status: 400 });
  const remoto = await encaminharWorkerCatcher('listar-historico', acesso.userId!, cursor ?? null);
  if (remoto) return remoto;
  try { return NextResponse.json(await historicoCatcher.listarCompartilhado(cursor), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Não foi possível carregar o histórico.' }, { status: 503 }); }
}
