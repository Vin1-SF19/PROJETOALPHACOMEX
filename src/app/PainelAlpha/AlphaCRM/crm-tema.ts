// Tema visual do Alpha CRM (claro/escuro). Compartilhado entre servidor e cliente:
// o layout lê o cookie no servidor para renderizar já no tema certo, sem piscar.

export type CrmTema = 'escuro' | 'claro';

export const CRM_TEMA_PADRAO: CrmTema = 'escuro';
export const CRM_TEMA_COOKIE = 'alpha-crm-tema';
const UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365;

export function normalizarCrmTema(valor: string | null | undefined): CrmTema {
  return valor === 'claro' ? 'claro' : CRM_TEMA_PADRAO;
}

export function cookieCrmTema(tema: CrmTema): string {
  return `${CRM_TEMA_COOKIE}=${tema}; path=/; max-age=${UM_ANO_EM_SEGUNDOS}; samesite=lax`;
}
