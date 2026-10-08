import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { config } from 'dotenv';
import { planoReclassificacaoSchema, prepararReclassificacaoJson, executarReclassificacaoJson } from '../src/lib/alpha-catcher/reclassificar-historico-json';

const uso = 'plan --email EMAIL --importacao UUID --instante ISO | apply|rollback --plano PATH --confirmar SHA256 --backup SQL --manifesto JSON';
const modo = process.argv[2];
if (modo === '--help') { console.log(uso); process.exit(0); }
if (!['plan', 'apply', 'rollback'].includes(modo)) throw new Error(uso);
const args: Record<string, string> = {};
for (let i = 3; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!['--email', '--importacao', '--instante', '--plano', '--confirmar', '--backup', '--manifesto'].includes(key) || !value || args[key]) throw new Error(uso);
  args[key] = value;
}
for (const f of ['.env.local', '.env']) config({ path: f, quiet: true });
(process.env as Record<string, string>).NODE_ENV = 'production';
if (!process.env.TURSO_DATABASE_URL?.startsWith('libsql://')) throw new Error('Banco remoto Turso obrigatório.');
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const banco = hash(process.env.TURSO_DATABASE_URL);
const { default: db } = await import('../src/lib/prisma');
try {
  if (modo === 'plan') {
    if (!args['--email'] || !/^[0-9a-f-]{36}$/i.test(args['--importacao'] || '') || !args['--instante']) throw new Error(uso);
    const instante = new Date(args['--instante']).toISOString(), id = args['--importacao'];
    const user = await db.usuarios.findUnique({ where: { email: args['--email'] }, select: { id: true, email: true } });
    if (!user) throw new Error('Usuário ausente.');
    const rows = await db.auditoria.findMany({ where: { userId: user.id, OR: [{ acao: 'ALPHA_CATCHER_IMPORTACAO_LOGCOMEX', detalhes: { contains: `"id":"${id}"` } }, { acao: { startsWith: `ALPHA_CATCHER_IMPORTACAO_LINHAS:${id}:` } }] }, select: { id: true, acao: true, detalhes: true } });
    const cnpjs: string[] = rows.filter(r => r.acao.startsWith('ALPHA_CATCHER_IMPORTACAO_LINHAS:')).flatMap(r => JSON.parse(r.detalhes || '{}').linhas.map((l: { cnpj: string }) => l.cnpj));
    const datas = new Map<string, string>();
    for (let i = 0; i < cnpjs.length; i += 150) {
      const cadastros = await db.consultas_radar.findMany({ where: { cnpj: { in: cnpjs.slice(i, i + 150) } }, select: { cnpj: true, data_consulta: true } });
      for (const r of cadastros) datas.set(r.cnpj, r.data_consulta.toISOString());
    }
    const plano = planoReclassificacaoSchema.parse({ versao: 1, banco, userId: user.id, email: user.email, importacaoId: id, instante, criadoEm: new Date().toISOString(), ...prepararReclassificacaoJson(rows, id, instante, datas) });
    const dir = path.resolve('database-backups/pre-change'); await mkdir(dir, { recursive: true });
    const file = path.join(dir, `alpha-catcher-reclassificacao-${id}-${Date.now()}.plan.json`);
    await writeFile(file, JSON.stringify(plano, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ modo: 'somente_leitura', plano: file, sha256: hash(await readFile(file)), email: user.email, instante, total: plano.total, salvas: plano.salvas, existentes: plano.existentes, registros: plano.registros.length }));
  } else {
    if (!args['--plano'] || !args['--backup'] || !args['--manifesto']) throw new Error(uso);
    const raw = await readFile(args['--plano']); if (hash(raw) !== args['--confirmar']) throw new Error('Plano não corresponde à confirmação.');
    const plano = planoReclassificacaoSchema.parse(JSON.parse(raw.toString())); if (plano.banco !== banco) throw new Error('Banco divergente.');
    const m = JSON.parse(await readFile(args['--manifesto'], 'utf8')), idade = Date.now() - Date.parse(m.generatedAt);
    if (!Number.isFinite(idade) || idade < 0 || idade > 48 * 3600000 || m.databaseHash !== banco) throw new Error('Backup vencido ou de banco divergente.');
    if (spawnSync(process.execPath, ['scripts/verify-turso-backup.mjs', args['--backup'], args['--manifesto']], { encoding: 'utf8' }).status !== 0) throw new Error('Backup não passou na restauração completa.');
    const result = await executarReclassificacaoJson(plano, { transacao: operacao => db.$transaction(tx => operacao({
      email: async userId => (await tx.usuarios.findUnique({ where: { id: userId }, select: { email: true } }))?.email,
      atualizar: async (userId, r, rollback) => {
        const anterior = rollback ? r.depois : r.antes, novo = rollback ? r.antes : r.depois;
        const where = { userId, id: r.id, acao: r.acao, detalhes: anterior };
        const result = await tx.auditoria.updateMany({ where, data: { detalhes: novo } });
        return result.count || await tx.auditoria.count({ where: { ...where, detalhes: novo } });
      },
    }), { timeout: 60000 }) }, modo === 'rollback');
    console.log(JSON.stringify({ ...result, importacaoId: plano.importacaoId }));
  }
} finally { await db.$disconnect(); }
