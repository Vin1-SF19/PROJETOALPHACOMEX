// Leitura operacional somente; nunca altera registros nem executa importações.
const args = process.argv.slice(2);
const compartilhado = args.includes('--compartilhado');
if (compartilhado) args.splice(args.indexOf('--compartilhado'), 1);
const uso = 'node --conditions=react-server --import tsx scripts/alpha-catcher-history.mts --user-id ID [--cursor ID] [--importacao UUID|REGISTRO_ID] [--compartilhado]';
if (args.length === 1 && args[0] === '--help') { console.log(uso); process.exit(0); }
let userId: number | undefined, cursor: number | undefined;
let importacao: string | number | undefined;
for (let i = 0; i < args.length; i += 2) {
  const valor = args[i + 1];
  if (args[i] === '--importacao' && !importacao && valor && (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor) || (compartilhado && /^\d+$/.test(valor) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0))) { importacao = /^\d+$/.test(valor) ? Number(valor) : valor; continue; }
  if (!valor || !/^\d+$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) <= 0) throw new Error(uso);
  if (args[i] === '--user-id' && userId === undefined) userId = Number(valor);
  else if (args[i] === '--cursor' && cursor === undefined) cursor = Number(valor);
  else throw new Error(uso);
}
if (!userId) throw new Error(uso);
for (const arquivo of ['.env.local', '.env']) {
  try { process.loadEnvFile(arquivo); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
const { historicoCatcher } = await import('../src/lib/alpha-catcher/historico');
if (compartilhado) {
  const { readEffectiveModulePermissions } = await import('../src/lib/permissions/effective');
  if (!(await readEffectiveModulePermissions(userId)).includes('alphaCatcher')) throw new Error('Usuário sem acesso ao Alpha Catcher.');
  console.log(JSON.stringify(importacao ? await historicoCatcher.detalharCompartilhado(importacao) : await historicoCatcher.listarCompartilhado(cursor), null, 2));
} else {
  console.log(JSON.stringify(importacao ? await historicoCatcher.detalhar(String(importacao), userId) : await historicoCatcher.listar(userId, cursor), null, 2));
}
