import type { EmpresaCatcher } from './core';
export function criarFilaCatcher<T extends EmpresaCatcher>() {
  const itens: T[] = [], vistos = new Set<string>();
  return { itens, adicionar(empresas: readonly T[]) {
    const novas = empresas.filter(empresa => {
      if (vistos.has(empresa.cnpj)) return false;
      vistos.add(empresa.cnpj); return true;
    });
    itens.push(...novas); return novas;
  } };
}
