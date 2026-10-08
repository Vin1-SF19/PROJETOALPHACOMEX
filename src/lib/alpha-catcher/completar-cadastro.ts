import { z } from 'zod';
import { validarCnpj } from '@/lib/gerador-documentos/cnpj';
import { normalizarCapitalCatcher } from './resultados';
export const cadastroOriginalSchema = z.object({
  id: z.number().int().positive(), cnpj: z.string().refine(validarCnpj),
  data_consulta: z.string().datetime(), nome_fantasia: z.string().nullable(), capital_social: z.string().nullable(),
}).strict();
export const planoCadastroSchema = z.object({
  versao: z.literal(1), criadoEm: z.string().datetime(), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  banco: z.string().regex(/^[a-f0-9]{64}$/),
  empresas: z.array(cadastroOriginalSchema).max(10000),
}).strict().refine(p => new Set(p.empresas.map(e => e.id)).size === p.empresas.length, 'IDs duplicados');
export type CadastroOriginal = z.infer<typeof cadastroOriginalSchema>;
export const campoVazio = (value: string | null | undefined) => !value?.trim();
export function complementarCampos(original: Pick<CadastroOriginal, 'nome_fantasia' | 'capital_social'>, receita: { fantasia?: unknown; capital_social?: unknown }) {
  const patch: { nome_fantasia?: string; capital_social?: string } = {};
  if (campoVazio(original.nome_fantasia) && typeof receita.fantasia === 'string' && receita.fantasia.trim()) patch.nome_fantasia = receita.fantasia.trim();
  if (campoVazio(original.capital_social) && typeof receita.capital_social === 'string' && normalizarCapitalCatcher(receita.capital_social) !== null) patch.capital_social = receita.capital_social.trim();
  return patch;
}
export function janelaDiaCadastro(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida');
  const inicio = new Date(`${data}T03:00:00.000Z`);
  if (!Number.isFinite(inicio.getTime()) || inicio.toISOString().slice(0, 10) !== data) throw new Error('Data inválida');
  return { gte: inicio, lt: new Date(inicio.getTime() + 86400000) };
}
