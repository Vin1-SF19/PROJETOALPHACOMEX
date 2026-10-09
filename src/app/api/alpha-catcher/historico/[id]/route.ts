import { encaminharWorkerCatcher } from '@/lib/alpha-catcher/worker-client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { acessoCatcher } from '@/lib/alpha-catcher/access';
import { historicoCatcher } from '@/lib/alpha-catcher/historico';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const acesso = await acessoCatcher();
  if (acesso.status !== 200) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: acesso.status });
  const { id } = await ctx.params;
  const referencia = /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : id;
  if (typeof referencia === 'string' && !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Importação inválida.' }, { status: 400 });
  const remoto = await encaminharWorkerCatcher('detalhar-historico', acesso.userId!, referencia);
  if (remoto) return remoto;
  try {
    const detalhe = await historicoCatcher.detalharCompartilhado(referencia);
    return detalhe ? NextResponse.json(detalhe, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ error: 'Importação não encontrada.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Não foi possível carregar a lista desta importação.' }, { status: 503 }); }
}
