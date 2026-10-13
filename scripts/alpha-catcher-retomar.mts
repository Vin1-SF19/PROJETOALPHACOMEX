// CLI operacional: metadados seguros de histórico e continuação via worker persistente.
// Uso: node --conditions=react-server --import tsx scripts/alpha-catcher-retomar.mts list|plan|resume --usuario @handle [--id UUID] [--dia YYYY-MM-DD]
import { config } from 'dotenv';
import { assinarWorkerCatcher } from '../src/lib/alpha-catcher/worker-auth';

for (const arquivo of ['.env.local', '.env']) config({ path: arquivo, quiet: true });
if (!process.env.TURSO_DATABASE_URL?.startsWith('libsql://')) throw new Error('Banco remoto Turso obrigatório.');
const { default: db } = await import('../src/lib/prisma');
const { historicoCatcher } = await import('../src/lib/alpha-catcher/historico');

const [comando, ...args] = process.argv.slice(2);
const valor = (nome: string) => { const i = args.indexOf(nome); return i < 0 ? undefined : args[i + 1]; };
const usuario = valor('--usuario')?.replace(/^@/, '');
const id = valor('--id');
const dia = valor('--dia');
if (!['list', 'plan', 'resume'].includes(comando) || !usuario || !/^[\w.-]{1,80}$/.test(usuario) || (comando !== 'list' && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id || '')) || (dia && !/^\d{4}-\d{2}-\d{2}$/.test(dia))) {
  process.stderr.write('Uso: alpha-catcher-retomar.mts list|plan|resume --usuario @handle [--id UUID] [--dia YYYY-MM-DD]\n');
  process.exitCode = 2;
} else {
  try {
    const dono = await db.usuarios.findUnique({ where: { usuario }, select: { id: true } });
    if (!dono) throw new Error('Usuário não encontrado.');
    if (comando === 'list') {
      const itens = (await historicoCatcher.listar(dono.id)).importacoes.filter(item => item.origem === 'LOGCOMEX' && (!dia || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(item.inicio || 0)) === dia));
      process.stdout.write(`${JSON.stringify(itens.map(item => ({ id: item.id, inicio: item.inicio, fimColeta: item.fimColeta, fim: item.fim, estado: item.estado, etapaColeta: item.etapaColeta, progressoColeta: item.progressoColeta, motivoInterrupcao: item.motivoInterrupcao, totalColetadas: item.totalColetadas, processadas: item.processadas, podeRetomar: item.podeRetomar })), null, 2)}\n`);
    } else {
      const plano = await historicoCatcher.planoRetomada(id!, dono.id);
      if (!plano) throw new Error('Coleta não encontrada para o usuário.');
      process.stdout.write(`${JSON.stringify({ id: plano.id, elegivel: plano.elegivel, filtros: plano.input, coletadas: plano.coletadas, processadas: plano.processadas, aviso: plano.aviso }, null, 2)}\n`);
      if (comando === 'resume') {
        if (!plano.elegivel) throw new Error('Coleta não elegível para continuação.');
        const base = process.env.ALPHA_CATCHER_WORKER_URL;
        const secret = process.env.ALPHA_CATCHER_WORKER_SECRET;
        if (!base || !secret) throw new Error('URL ou segredo do worker não configurado.');
        const url = new URL('/api/internal/alpha-catcher/worker', base);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('URL do worker inválida.');
        const body = JSON.stringify({ operacao: 'retomar', userId: dono.id, dados: id });
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...assinarWorkerCatcher(body, secret) }, body, redirect: 'error', signal: AbortSignal.timeout(30000) });
        const resultado = await response.json() as { id?: string; error?: string };
        if (!response.ok || resultado.id !== id) throw new Error(resultado.error || 'Worker recusou a continuação.');
        process.stdout.write(`${JSON.stringify({ iniciado: true, id: resultado.id })}\n`);
      }
    }
  } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : 'Falha operacional.'}\n`); process.exitCode = 1; }
  finally { await db.$disconnect(); }
}
