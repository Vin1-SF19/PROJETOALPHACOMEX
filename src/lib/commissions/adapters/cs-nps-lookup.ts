import db from "@/lib/prisma";

/**
 * Busca o registro de `clientes` (CS&NPS) correspondente a um CNPJ+serviço, usado pelo
 * merger (company-event-merger.ts) para casar um ContratoComercial com seu cliente
 * correspondente. Casamento por CNPJ exato + serviço (comparação simples — `clientes`
 * permite múltiplos registros do mesmo CNPJ por serviço diferente, ver `architecture.md`).
 */
export async function buscarClientePorCnpjEServico(cnpj: string, servico: string): Promise<{ id: number } | null> {
  return db.clientes.findFirst({
    where: { cnpj, servicos: servico },
    select: { id: true },
  });
}
