import 'server-only';
import db from '@/lib/prisma';
import type { ColetaInput } from './logcomex-input';
import { janelaMeses } from './logcomex-input';
import { dataAtualConsulta, type EmpresaCatcher, type ResultadoCatcher } from './core';
import { blocoHistoricoSchema, linhaHistoricoSchema, historicoImportacaoSchema, type LinhaResultadoCatcher, type HistoricoImportacao } from './historico-tipos';
const ACAO = 'ALPHA_CATCHER_IMPORTACAO_LOGCOMEX';
const ACAO_LINHAS = 'ALPHA_CATCHER_IMPORTACAO_LINHAS:';
const TAMANHO_BLOCO = 100;
type EstadoColeta = 'executando' | 'concluido' | 'erro' | 'cancelado';
type Registro = { id: number; detalhes: string | null };
type RegistroCompartilhado = Registro & { userId: number; usuario: { usuario: string } };
type Complemento = { cnpj: string; nome_fantasia: string | null; capital_social: string | null };
type Repositorio = {
  criar: (userId: number, detalhes: string) => Promise<{ id: number }>;
  atualizar: (id: number, userId: number, detalhes: string) => Promise<unknown>;
  listar: (userId: number, cursor?: number) => Promise<Registro[]>;
  buscar: (userId: number, id: string) => Promise<Registro | null>;
  blocos: (userId: number, id: string) => Promise<Registro[]>;
  gravarBloco: (userId: number, id: string, indice: number, detalhes: string, auditId?: number) => Promise<{ id: number }>;
  listarCompartilhado?: (cursor?: number) => Promise<RegistroCompartilhado[]>;
  buscarCompartilhado?: (referencia: number | string) => Promise<RegistroCompartilhado | null>;
  complementos?: (cnpjs: string[]) => Promise<Complemento[]>;
  criarJson?: (userId: number, resumo: HistoricoImportacao, linhas: LinhaResultadoCatcher[]) => Promise<void>;
};
const repositorio: Repositorio = {
  criarJson: async (userId, resumo, linhas) => {
    await db.$transaction(async tx => {
      const existente = await tx.auditoria.findFirst({ where: { userId, acao: ACAO, detalhes: { contains: `"id":"${resumo.id}"` } }, select: { id: true } });
      if (existente) throw new Error('Importação já registrada.');
      await tx.auditoria.create({ data: { userId, acao: ACAO, detalhes: JSON.stringify(resumo) } });
      for (let i = 0; i < linhas.length; i += TAMANHO_BLOCO) {
        const indice = i / TAMANHO_BLOCO;
        await tx.auditoria.create({ data: { userId, acao: `${ACAO_LINHAS}${resumo.id}:${indice}`, detalhes: JSON.stringify({ importacaoId: resumo.id, indice, linhas: linhas.slice(i, i + TAMANHO_BLOCO) }) } });
      }
    }, { timeout: 60000 });
  },
  complementos: cnpjs => db.consultas_radar.findMany({ where: { cnpj: { in: cnpjs } }, select: { cnpj: true, nome_fantasia: true, capital_social: true } }),
  criar: (userId, detalhes) => db.auditoria.create({ data: { userId, acao: ACAO, detalhes }, select: { id: true } }),
  atualizar: (id, userId, detalhes) => db.auditoria.update({ where: { id, userId, acao: ACAO }, data: { detalhes } }),
  listar: (userId, cursor) => db.auditoria.findMany({ where: { userId, acao: ACAO, ...(cursor ? { id: { lt: cursor } } : {}) }, orderBy: { id: 'desc' }, take: 21, select: { id: true, detalhes: true } }),
  buscar: (userId, id) => db.auditoria.findFirst({ where: { userId, acao: ACAO, detalhes: { contains: `"id":"${id}"` } }, select: { id: true, detalhes: true } }),
  blocos: (userId, id) => db.auditoria.findMany({ where: { userId, acao: { startsWith: `${ACAO_LINHAS}${id}:` } }, orderBy: { id: 'asc' }, select: { id: true, detalhes: true } }),
  listarCompartilhado: cursor => db.auditoria.findMany({ where: { acao: ACAO, ...(cursor ? { id: { lt: cursor } } : {}) }, orderBy: { id: 'desc' }, take: 21, select: { id: true, userId: true, detalhes: true, usuario: { select: { usuario: true } } } }),
  buscarCompartilhado: async referencia => {
    const registros = await db.auditoria.findMany({ where: { acao: ACAO, ...(typeof referencia === 'number' ? { id: referencia } : { detalhes: { contains: `"id":"${referencia}"` } }) }, take: 2, select: { id: true, userId: true, detalhes: true, usuario: { select: { usuario: true } } } });
    // UUIDs antigos são únicos por autor, não globalmente. Nunca escolher um dono arbitrário.
    if (registros.length > 1) return null;
    return registros[0] || null;
  },
  gravarBloco: async (userId, id, indice, detalhes, auditId) => {
    const acao = `${ACAO_LINHAS}${id}:${indice}`;
    const existente = auditId ? { id: auditId } : await db.auditoria.findFirst({ where: { userId, acao }, select: { id: true } });
    return existente ? db.auditoria.update({ where: { id: existente.id, userId, acao }, data: { detalhes }, select: { id: true } })
      : db.auditoria.create({ data: { userId, acao, detalhes }, select: { id: true } });
  },
};
type Execucao = { userId: number; auditId: number; resumo: HistoricoImportacao; coleta: EstadoColeta;
  linhas: LinhaResultadoCatcher[]; posicoes: Map<string, number>; sujos: Set<number>; blocos: Map<number, number>;
  consultando: Set<string>; cnpjs: Set<string>; resultados: Map<string, ResultadoCatcher['estado']>; fila: Promise<unknown>; timer?: ReturnType<typeof setTimeout>; erro: boolean };
function podeRetomarResumo(resumo: HistoricoImportacao) {
  return resumo.origem === 'LOGCOMEX' && resumo.listaDisponivel && !resumo.recuperadoEm &&
    resumo.tentativas?.at(-1)?.estado !== 'concluido' &&
    Boolean(resumo.fimColeta || resumo.estado === 'interrompido') &&
    ['erro', 'cancelado', 'interrompido', 'pendente'].includes(resumo.estado);
}
export function criarHistoricoCatcher(repo: Repositorio = repositorio, agora = () => new Date()) {
  const execucoes = new Map<string, Execucao>();
  const carregamentos = new Map<string, Promise<void>>();
  function obter(id: string, userId: number) {
    const execucao = execucoes.get(`${userId}:${id}`);
    return execucao?.userId === userId ? execucao : undefined;
  }
  function recalcular(e: Execucao) {
    e.resumo.totalColetadas = e.cnpjs.size;
    e.resumo.processadas = e.resultados.size;
    e.resumo.novasSalvas = [...e.resultados.values()].filter(v => v === 'salvo').length;
    e.resumo.pendentes = [...e.resultados.values()].filter(v => v === 'pendente').length;
    if (e.coleta === 'executando') { e.resumo.estado = 'em_andamento'; e.resumo.fim = null; }
    else if (e.resultados.size < e.cnpjs.size) e.resumo.estado = e.resumo.origem === 'JSON' ? 'em_andamento' : 'pendente';
    else {
      e.resumo.fim ??= agora().toISOString();
      e.resumo.estado = e.coleta === 'concluido' && e.resumo.pendentes ? 'pendente' : e.coleta;
    }
  }
  function salvar(e: Execucao) {
    if (e.timer) { clearTimeout(e.timer); e.timer = undefined; }
    recalcular(e);
    e.fila = e.fila.catch(() => undefined).then(async () => {
      // Snapshot é criado dentro da fila, evitando sobrescrever um contador mais novo.
      recalcular(e);
      const resumo = { ...e.resumo };
      const sujos = [...e.sujos];
      for (const indice of sujos) {
        // Retira antes do await; uma atualização concorrente marca o bloco novamente.
        e.sujos.delete(indice);
        const detalhes = JSON.stringify({ importacaoId: e.resumo.id, indice, linhas: e.linhas.slice(indice * TAMANHO_BLOCO, (indice + 1) * TAMANHO_BLOCO) });
        try {
          const bloco = await repo.gravarBloco(e.userId, e.resumo.id, indice, detalhes, e.blocos.get(indice));
          e.blocos.set(indice, bloco.id);
        } catch (error) { e.sujos.add(indice); throw error; }
      }
      await repo.atualizar(e.auditId, e.userId, JSON.stringify(resumo)); e.erro = false;
    }).catch(error => { e.erro = true; throw error; });
    return e.fila;
  }
  async function restaurar(id: string, userId: number) {
    if (obter(id, userId)) return;
    const key = `${userId}:${id}`;
    if (carregamentos.has(key)) return carregamentos.get(key);
    const carregamento = (async () => {
      const registro = await repo.buscar(userId, id);
      if (!registro) return;
      const resumo = historicoImportacaoSchema.parse(JSON.parse(registro.detalhes || '{}'));
      if (resumo.id !== id || resumo.recuperadoEm) return;
      const blocos = (await repo.blocos(userId, id)).map(r => ({ auditId: r.id, bloco: blocoHistoricoSchema.parse(JSON.parse(r.detalhes || '{}')) })).sort((a, b) => a.bloco.indice - b.bloco.indice);
      const linhas: LinhaResultadoCatcher[] = [];
      const indices = new Map<number, number>();
      for (const [indice, item] of blocos.entries()) {
        if (item.bloco.indice !== indice || item.bloco.importacaoId !== id) throw new Error('Lista incompleta.');
        linhas.push(...item.bloco.linhas); indices.set(indice, item.auditId);
      }
      if (linhas.length !== resumo.totalColetadas || new Set(linhas.map(l => l.cnpj)).size !== linhas.length) throw new Error('Lista incompleta.');
      execucoes.set(`${userId}:${id}`, { userId, auditId: registro.id, resumo, coleta: resumo.fimColeta ? (resumo.tentativas?.at(-1)?.estado === 'cancelado' ? 'cancelado' : resumo.tentativas?.at(-1)?.estado === 'erro' ? 'erro' : 'concluido') : 'executando', linhas,
        posicoes: new Map(linhas.map((l, i) => [l.cnpj, i])), sujos: new Set(), blocos: indices, consultando: new Set(),
        cnpjs: new Set(linhas.map(l => l.cnpj)), resultados: new Map(linhas.filter(l => ['salvo', 'existente', 'pendente'].includes(l.estado)).map(l => [l.cnpj, l.estado as ResultadoCatcher['estado']])), fila: Promise.resolve(), erro: false });
    })();
    carregamentos.set(key, carregamento);
    try { await carregamento; } finally { carregamentos.delete(key); }
  }
  async function lerDetalhe(registro: Registro | RegistroCompartilhado, id: string, userId: number) {
      const parsed = historicoImportacaoSchema.safeParse(JSON.parse(registro.detalhes || '{}'));
      if (!parsed.success || parsed.data.id !== id) return null;
      const importacao = parsed.data;
      if ('userId' in registro) {
        const compartilhado = registro;
        importacao.registroId = registro.id;
        importacao.autor = { usuario: compartilhado.usuario.usuario.replace(/^@+/, '').trim() };
      }
      const linhas: LinhaResultadoCatcher[] = [];
      if (importacao.listaDisponivel) {
        const blocos = [];
        for (const registro of await repo.blocos(userId, id)) {
          const bloco = blocoHistoricoSchema.parse(JSON.parse(registro.detalhes || '{}'));
          if (bloco.importacaoId !== id) throw new Error('Lista indisponível.');
          blocos.push(bloco);
        }
        blocos.sort((a, b) => a.indice - b.indice);
        for (const [indice, bloco] of blocos.entries()) {
          if (bloco.indice !== indice) throw new Error('Lista incompleta.');
          linhas.push(...bloco.linhas);
        }
        if (linhas.length < importacao.totalColetadas || new Set(linhas.map(l => l.cnpj)).size !== linhas.length) throw new Error('Lista incompleta.');
      }
      if (!importacao.recuperadoEm && !execucoes.has(`${userId}:${id}`) && !importacao.fim && ['em_andamento', 'pendente'].includes(importacao.estado)) importacao.estado = 'interrompido';
      // Complementação de apresentação: nunca grava snapshots nem altera datas.
      const vazio = (valor?: string | null) => !valor?.trim();
      const precisa = (linha: LinhaResultadoCatcher) => ['salvo', 'existente'].includes(linha.estado) && (vazio(linha.nomeFantasia) || vazio(linha.capitalSocial));
      const cnpjs = linhas.filter(precisa).map(linha => linha.cnpj);
      const complementos = new Map<string, Complemento>();
      if (repo.complementos) {
        for (let inicio = 0; inicio < cnpjs.length; inicio += 200) {
          for (const item of await repo.complementos(cnpjs.slice(inicio, inicio + 200))) complementos.set(item.cnpj, item);
        }
      }
      const e = obter(id, userId);
      return { importacao, linhas: linhas.map(linha => {
        const complemento = precisa(linha) ? complementos.get(linha.cnpj) : undefined;
        const exibida = complemento ? { ...linha,
          nomeFantasia: vazio(linha.nomeFantasia) ? complemento.nome_fantasia : linha.nomeFantasia,
          capitalSocial: vazio(linha.capitalSocial) ? complemento.capital_social : linha.capitalSocial,
        } : linha;
        return e?.consultando.has(linha.cnpj) && ['aguardando', 'pendente'].includes(linha.estado) ? { ...exibida, estado: 'consultando' as const } : exibida;
      }) };
  }
  return {
    async contexto(id: string, userId: number, cnpj: string) {
      await restaurar(id, userId);
      const e = obter(id, userId);
      const posicao = e?.posicoes.get(cnpj);
      if (!e || posicao === undefined) return null;
      return { origem: e.resumo.origem, dataConsulta: e.resumo.dataConsultaJson, empresa: { cnpj, consignatario: e.linhas[posicao].consignatario } };
    },
    async iniciarJson(id: string, userId: number, arquivo: string, empresas: EmpresaCatcher[], dataConsulta: string | null) {
      const existente = await repo.buscar(userId, id);
      if (existente) {
        await restaurar(id, userId);
        const e = obter(id, userId);
        if (!e || e.resumo.origem !== 'JSON' || e.resumo.arquivo !== arquivo || e.resumo.dataConsultaJson !== dataConsulta || empresas.length !== e.linhas.length || empresas.some((empresa, i) => empresa.cnpj !== e.linhas[i].cnpj || empresa.consignatario !== e.linhas[i].consignatario)) throw new Error('Importação divergente.');
        return;
      }
      const dia = dataConsulta || dataAtualConsulta(agora());
      if (repo.criarJson) {
        const resumo: HistoricoImportacao = { versao: 1, id, inicio: agora().toISOString(), fim: null, fimColeta: agora().toISOString(), estado: 'pendente', listaDisponivel: true,
          origem: 'JSON', arquivo, dataConsultaJson: dataConsulta, dataInicio: dia, dataFinal: dia, embarquesMin: 0, embarquesMax: 0, limite: 0,
          totalColetadas: empresas.length, novasSalvas: 0, processadas: 0, pendentes: 0 };
        await repo.criarJson(userId, resumo, empresas.map(e => ({ ...e, estado: 'aguardando' })));
        await restaurar(id, userId); return;
      }
      await this.iniciar(id, userId, { data: dia, dataInicio: dia, dataFinal: dia, embarquesMin: 0, embarquesMax: 0, limite: 0 });
      const e = obter(id, userId)!;
      e.resumo.origem = 'JSON'; e.resumo.arquivo = arquivo; e.resumo.dataConsultaJson = dataConsulta;
      this.coletadas(id, userId, empresas);
      await this.terminarColeta(id, userId, 'concluido');
    },
    async iniciar(id: string, userId: number, input: ColetaInput) {
      for (const [key, e] of execucoes) if (e.resumo.fim && agora().getTime() - Date.parse(e.resumo.fim) > 3600000) {
        if (e.timer) clearTimeout(e.timer); execucoes.delete(key);
      }
      const janela = janelaMeses(input.data, 3);
      const fimLegado = new Date(`${input.data}T00:00:00Z`); fimLegado.setUTCDate(fimLegado.getUTCDate() - 7);
      const resumo: HistoricoImportacao = { versao: 1, id, inicio: agora().toISOString(), fim: null, fimColeta: null,
        estado: 'em_andamento', listaDisponivel: true, origem: 'LOGCOMEX', dataPesquisa: input.data, dataInicio: input.dataInicio || janela.dataInicio, dataFinal: input.dataFinal || fimLegado.toISOString().slice(0, 10),
        tentativas: [{ inicio: agora().toISOString(), fim: null, estado: 'executando' }], etapaColeta: 'Preparando acesso à Logcomex',
        embarquesMin: input.embarquesMin ?? 1, embarquesMax: input.embarquesMax ?? 2, limite: input.limite ?? 0,
        totalColetadas: 0, novasSalvas: 0, processadas: 0, pendentes: 0 };
      const registro = await repo.criar(userId, JSON.stringify(resumo));
      execucoes.set(`${userId}:${id}`, { userId, auditId: registro.id, resumo, coleta: 'executando', linhas: [], posicoes: new Map(), sujos: new Set(), blocos: new Map(), consultando: new Set(), cnpjs: new Set(), resultados: new Map(), fila: Promise.resolve(), erro: false });
    },
    async planoRetomada(id: string, userId: number) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const registro = await repo.buscar(userId, id);
      if (!registro) return null;
      const parsed = historicoImportacaoSchema.safeParse(JSON.parse(registro.detalhes || '{}'));
      if (!parsed.success || parsed.data.id !== id) return null;
      const resumo = parsed.data;
      if (resumo.origem !== 'LOGCOMEX' || !resumo.listaDisponivel || resumo.recuperadoEm) return null;
      const blocos = (await repo.blocos(userId, id)).map(r => blocoHistoricoSchema.parse(JSON.parse(r.detalhes || '{}'))).sort((a, b) => a.indice - b.indice);
      const linhas: LinhaResultadoCatcher[] = [];
      for (const [indice, bloco] of blocos.entries()) { if (bloco.indice !== indice || bloco.importacaoId !== id) throw new Error('Lista incompleta.'); linhas.push(...bloco.linhas); }
      if (linhas.length !== resumo.totalColetadas || new Set(linhas.map(l => l.cnpj)).size !== linhas.length) throw new Error('Lista incompleta.');
      // A UI legada enviava `data` igual ao fim do intervalo; o resumo antigo não guardava esse campo separado.
      const data = resumo.dataPesquisa || resumo.dataFinal;
      const emExecucao = obter(id, userId)?.coleta === 'executando';
      const elegivel = !emExecucao && podeRetomarResumo(resumo.estado === 'em_andamento' ? { ...resumo, estado: 'interrompido' } : resumo);
      return { elegivel, id, input: { data, dataInicio: resumo.dataInicio, dataFinal: resumo.dataFinal, embarquesMin: resumo.embarquesMin, embarquesMax: resumo.embarquesMax, limite: resumo.limite },
        coletadas: resumo.totalColetadas, processadas: resumo.processadas, empresas: linhas.map(l => ({ cnpj: l.cnpj, consignatario: l.consignatario })),
        ignorarNomes: linhas.map(l => l.consignatario), ignorarCnpjs: linhas.map(l => l.cnpj),
        aviso: 'O ranking será relido; perfis de nomes já persistidos serão ignorados. Não há cursor remoto confiável.' };
    },
    async retomar(id: string, userId: number, planoFornecido?: Awaited<ReturnType<typeof this.planoRetomada>>) {
      const plano = planoFornecido || await this.planoRetomada(id, userId);
      if (!plano?.elegivel) throw new Error('Importação não elegível ou não encontrada.');
      await restaurar(id, userId);
      const e = obter(id, userId);
      if (!e) throw new Error('Coleta não encontrada.');
      const inicio = agora().toISOString();
      e.resumo.tentativas ??= [{ inicio: e.resumo.inicio || inicio, fim: e.resumo.fimColeta || inicio,
        estado: e.resumo.estado === 'erro' ? 'erro' : e.resumo.estado === 'cancelado' ? 'cancelado' : 'indeterminado',
        motivo: e.resumo.motivoInterrupcao }];
      const anterior = e.resumo.tentativas.at(-1);
      if (anterior && !anterior.fim) { anterior.fim = inicio; anterior.estado = 'erro'; anterior.motivo = 'worker_encerrado'; }
      e.resumo.tentativas.push({ inicio, fim: null, estado: 'executando' });
      e.resumo.fimColeta = null; e.resumo.fim = null; e.resumo.motivoInterrupcao = undefined;
      e.resumo.etapaColeta = 'Preparando acesso à Logcomex'; e.resumo.progressoColeta = undefined;
      e.coleta = 'executando';
      await salvar(e);
      return plano;
    },
    async diagnostico(id: string, userId: number, etapa: string, progresso?: HistoricoImportacao['progressoColeta'], motivo?: HistoricoImportacao['motivoInterrupcao']) {
      const e = obter(id, userId); if (!e) return;
      e.resumo.etapaColeta = etapa;
      if (progresso) e.resumo.progressoColeta = progresso;
      if (motivo) e.resumo.motivoInterrupcao = motivo;
      await salvar(e);
    },
    coletadas(id: string, userId: number, empresas: readonly EmpresaCatcher[]) {
      const e = obter(id, userId); if (!e) return;
      for (const empresa of empresas) if (!e.cnpjs.has(empresa.cnpj)) {
        e.cnpjs.add(empresa.cnpj); e.posicoes.set(empresa.cnpj, e.linhas.length);
        e.sujos.add(Math.floor(e.linhas.length / TAMANHO_BLOCO));
        e.linhas.push({ cnpj: empresa.cnpj, consignatario: empresa.consignatario, estado: 'aguardando' });
      }
      recalcular(e);
      if (!e.timer) { e.timer = setTimeout(() => { void salvar(e).catch(() => undefined); }, 1000); e.timer.unref(); }
    },
    consulta(id: string, userId: number, cnpj: string, ativa: boolean) {
      const e = obter(id, userId); if (!e?.cnpjs.has(cnpj)) return;
      if (ativa) e.consultando.add(cnpj); else e.consultando.delete(cnpj);
    },
    aceitaEmpresa(id: string, userId: number, cnpj: string) { return Boolean(obter(id, userId)?.cnpjs.has(cnpj)); },
    async resultado(id: string, userId: number, resultado: ResultadoCatcher) {
      const e = obter(id, userId);
      if (!e?.cnpjs.has(resultado.cnpj)) throw new Error('Importação não encontrada.');
      // Reconsultar uma empresa criada por esta execução não a transforma em existente.
      if (!['salvo', 'existente'].includes(e.resultados.get(resultado.cnpj) || '')) {
        e.resultados.set(resultado.cnpj, resultado.estado);
        const posicao = e.posicoes.get(resultado.cnpj)!;
        e.linhas[posicao] = linhaHistoricoSchema.parse({ ...e.linhas[posicao], ...resultado, consignatario: e.linhas[posicao].consignatario });
        e.sujos.add(Math.floor(posicao / TAMANHO_BLOCO));
      }
      await salvar(e);
    },
    async terminarColeta(id: string, userId: number, estado: Exclude<EstadoColeta, 'executando'>) {
      const e = obter(id, userId); if (!e) return;
      if (e.coleta === 'executando') {
        e.coleta = estado; e.resumo.fimColeta = agora().toISOString();
        const ultima = e.resumo.tentativas?.at(-1);
        if (ultima && !ultima.fim) { ultima.fim = e.resumo.fimColeta; ultima.estado = estado; ultima.motivo = e.resumo.motivoInterrupcao; }
      }
      await salvar(e);
    },
    temErro(id: string, userId: number) { return Boolean(obter(id, userId)?.erro); },
    async detalhar(id: string, userId: number) {
      const registro = await repo.buscar(userId, id);
      return registro ? lerDetalhe(registro, id, userId) : null;
    },
    async detalharCompartilhado(referencia: number | string, viewerId?: number) {
      if (!repo.buscarCompartilhado) throw new Error('Leitura compartilhada indisponível.');
      const registro = await repo.buscarCompartilhado(referencia);
      if (!registro) return null;
      const parsed = historicoImportacaoSchema.safeParse(JSON.parse(registro.detalhes || '{}'));
      if (!parsed.success || (typeof referencia === 'string' && parsed.data.id !== referencia)) return null;
      const detalhe = await lerDetalhe(registro, parsed.data.id, registro.userId);
      if (detalhe) detalhe.importacao.podeRetomar = viewerId === registro.userId && podeRetomarResumo(detalhe.importacao);
      return detalhe;
    },
    async listarCompartilhado(cursor?: number, viewerId?: number) {
      if (!repo.listarCompartilhado) throw new Error('Leitura compartilhada indisponível.');
      const registros = await repo.listarCompartilhado(cursor);
      const importacoes: HistoricoImportacao[] = [];
      for (const registro of registros.slice(0, 20)) {
        try {
          const parsed = historicoImportacaoSchema.safeParse(JSON.parse(registro.detalhes || ''));
          if (!parsed.success) continue;
          const item = parsed.data;
          item.registroId = registro.id;
          item.autor = { usuario: registro.usuario.usuario.replace(/^@+/, '').trim() };
          if (!item.recuperadoEm && !execucoes.has(`${registro.userId}:${item.id}`) && ['em_andamento', 'pendente'].includes(item.estado) && !item.fim) item.estado = 'interrompido';
          item.podeRetomar = viewerId === registro.userId && podeRetomarResumo(item);
          importacoes.push(item);
        } catch { /* Resumo inválido não expõe detalhes internos. */ }
      }
      return { importacoes, proximoCursor: registros.length > 20 ? registros[19].id : null };
    },
    async listar(userId: number, cursor?: number) {
      const registros = await repo.listar(userId, cursor);
      const importacoes: HistoricoImportacao[] = [];
      for (const registro of registros.slice(0, 20)) {
        try {
          const parsed = historicoImportacaoSchema.safeParse(JSON.parse(registro.detalhes || ''));
          if (parsed.success) {
            const item = parsed.data;
            if (!item.recuperadoEm && !execucoes.has(`${userId}:${item.id}`) && ['em_andamento', 'pendente'].includes(item.estado) && !item.fim) item.estado = 'interrompido';
            item.podeRetomar = podeRetomarResumo(item);
            importacoes.push(item);
          }
        } catch { /* Registro alheio/inválido não expõe detalhes internos. */ }
      }
      return { importacoes, proximoCursor: registros.length > 20 ? registros[19].id : null };
    },
  };
}
const globals = globalThis as typeof globalThis & { catcherHistorico?: ReturnType<typeof criarHistoricoCatcher> };
export const historicoCatcher = globals.catcherHistorico ??= criarHistoricoCatcher();
