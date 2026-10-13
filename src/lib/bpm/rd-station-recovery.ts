export function camposProtegidosHistoricoRd(correcoes: { id: string; autorId: number | null; camposAlteradosJson: string }[]) {
  return new Set(correcoes
    .filter((c) => c.autorId !== null || (!c.id.startsWith("rdrepair_") && !c.id.startsWith("rdrollback_")))
    .flatMap((c) => Object.keys(JSON.parse(c.camposAlteradosJson) as Record<string, unknown>)));
}

/** Repara apenas o nome omitido pelo importador; mantém campos editados por pessoas. */
export function repararNomeEtapaRd(projecao: Record<string, unknown>, nome: string, camposCorrigidos: Set<string>) {
  const nova = { ...projecao };
  if (!camposCorrigidos.has("sourceStageName")) nova.sourceStageName = nome;
  if (!camposCorrigidos.has("title") && (!nova.title || nova.title === "Mudança de etapa RD")) nova.title = nome;
  return nova;
}
