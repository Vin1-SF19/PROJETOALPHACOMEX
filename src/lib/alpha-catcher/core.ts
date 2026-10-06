import { validarCnpj } from '@/lib/gerador-documentos/cnpj';
import { z } from 'zod';

export type EmpresaCatcher = { cnpj: string; consignatario: string };
export type ResultadoCatcher = EmpresaCatcher & {
  estado: 'existente' | 'salvo' | 'pendente';
  razaoSocial?: string | null;
  situacao?: string | null;
  modalidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  mensagem?: string;
  codigo?: string;
};
export const MAX_ARQUIVO_BYTES = 5 * 1024 * 1024;
export const MAX_EMPRESAS = 10000;

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
  if (value.empresas.length > MAX_EMPRESAS) throw new Error(`Use até ${MAX_EMPRESAS} empresas por arquivo.`);
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

// Reserva síncrona compartilhada entre usuários do mesmo processo servidor.
// O chamador recebe Retry-After; nenhuma requisição fica dormindo na fila.
export function criarAdmissao(agora: () => number = Date.now) {
  let proxima = 0;
  return () => {
    const atual = agora();
    if (atual < proxima) return Math.ceil((proxima - atual) / 1000);
    proxima = atual + 30000;
    return 0;
  };
}
