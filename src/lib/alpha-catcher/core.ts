import { validarCnpj } from '@/lib/gerador-documentos/cnpj';
import { z } from 'zod';

export type EmpresaCatcher = { cnpj: string; consignatario: string };
export type ResultadoCatcher = EmpresaCatcher & {
  estado: 'existente' | 'salvo' | 'pendente';
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  capitalSocial?: string | null;
  situacao?: string | null;
  modalidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  dataConsulta?: string | null;
  regimeTributario?: string | null;
  optanteSimples?: boolean | null;
  dataOpcao?: string | null;
  mensagem?: string;
  codigo?: string;
};

export function normalizarDiasReceita(value: unknown): number | null {
  const parsed = z.number().int().nonnegative().safeParse(value === undefined ? 30 : value);
  return parsed.success ? parsed.data : null;
}

const empresaSchema = z.object({
  cnpj: z.string().max(32).transform(v => v.trim().replace(/[./\-\s]/g, '')).refine(v => /^\d{14}$/.test(v) && validarCnpj(v)),
  consignatario: z.string().trim().min(1).max(500),
});
export function normalizarEmpresa(value: unknown): EmpresaCatcher | null {
  const parsed = empresaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function importarEmpresas(value: unknown) {
  if (!value || typeof value !== 'object' || !('empresas' in value) || !Array.isArray(value.empresas)) {
    throw new Error('O JSON deve conter uma lista "empresas" com CNPJ e consignatário.');
  }
  const empresas: EmpresaCatcher[] = [];
  const vistos = new Set<string>();
  let invalidos = 0, duplicados = 0;
  for (const valueItem of value.empresas) {
    const item = normalizarEmpresa(valueItem);
    if (!item) { invalidos++; continue; }
    if (vistos.has(item.cnpj)) { duplicados++; continue; }
    vistos.add(item.cnpj);
    empresas.push(item);
  }
  return { empresas, invalidos, duplicados };
}

export function dataAtualConsulta(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

/** Dia civil da planilha; meio-dia em São Paulo evita mudança de dia na exibição. */
export function normalizarDataConsulta(value: unknown, agora = new Date()): Date | null | undefined {
  if (value === undefined) return undefined;
  const parsed = z.iso.date().safeParse(value);
  if (!parsed.success || parsed.data > dataAtualConsulta(agora)) return null;
  return new Date(`${parsed.data}T15:00:00.000Z`);
}
