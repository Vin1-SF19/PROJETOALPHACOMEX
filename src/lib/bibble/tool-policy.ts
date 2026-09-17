import path from 'path';
import { lstat, realpath } from 'fs/promises';
import type { OllamaTool } from '@/lib/bibble/tools';
import type { UserCtx } from '@/lib/bibble/tool-executor';
import { isAdminRole, normalizeRole } from '@/lib/roles';
import { mensagemSolicitaAbrirChamado } from '@/lib/bibble/chamado-guard';

export const BIBBLE_FS_TOOLS = new Set(['ler_arquivo', 'criar_pasta', 'criar_arquivo', 'escrever_arquivo', 'apagar', 'mover_arquivo', 'copiar_arquivo']);
export const BIBBLE_MUTATING_TOOLS = new Set(['criar_pasta', 'criar_arquivo', 'escrever_arquivo', 'apagar', 'mover_arquivo', 'copiar_arquivo', 'abrir_chamado', 'criar_evento_calendario', 'editar_evento_calendario', 'cancelar_evento_calendario', 'criar_evento_calendario_colega', 'editar_evento_calendario_colega', 'cancelar_evento_calendario_colega']);
const MAX_WRITE_CHARS = Math.max(1_024, Number(process.env.BIBBLE_FS_MAX_WRITE_CHARS) || 1_000_000);

export type BibbleToolMetadata = { name: string; domain: string; mutating: boolean; permission: string | null; confirmation: boolean; timeoutMs: number; resultMaxChars: number };

export function getToolMetadata(tool: OllamaTool): BibbleToolMetadata {
  const name = tool.function.name;
  const domain = BIBBLE_FS_TOOLS.has(name) ? 'filesystem' : /calendario|agenda|evento|disponibilidade/.test(name) ? 'calendar' : /curso|modulo|progreso/.test(name) ? 'skills' : /empresa|ficha|consultas_recentes/.test(name) ? 'analise' : name.includes('chamado') ? 'chamados' : 'painel';
  const permission = name === 'abrir_chamado'
    ? null
    : domain === 'analise'
      ? 'analise'
      : domain === 'skills'
        ? 'skills'
        : domain === 'chamados'
          ? 'chamados'
          : null;
  return { name, domain, mutating: BIBBLE_MUTATING_TOOLS.has(name), permission, confirmation: ['escrever_arquivo', 'apagar', 'mover_arquivo', 'copiar_arquivo', 'cancelar_evento_calendario', 'cancelar_evento_calendario_colega'].includes(name), timeoutMs: Number(process.env.BIBBLE_TOOL_TIMEOUT_MS) || 20_000, resultMaxChars: Number(process.env.BIBBLE_TOOL_RESULT_MAX_CHARS) || 100_000 };
}

export function toolRegistry(tools: OllamaTool[]) { return tools.map(getToolMetadata); }

export function filesystemEnabled(ctx: UserCtx) {
  void ctx;
  // Fail closed until a server-owned, turn-bound approval nonce exists. Model
  // arguments are never evidence of a human confirmation.
  return false;
}

export function canConsultBehavioralProfiles(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'ADMIN' || normalized === 'TI';
}

export function authorizedTools(all: OllamaTool[], ctx: UserCtx, requestedFs: boolean) {
  void requestedFs;
  const permissions = new Set(ctx.permissoes);
  const admin = isAdminRole(ctx.role);
  const can = (name: string) => {
    if (BIBBLE_FS_TOOLS.has(name)) return false;
    if (BIBBLE_MUTATING_TOOLS.has(name) && name !== 'abrir_chamado') return false;
    if (name === 'consultar_estilo_comunicacao_usuario') return canConsultBehavioralProfiles(ctx.role);
    if (admin) return true;
    if (/colega/.test(name) || name === 'consultar_usuarios') return false;
    if (/calendario|agenda|evento|disponibilidade/.test(name)) return permissions.has('calendarioAlpha');
    // This cross-module handbook tool is intentionally available to any user
    // who can access at least one module. Keep it before the broad /modulo/
    // matcher, otherwise it is incorrectly treated as a Skills-only tool.
    if (name === 'consultar_manual_modulo') return permissions.size > 0;
    if (/curso|modulo|progreso/.test(name)) return permissions.has('skills');
    if (name === 'buscar_empresa') return permissions.has('analise') || permissions.has('radar');
    if (name === 'gerar_ficha_pre_analise' || name === 'buscar_consultas_recentes') return permissions.has('analise');
    if (name === 'listar_clientes') return permissions.has('Cliente') || permissions.has('crm');
    if (name === 'abrir_chamado') return true;
    if (name === 'consultar_chamados') return permissions.has('chamados');
    if (name === 'consultar_metas_comerciais') return permissions.has('metas');
    if (name === 'consultar_base_onyx') return permissions.has('conectoresIAlpha');
    return false;
  };
  return all.filter(tool => can(tool.function.name));
}

export function routeToolsByIntent(tools: OllamaTool[], text: string): OllamaTool[] {
  const q = text.toLocaleLowerCase('pt-BR');
  const matches = new Set<string>();
  const add = (...names: string[]) => names.forEach(n => matches.add(n));
  const behavioralProfileIntent = /(?:como|jeito|forma|estilo|perfil).{0,80}(?:fala|conversa|escreve|comunica(?:ção|r)?).{0,50}(?:com (?:você|voce)|com (?:o )?bibble)|(?:estilo|perfil) (?:de )?comunica(?:ção|cao)/u.test(q);
  if (behavioralProfileIntent) add('consultar_estilo_comunicacao_usuario');
  if (/cnpj|empresa|radar|ficha|pré[- ]análise/.test(q)) add('buscar_empresa', 'gerar_ficha_pre_analise', 'buscar_consultas_recentes');
  if (/cliente|crm/.test(q)) add('listar_clientes');
  if (mensagemSolicitaAbrirChamado(text)) add('abrir_chamado');
  if (/\b(?:consult|list|mostr|ver|quant|status|histor|meus?|abertos?|pendentes?)\w*.{0,50}\bchamado|\bchamado\w*.{0,50}\b(?:consult|list|mostr|ver|quant|status|histor)\w*/u.test(q)) add('consultar_chamados');
  if (/curso|aula|módulo|treinamento|skills/.test(q)) add('lista_cursos', 'detalhes_curso', 'lista_modulos', 'detalhes_modulo', 'consulta_progreso_aluno');
  if (/agenda|calendário|evento|reunião|disponibilidade/.test(q)) tools.filter(t => t.function.name.includes('calendario') || t.function.name.includes('agenda') || t.function.name.includes('evento') || t.function.name.includes('disponibilidade')).forEach(t => matches.add(t.function.name));
  if (/arquivo|pasta|diretório|filesystem/.test(q)) BIBBLE_FS_TOOLS.forEach(name => add(name));
  if (/meta|venda|comercial/.test(q)) add('consultar_metas_comerciais');
  if (!behavioralProfileIntent && /usuário|colaborador/.test(q)) add('consultar_usuarios');
  if (/manual|como (?:usar|funciona)|módulo/.test(q)) add('consultar_manual_modulo', 'consultar_base_onyx');
  if (!matches.size) return [];
  return tools.filter(t => matches.has(t.function.name));
}

function rootPath() { return path.resolve(process.env.BIBBLE_FILES_ROOT || path.join(process.cwd(), '.bibble', 'workspace')); }
function contained(root: string, target: string) { return target === root || target.startsWith(`${root}${path.sep}`); }

export async function resolveBibbleFsPath(raw: unknown, options: { existing: boolean; allowRoot?: boolean } = { existing: true }) {
  if (typeof raw !== 'string' || !raw.trim() || raw.includes('\0') || raw.includes('$') || raw.includes('~')) throw new Error('Caminho inválido');
  const root = rootPath();
  const rootReal = await realpath(root).catch(() => root);
  const candidate = path.resolve(rootReal, raw);
  if (!contained(rootReal, candidate) || (!options.allowRoot && candidate === rootReal)) throw new Error('Alvo fora da raiz isolada');
  if (options.existing) {
    const targetReal = await realpath(candidate);
    if (!contained(rootReal, targetReal) || (!options.allowRoot && targetReal === rootReal)) throw new Error('Escape por symlink bloqueado');
    return targetReal;
  }
  let ancestor = path.dirname(candidate);
  while (contained(rootReal, ancestor)) {
    try { ancestor = await realpath(ancestor); break; } catch {
      if (ancestor === rootReal) throw new Error('Raiz isolada indisponível');
      ancestor = path.dirname(ancestor);
    }
  }
  if (!contained(rootReal, ancestor)) throw new Error('Destino fora da raiz isolada');
  await lstat(ancestor);
  return candidate;
}

export function validateFilesystemMutation(name: string, params: Record<string, unknown>) {
  throw new Error(`Ferramenta de filesystem desabilitada: ${name}. É necessária aprovação humana server-side.`);
  /* c8 ignore next 8 -- retained as documentation for the future nonce-gated implementation */
  {
  const content = String(params.conteudo ?? '');
  if (content.length > MAX_WRITE_CHARS) throw new Error('Conteúdo excede o limite de escrita');
  if (['escrever_arquivo', 'apagar', 'mover_arquivo', 'copiar_arquivo'].includes(name)) {
    const target = name === 'mover_arquivo' || name === 'copiar_arquivo' ? params.destino : params.caminho;
    if (params.confirmacao_alvo !== target || params.confirmado !== true) throw new Error('Confirmação explícita vinculada ao alvo é obrigatória');
  }
  if (name === 'apagar' && params.recursivo === true) throw new Error('Exclusão recursiva não é permitida');
  }
}
