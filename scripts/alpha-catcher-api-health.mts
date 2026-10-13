// Diagnóstico somente leitura; sem consulta de CNPJ, gravação ou alteração da fila.
// Uso: node --conditions=react-server --import tsx scripts/alpha-catcher-api-health.mts [--user-id ID]
import { diagnosticarApisCatcher } from '../src/lib/alpha-catcher/diagnostico-apis';
import { encaminharWorkerCatcher } from '../src/lib/alpha-catcher/worker-client';

for (const arquivo of ['.env.local', '.env']) {
  try { process.loadEnvFile(arquivo); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Uso: node --conditions=react-server --import tsx scripts/alpha-catcher-api-health.mts [--user-id ID]');
  console.log('Sem --user-id, verifica configuração deste ambiente. Com --user-id, tenta o diagnóstico autenticado pelo worker remoto.');
  process.exit(0);
}
let userId: number | undefined;
if (args.length) {
  if (args.length !== 2 || args[0] !== '--user-id' || !/^\d+$/.test(args[1]) || Number(args[1]) <= 0 || !Number.isSafeInteger(Number(args[1]))) throw new Error('Argumentos inválidos. Use --help.');
  userId = Number(args[1]);
}

if (userId) {
  const response = await encaminharWorkerCatcher('diagnosticar', userId, null);
  if (response) {
    const resultado: unknown = await response.json();
    if (!response.ok || !resultado || typeof resultado !== 'object') {
      console.log(JSON.stringify({ verificadoEm: new Date().toISOString(), worker: { estado: 'problema', mensagem: 'Worker remoto não respondeu à verificação autenticada.' } }, null, 2));
      process.exitCode = 1;
    } else console.log(JSON.stringify(resultado, null, 2));
  } else console.log(JSON.stringify(diagnosticarApisCatcher({ workerDisponivel: process.env.ALPHA_CATCHER_WORKER_HOST === 'true' }), null, 2));
} else console.log(JSON.stringify(diagnosticarApisCatcher({ workerDisponivel: process.env.ALPHA_CATCHER_WORKER_HOST === 'true' }), null, 2));
