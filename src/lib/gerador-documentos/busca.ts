export interface DocumentoBuscavel {
  titulo: string;
  cliente: { razaoSocial: string; nomeFantasia: string | null } | null;
}

/** Filtro client-side da listagem de documentos gerados por título ou nome do contratante. */
export function filtrarDocumentosPorBusca<T extends DocumentoBuscavel>(documentos: T[], busca: string): T[] {
  const termo = busca.trim().toLowerCase();
  if (!termo) return documentos;
  return documentos.filter((documento) => {
    const nomeContratante = documento.cliente?.razaoSocial ?? documento.cliente?.nomeFantasia ?? "";
    return documento.titulo.toLowerCase().includes(termo) || nomeContratante.toLowerCase().includes(termo);
  });
}
