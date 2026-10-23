/** Prisma e o adapter HTTP do libSQL expõem a mesma constraint em formas distintas.
 * Não usar instanceof: o erro pode atravessar bundles ou vir encapsulado em cause. */
export function erroEhCnpjDuplicado(error: unknown): boolean {
  const vistos = new Set<object>();
  let atual = error;
  for (let nivel = 0; nivel < 6 && atual && typeof atual === "object"; nivel += 1) {
    if (vistos.has(atual)) return false;
    vistos.add(atual);
    const e = atual as Record<string, unknown>;
    const meta = e.meta && typeof e.meta === "object" ? e.meta as Record<string, unknown> : null;
    if (e.code === "P2002" && (!meta?.modelName || meta.modelName === "Cliente")) {
      const target = meta?.target;
      if (Array.isArray(target) && target.length === 1 && target[0] === "cnpj"
        || typeof target === "string" && ["cnpj", "Cliente_cnpj_key"].includes(target)) return true;
    }
    for (const mensagem of [e.message, e.originalMessage]) {
      if (typeof mensagem === "string"
        && /\bunique\s+constraint\s+failed:\s*["`]?Cliente["`]?\s*\.\s*["`]?cnpj["`]?\s*(?:$|\n)/i.test(mensagem)) return true;
    }
    if (e.kind === "UniqueConstraintViolation" && e.constraint && typeof e.constraint === "object") {
      const fields = (e.constraint as Record<string, unknown>).fields;
      if (Array.isArray(fields) && fields.length === 1 && fields[0] === "cnpj") return true;
    }
    atual = e.cause;
  }
  return false;
}
