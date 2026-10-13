import 'server-only';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { importarEmpresas, normalizarEmpresa } from './core';
import { progressoColetaSchema, type ProgressoColeta } from './logcomex-progress';
import { resumirFalhaColeta } from './logcomex-diagnostic';
import { historicoCatcher } from './historico';
import type { ColetaInput } from './logcomex-input';

type Job = { id: string; userId: number; estado: 'executando' | 'concluido' | 'erro' | 'cancelado'; etapa: string;
  captcha?: 'necessario' | 'verificando' | 'nao_confirmado' | 'erro' | 'liberado';
  progresso?: ProgressoColeta; empresas?: ReturnType<typeof importarEmpresas>; mensagem?: string; historicoErro?: boolean; atualizado: number };
const globals = globalThis as typeof globalThis & { catcherJobs?: Map<string, Job>; catcherCancel?: Map<string, () => void>; catcherCaptcha?: Map<string, (acao: string) => void> };
globals.catcherJobs ??= new Map(); globals.catcherCancel ??= new Map();
globals.catcherCaptcha ??= new Map();
const jobs = globals.catcherJobs, cancelar = globals.catcherCancel;
const lock = resolve(tmpdir(), 'painel-alpha-logcomex-login.lock');

export function confirmarCaptcha(id: string, userId: number, acao: 'confirmar_captcha' | 'tentar_captcha') {
  const job = lerColeta(id, userId);
  if (!job || job.estado !== 'executando' || !job.captcha || ['liberado', 'verificando'].includes(job.captcha)) return false;
  const enviar = globals.catcherCaptcha!.get(id);
  if (!enviar) return false;
  job.captcha = 'verificando'; job.atualizado = Date.now(); enviar(acao); return true;
}

export function lerColeta(id: string, userId: number) {
  const job = jobs.get(id);
  if (!job || job.userId !== userId) return null;
  job.historicoErro = historicoCatcher.temErro(id, userId);
  return job;
}
export function lerColetaResposta(id: string, userId: number, desde?: number) {
  const job = lerColeta(id, userId);
  if (!job) return null;
  if (desde === undefined) return job;
  const empresas = job.empresas?.empresas || [];
  return { ...job, totalEmpresas: empresas.length, empresas: job.empresas ? { ...job.empresas, empresas: empresas.slice(desde) } : undefined };
}
export function cancelarColeta(id: string, userId: number) {
  const job = lerColeta(id, userId);
  if (!job || job.estado !== 'executando') return false;
  cancelar.get(id)?.(); return true;
}

export async function iniciarColeta(userId: number, input: ColetaInput, retomadaId?: string) {
  // Lock entre processos do mesmo host; não apagar automaticamente lock de outro worker.
  try { await mkdir(lock); } catch { throw new Error('Outra coleta está em execução ou existe um lock pendente. Aguarde a conclusão.'); }
  const id = retomadaId || randomUUID();
  const job: Job = { id, userId, estado: 'executando', etapa: 'Preparando acesso à Logcomex', atualizado: Date.now() };
  let historicoIniciado = false;
  for (const [key, value] of jobs) if (value.estado !== 'executando' && Date.now() - value.atualizado > 3600000) jobs.delete(key);
  jobs.set(id, job);
  try {
    // Relê sob o lock: um plano lido antes do lock pode ter sido concluído por outra tentativa.
    const plano = retomadaId ? await historicoCatcher.planoRetomada(id, userId) : null;
    if (retomadaId && (!plano?.elegivel || JSON.stringify(plano.input) !== JSON.stringify(input))) throw new Error('Retomada não permitida.');
    if (retomadaId) await historicoCatcher.retomar(id, userId, plano);
    else await historicoCatcher.iniciar(id, userId, input);
    historicoIniciado = true;
    const conhecidos = new Set(plano?.ignorarCnpjs || []);
    if (plano) job.empresas = { empresas: plano.empresas, invalidos: 0, duplicados: 0 };
    const worker = spawn(process.execPath, ['--import', 'tsx', resolve(process.cwd(), 'scripts/alpha-catcher-logcomex.mjs')], {
      cwd: process.cwd(), env: { ...process.env, LOGCOMEX_HEADLESS: 'true' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let encerrando = false;
    const limite = Number(process.env.ALPHA_CATCHER_JOB_MAX_MINUTES);
    const maxMs = (Number.isFinite(limite) && limite >= 30 && limite <= 480 ? limite : 480) * 60000;
    const idleMs = 30 * 60000;
    let idleTimer: ReturnType<typeof setTimeout>;
    let ultimoDiagnostico = 0;
    const atualizarAtividade = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => parar('erro', 'A coleta ficou 30 minutos sem progresso do worker. Os resultados já recebidos foram preservados.', 'inatividade'), idleMs);
      idleTimer.unref();
    };
    const prazo = maxMs < 3600000 ? `${maxMs / 60000} minutos` : `${maxMs / 3600000} horas`;
    const timeout = setTimeout(() => parar('erro', `A coleta excedeu ${prazo}. Os resultados já recebidos foram preservados.`, 'limite_execucao'), maxMs);
    timeout.unref();
    const parar = (estado: 'erro' | 'cancelado', mensagem: string, motivo: 'limite_execucao' | 'inatividade' | 'cancelada' = 'cancelada') => {
      if (job.estado !== 'executando') return;
      job.estado = estado; job.mensagem = mensagem;
      void historicoCatcher.diagnostico(id, userId, job.etapa, job.progresso, motivo).catch(() => { job.historicoErro = true; });
      void historicoCatcher.terminarColeta(id, userId, estado).catch(() => { job.historicoErro = true; });
      worker.kill('SIGTERM');
      const killTimer = setTimeout(() => { if (!encerrando) worker.kill('SIGKILL'); }, 5000); killTimer.unref();
    };
    const fechar = async () => {
      if (encerrando) return; encerrando = true;
      clearTimeout(timeout); clearTimeout(idleTimer); cancelar.delete(id); globals.catcherCaptcha!.delete(id);
      if (job.estado === 'executando') { job.estado = 'erro'; job.mensagem = 'A automação encerrou sem concluir. Confira a configuração e autorização do Gmail.';
        await historicoCatcher.diagnostico(id, userId, job.etapa, job.progresso, 'worker_encerrado').catch(() => { job.historicoErro = true; }); }
      job.atualizado = Date.now();
      await historicoCatcher.terminarColeta(id, userId, job.estado as 'concluido' | 'erro' | 'cancelado').catch(() => { job.historicoErro = true; });
      await rm(lock, { recursive: true, force: true });
    };
    cancelar.set(id, () => parar('cancelado', 'Coleta interrompida.', 'cancelada'));
    globals.catcherCaptcha!.set(id, acao => {
      if (!worker.connected) { job.captcha = 'erro'; return; }
      worker.send({ acao }, error => { if (error) job.captcha = 'erro'; });
    });
    worker.on('message', (message: unknown) => {
      if (!message || typeof message !== 'object' || job.estado !== 'executando') return;
      atualizarAtividade();
      const data = message as Record<string, unknown>;
      // Não retransmitir logs ou mensagens das bibliotecas: podem conter credenciais.
      const etapas: Record<string, string> = { gmail: 'Conectando ao Gmail autorizado', captcha_check: 'Verificando requisito de CAPTCHA', login: 'Entrando na Logcomex', otp: 'Aguardando código recebido pelo Gmail', shipment: 'Abrindo Shipment Intel', coleta: 'Coletando consignatários e CNPJs' };
      if (data.type === 'etapa' && typeof data.etapa === 'string' && etapas[data.etapa]) job.etapa = etapas[data.etapa];
      const captchaEstados = ['necessario', 'verificando', 'nao_confirmado', 'erro', 'liberado'] as const;
      if (data.type === 'captcha' && captchaEstados.some(estado => estado === data.estado)) {
        job.captcha = data.estado as typeof captchaEstados[number];
        job.etapa = job.captcha === 'liberado' ? 'CAPTCHA liberado. Continuando login…' : 'Aguardando resolução do CAPTCHA na Logcomex';
      }
      if (data.type === 'progresso') {
        const parsed = progressoColetaSchema.safeParse(data.progresso);
        if (parsed.success) job.progresso = parsed.data;
      }
      if (data.type === 'empresa') {
        const empresa = normalizarEmpresa(data.empresa);
        job.empresas ??= { empresas: [], invalidos: 0, duplicados: 0 };
        if (!empresa) job.empresas.invalidos++;
        else if (conhecidos.has(empresa.cnpj)) job.empresas.duplicados++;
        else { conhecidos.add(empresa.cnpj); job.empresas.empresas.push(empresa); }
        if (empresa) historicoCatcher.coletadas(id, userId, [empresa]);
      }
      if (data.type === 'parcial') {
        try {
          const parcial = importarEmpresas(data.resultado);
          job.empresas ??= { empresas: [], invalidos: 0, duplicados: 0 };
          for (const empresa of parcial.empresas) if (!conhecidos.has(empresa.cnpj)) { conhecidos.add(empresa.cnpj); job.empresas.empresas.push(empresa); }
          job.empresas.duplicados = Math.max(job.empresas.duplicados, parcial.duplicados);
          job.empresas.invalidos = Math.max(job.empresas.invalidos, parcial.invalidos);
        } catch { /* Não substituir snapshot válido. */ }
      }
      if (data.type === 'resultado') {
        try {
          const resultado = importarEmpresas(data.resultado);
          job.empresas ??= { empresas: [], invalidos: 0, duplicados: 0 };
          for (const empresa of resultado.empresas) if (!conhecidos.has(empresa.cnpj)) { conhecidos.add(empresa.cnpj); job.empresas.empresas.push(empresa); }
          job.empresas.invalidos += resultado.invalidos;
          job.empresas.duplicados = Math.max(job.empresas.duplicados, resultado.duplicados);
          job.estado = data.completo === true ? 'concluido' : 'erro';
          job.mensagem = data.completo === true ? 'Coleta concluída.' : resumirFalhaColeta(data.diagnostico, job.empresas.empresas.length, job.empresas.invalidos);
        } catch { job.estado = 'erro'; job.mensagem = 'Resultado inválido da coleta.'; }
      }
      if (data.type === 'erro') { job.estado = 'erro'; job.mensagem = 'Não foi possível concluir o acesso ou a coleta. Confira credenciais, Gmail, Chromium e eventual CAPTCHA.'; }
      if (Date.now() - ultimoDiagnostico >= 60000 || job.estado !== 'executando' || data.type === 'etapa') {
        ultimoDiagnostico = Date.now();
        void historicoCatcher.diagnostico(id, userId, job.etapa, job.progresso, job.estado === 'erro' ? 'falha' : undefined).catch(() => { job.historicoErro = true; });
      }
      if (['parcial', 'resultado'].includes(String(data.type)) && job.empresas) historicoCatcher.coletadas(id, userId, job.empresas.empresas);
      if (job.estado !== 'executando') void historicoCatcher.terminarColeta(id, userId, job.estado).catch(() => { job.historicoErro = true; });
      job.atualizado = Date.now();
    });
    worker.on('error', () => { void fechar(); }); worker.on('close', () => { void fechar(); });
    atualizarAtividade();
    worker.send({ ...input, ...(plano ? { retomada: { nomes: plano.ignorarNomes, empresas: plano.empresas } } : {}) });
    return job;
  } catch {
    if (historicoIniciado) await historicoCatcher.terminarColeta(id, userId, 'erro').catch(() => undefined);
    jobs.delete(id); await rm(lock, { recursive: true, force: true });
    throw new Error('Não foi possível iniciar o processo da automação.');
  }
}
export async function retomarColeta(id: string, userId: number) {
  const plano = await historicoCatcher.planoRetomada(id, userId);
  if (!plano?.elegivel) throw new Error('Importação não elegível ou não encontrada.');
  return iniciarColeta(userId, plano.input, id);
}
