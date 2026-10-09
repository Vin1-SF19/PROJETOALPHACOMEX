import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readEffectiveModulePermissions } from '@/lib/permissions/effective';
import { verificarWorkerCatcher } from '@/lib/alpha-catcher/worker-auth';
import { executarWorkerCatcher } from '@/lib/alpha-catcher/worker-executar';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;
const entrada = z.object({ operacao: z.enum(['iniciar', 'ler', 'cancelar', 'confirmar_captcha', 'tentar_captcha', 'processar', 'listar-historico', 'detalhar-historico']), userId: z.number().int().positive().safe(), dados: z.unknown() }).strict();
export async function POST(req: Request) {
  if (process.env.VERCEL || process.env.ALPHA_CATCHER_WORKER_HOST !== 'true') return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
  if (!req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Envie JSON.' }, { status: 415 });
  const partes: Uint8Array[] = []; let tamanho = 0;
  const reader = req.body?.getReader();
  if (reader) for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    tamanho += value.byteLength;
    if (tamanho > 8192) { await reader.cancel(); return NextResponse.json({ error: 'Entrada muito grande.' }, { status: 413 }); }
    partes.push(value);
  }
  const body = Buffer.concat(partes).toString('utf8');
  if (!verificarWorkerCatcher(body, req.headers, process.env.ALPHA_CATCHER_WORKER_SECRET || '')) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  let parsed;
  try { parsed = entrada.safeParse(JSON.parse(body)); } catch { return NextResponse.json({ error: 'Entrada inválida.' }, { status: 400 }); }
  if (!parsed.success) return NextResponse.json({ error: 'Entrada inválida.' }, { status: 400 });
  try {
    if (!(await readEffectiveModulePermissions(parsed.data.userId)).includes('alphaCatcher')) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    return await executarWorkerCatcher(parsed.data.operacao, parsed.data.userId, parsed.data.dados);
  } catch { return NextResponse.json({ error: 'Worker indisponível.' }, { status: 503 }); }
}
