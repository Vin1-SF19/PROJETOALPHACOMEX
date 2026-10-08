// plan apenas lê; apply exige plano exato, backup válido e aprovação Vault.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
import { importarEmpresas, normalizarDataConsulta, dataAtualConsulta } from '../src/lib/alpha-catcher/core';
import { planoRecuperacaoSchema, idRecuperacaoJson, registrosRecuperacao, executarRecuperacaoJson } from '../src/lib/alpha-catcher/recuperar-historico-json';

const uso = 'plan --arquivo PATH --email EMAIL [--data YYYY-MM-DD] | apply|rollback --plano PATH --confirmar SHA256 --backup SQL --manifesto JSON';
if (process.argv[2] === '--help') { console.log(uso); process.exit(0); }
const acao = process.argv[2];
if (!['plan', 'apply', 'rollback'].includes(acao)) throw new Error(uso);
const args: Record<string, string> = {};
for (let i = 3; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!['--arquivo', '--email', '--data', '--plano', '--confirmar', '--backup', '--manifesto'].includes(key) || !value || args[key]) throw new Error(uso);
  args[key] = value;
}
for (const arquivo of ['.env.local', '.env']) config({ path: arquivo, quiet: true });
(process.env as Record<string, string>).NODE_ENV = 'production';
if (!process.env.TURSO_DATABASE_URL?.startsWith('libsql://')) throw new Error('Banco remoto Turso obrigatório.');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const banco = hash(process.env.TURSO_DATABASE_URL);
const { default: db } = await import('../src/lib/prisma');
const directory = path.resolve('database-backups/pre-change');
await mkdir(directory, { recursive: true });
try {
  if (acao === 'plan') {
    if (!args['--arquivo'] || !args['--email']) throw new Error(uso);
    if (normalizarDataConsulta(args['--data']) === null) throw new Error('Data inválida.');
    const dia = args['--data'] || dataAtualConsulta();
    const raw = await readFile(args['--arquivo']);
    const arquivoSha256 = hash(raw);
    const dados = importarEmpresas(JSON.parse(raw.toString('utf8')));
    if (!dados.empresas.length || dados.invalidos || dados.duplicados) throw new Error('Recuperação exige arquivo com empresas válidas distintas.');
    const usuario = await db.usuarios.findUnique({ where: { email: args['--email'] }, select: { id: true, email: true } });
    if (!usuario) throw new Error('Proprietário não encontrado.');
    const linhas = [];
    for (let i = 0; i < dados.empresas.length; i += 150) {
      const empresas = dados.empresas.slice(i, i + 150);
      const rows = await db.consultas_radar.findMany({ where: { cnpj: { in: empresas.map(e => e.cnpj) } }, select: {
        cnpj: true, razao_social: true, nome_fantasia: true, capital_social: true, situacao_radar: true, submodalidade: true, municipio: true, uf: true, data_consulta: true, regime_tributario: true, optante_simples: true, data_opcao: true,
      } });
      const mapa = new Map(rows.map(r => [r.cnpj, r]));
      for (const empresa of empresas) {
        const row = mapa.get(empresa.cnpj);
        if (!row) throw new Error('Há empresas ausentes; recuperação bloqueada.');
        linhas.push({ ...empresa, estado: 'existente' as const, razaoSocial: row.razao_social, nomeFantasia: row.nome_fantasia,
          capitalSocial: row.capital_social, situacao: row.situacao_radar, modalidade: row.submodalidade, municipio: row.municipio, uf: row.uf,
          dataConsulta: row.data_consulta.toISOString(), regimeTributario: row.regime_tributario, optanteSimples: row.optante_simples, dataOpcao: row.data_opcao?.toISOString() || null });
      }
    }
    const criadoEm = new Date().toISOString();
    const id = idRecuperacaoJson(hash(`${banco}:${usuario.id}:${arquivoSha256}`));
    const plano = planoRecuperacaoSchema.parse({ versao: 1, banco, userId: usuario.id, email: usuario.email, arquivoSha256, criadoEm,
      resumo: { versao: 1, id, origem: 'JSON', arquivo: path.basename(args['--arquivo']), arquivoSha256, recuperadoEm: criadoEm,
        inicio: null, fim: null, fimColeta: null, estado: 'concluido', listaDisponivel: true, dataInicio: dia, dataFinal: dia,
        dataConsultaJson: args['--data'] || null, embarquesMin: 0, embarquesMax: 0, limite: 0, totalColetadas: linhas.length, processadas: linhas.length, novasSalvas: null, pendentes: 0 }, linhas });
    const file = path.join(directory, `alpha-catcher-historico-json-${id}.plan.json`);
    await writeFile(file, JSON.stringify(plano, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ modo: 'somente_leitura', plano: file, sha256: hash(await readFile(file)), email: usuario.email, empresas: linhas.length, registrosAuditoria: registrosRecuperacao(plano).length, bancoHash: banco }));
  } else {
    if (!args['--plano'] || !args['--backup'] || !args['--manifesto']) throw new Error(uso);
    const raw = await readFile(args['--plano']);
    if (args['--confirmar'] !== hash(raw)) throw new Error('Confirmação não corresponde ao plano.');
    const plano = planoRecuperacaoSchema.parse(JSON.parse(raw.toString()));
    if (plano.banco !== banco) throw new Error('Banco divergente.');
    const manifest = JSON.parse(await readFile(args['--manifesto'], 'utf8'));
    const idade = Date.now() - Date.parse(manifest.generatedAt);
    if (!Number.isFinite(idade) || idade < 0 || idade > 48 * 3600000 || manifest.databaseHash !== banco) throw new Error('Backup vencido ou de banco divergente.');
    const verificacao = spawnSync(process.execPath, ['scripts/verify-turso-backup.mjs', args['--backup'], args['--manifesto']], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (verificacao.status !== 0) throw new Error('Verificação completa do backup falhou.');
    const resultado = await executarRecuperacaoJson(plano, {
      transacao: operacao => db.$transaction(tx => operacao({
        email: async userId => (await tx.usuarios.findUnique({ where: { id: userId }, select: { email: true } }))?.email,
        registros: (userId, acao) => tx.auditoria.findMany({ where: { userId, acao, ...(acao === 'ALPHA_CATCHER_IMPORTACAO_LOGCOMEX' ? { detalhes: { contains: `"id":"${plano.resumo.id}"` } } : {}) }, select: { id: true, detalhes: true } }),
        criar: (userId, registro) => tx.auditoria.create({ data: { userId, ...registro }, select: { id: true } }),
        remover: async (userId, id, registro) => (await tx.auditoria.deleteMany({ where: { userId, id, ...registro } })).count,
      }), { timeout: 60000 }),
    }, acao as 'apply' | 'rollback');
    console.log(JSON.stringify({ ...resultado, importacaoId: plano.resumo.id, empresas: plano.linhas.length }));
  }
} finally { await db.$disconnect(); }
