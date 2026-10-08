// Operação em lote: executar apply/rollback somente após relatório Vault e aprovação específica.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
import { z } from 'zod';
import { campoVazio, complementarCampos, janelaDiaCadastro, planoCadastroSchema, cadastroOriginalSchema } from '../src/lib/alpha-catcher/completar-cadastro';
const uso = 'plan --data YYYY-MM-DD | apply --plano PATH --confirmar SHA256 --backup SQL --manifesto JSON | rollback --registro PATH --confirmar SHA256 --backup SQL --manifesto JSON';
if (process.argv[2] === '--help') { console.log(uso); process.exit(0); }
const acao = process.argv[2];
if (!['plan', 'apply', 'rollback'].includes(acao)) throw new Error(uso);
const args: Record<string, string> = {};
for (let i = 3; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!['--data', '--plano', '--confirmar', '--backup', '--manifesto', '--registro'].includes(key) || !value || args[key]) throw new Error(uso);
  args[key] = value;
}
const envRoot = process.env.ALPHA_CATCHER_ENV_DIR || '/tmp/alpha-catcher-receitaws-candidate';
for (const arquivo of ['.env', '.env.local', '.env.production', '.env.production.local']) config({ path: path.join(envRoot, arquivo), quiet: true, override: true });
(process.env as Record<string, string>).NODE_ENV = 'production';
if (!process.env.TURSO_DATABASE_URL?.startsWith('libsql://')) throw new Error('Banco remoto Turso obrigatório');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const banco = hash(process.env.TURSO_DATABASE_URL);
const { default: db } = await import('../src/lib/prisma');
const directory = path.resolve('database-backups/pre-change');
await mkdir(directory, { recursive: true });
const prefix = `alpha-catcher-cadastro-${new Date().toISOString().replaceAll(':', '-')}`;
async function gravar(file: string, value: unknown) {
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(`${file}.tmp`, file);
}
async function verificarBackup() {
  if (!args['--backup'] || !args['--manifesto']) throw new Error('Backup e manifesto obrigatórios');
  const m = JSON.parse(await readFile(args['--manifesto'], 'utf8'));
  const idade = Date.now() - Date.parse(m.generatedAt);
  if (!Number.isFinite(idade) || idade < 0 || idade > 48 * 3600000 || !(m.tables > 0 && m.totalRows > 0 && m.sizeBytes > 0)) throw new Error('Backup inválido ou vencido');
  const result = spawnSync(process.execPath, ['scripts/verify-turso-backup.mjs', args['--backup'], args['--manifesto']], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error('Verificação completa do backup falhou');
}
const registroSchema = z.object({ banco: z.string(), criadoEm: z.string(), planoHash: z.string(), entradas: z.array(z.object({ original: cadastroOriginalSchema, patch: z.object({ nome_fantasia: z.string().optional(), capital_social: z.string().optional() }).strict(), estado: z.enum(['preparado', 'aplicado', 'conflito', 'revertido']) })) });
try {
  if (acao === 'plan') {
    const data = args['--data']; if (!data) throw new Error(uso);
    const rows = await db.consultas_radar.findMany({ where: { fonte: { startsWith: 'ALPHA_CATCHER' }, data_consulta: janelaDiaCadastro(data) }, orderBy: { id: 'asc' }, select: { id: true, cnpj: true, data_consulta: true, nome_fantasia: true, capital_social: true } });
    const plano = planoCadastroSchema.parse({ versao: 1, banco, criadoEm: new Date().toISOString(), data, empresas: rows.filter(r => campoVazio(r.nome_fantasia) || campoVazio(r.capital_social)).map(r => ({ ...r, data_consulta: r.data_consulta.toISOString() })) });
    const file = path.join(directory, `${prefix}-plano.json`); await gravar(file, plano);
    console.log(JSON.stringify({ modo: 'somente_leitura', plano: file, sha256: hash(await readFile(file)), empresasDoDia: rows.length, aConsultar: plano.empresas.length, semFantasia: plano.empresas.filter(r => campoVazio(r.nome_fantasia)).length, semCapital: plano.empresas.filter(r => campoVazio(r.capital_social)).length }));
  } else {
    const file = acao === 'apply' ? args['--plano'] : args['--registro'];
    if (!file) throw new Error(uso);
    const raw = await readFile(file), digest = hash(raw);
    if (args['--confirmar'] !== digest) throw new Error('Confirmação não corresponde ao checksum do artefato');
    await verificarBackup();
    if (acao === 'rollback') {
      const registro = registroSchema.parse(JSON.parse(raw.toString())); if (registro.banco !== banco) throw new Error('Banco divergente');
      let revertidos = 0, conflitos = 0;
      for (const entry of registro.entradas.filter(e => ['preparado', 'aplicado'].includes(e.estado))) {
        const { original, patch } = entry;
        const data = { ...(patch.nome_fantasia !== undefined ? { nome_fantasia: original.nome_fantasia } : {}), ...(patch.capital_social !== undefined ? { capital_social: original.capital_social } : {}) };
        const result = await db.consultas_radar.updateMany({ where: { id: original.id, cnpj: original.cnpj, data_consulta: new Date(original.data_consulta), ...patch }, data });
        if (result.count) { entry.estado = 'revertido'; revertidos++; } else conflitos++;
        await gravar(file, registro);
      }
      console.log(JSON.stringify({ revertidos, conflitos }));
    } else {
      const plano = planoCadastroSchema.parse(JSON.parse(raw.toString())); if (plano.banco !== banco) throw new Error('Banco divergente');
      const { consultarReceitaWS, EsperaReceitaWS, configReceitaWS } = await import('../src/lib/cnpj/receitaws');
      process.env.RECEITAWS_FALLBACK = 'noCache';
      if (configReceitaWS().mode !== 'commercial') throw new Error('ReceitaWS comercial obrigatória');
      const registro: z.infer<typeof registroSchema> = { banco, criadoEm: new Date().toISOString(), planoHash: digest, entradas: [] };
      const ledger = path.join(directory, `${prefix}-rollback.json`); await gravar(ledger, registro);
      const resumo = { consultadas: 0, atualizadas: 0, semDados: 0, conflitos: 0, falhas: 0 };
      for (const original of plano.empresas) {
        const atual = await db.consultas_radar.findFirst({ where: { id: original.id, cnpj: original.cnpj, fonte: { startsWith: 'ALPHA_CATCHER' }, AND: [{ data_consulta: janelaDiaCadastro(plano.data) }, { data_consulta: new Date(original.data_consulta) }], nome_fantasia: original.nome_fantasia, capital_social: original.capital_social } });
        if (!atual || !(campoVazio(atual.nome_fantasia) || campoVazio(atual.capital_social))) { resumo.conflitos++; continue; }
        let dados: { fantasia?: unknown; capital_social?: unknown } | undefined;
        for (let tentativa = 0; tentativa < 4; tentativa++) {
          try { dados = (await consultarReceitaWS(original.cnpj, { days: 0 })).dados; resumo.consultadas++; break; }
          catch (error) {
            if (error instanceof EsperaReceitaWS) {
              let restante = error.segundos;
              while (restante > 0) { const parte = Math.min(restante, 30); await new Promise(resolve => setTimeout(resolve, parte * 1000)); restante -= parte; }
              continue;
            }
            const code = error && typeof error === 'object' && 'codigo' in error ? String(error.codigo) : 'FALHA';
            resumo.falhas++; console.log(JSON.stringify({ etapa: 'receitaws', codigo: code }));
            if (['RECEITA_QUOTA_EXHAUSTED', 'RECEITA_UNAUTHORIZED', 'RECEITA_CONFIG_INVALID', 'RECEITA_NOT_CONFIGURED'].includes(code)) throw new Error(`Execução interrompida: ${code}; rollback em ${ledger}`);
            break;
          }
        }
        if (!dados) continue;
        const patch = complementarCampos(original, dados);
        if (!Object.keys(patch).length) { resumo.semDados++; continue; }
        const entry = { original, patch, estado: 'preparado' as const }; registro.entradas.push(entry); await gravar(ledger, registro);
        const result = await db.consultas_radar.updateMany({ where: { id: original.id, cnpj: original.cnpj, data_consulta: new Date(original.data_consulta), nome_fantasia: original.nome_fantasia, capital_social: original.capital_social }, data: patch });
        registro.entradas.at(-1)!.estado = result.count ? 'aplicado' : 'conflito'; await gravar(ledger, registro);
        if (result.count) resumo.atualizadas++; else resumo.conflitos++;
        console.log(JSON.stringify({ ...resumo, total: plano.empresas.length }));
      }
      console.log(JSON.stringify({ ...resumo, registroRollback: ledger, sha256Rollback: hash(await readFile(ledger)) }));
    }
  }
} finally { await db.$disconnect(); }
