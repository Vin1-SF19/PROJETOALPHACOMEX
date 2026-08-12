export interface NotaComPreview {
  id: string;
  title: string;
  plainText?: string;
  updatedAt: Date | string;
}

export interface AtualizacaoPreviewNota {
  noteId: string;
  title: string;
  plainText: string;
}

export function atualizarPreviewNaLista<T extends NotaComPreview>(
  notas: T[],
  atualizacao: AtualizacaoPreviewNota,
  updatedAt: Date = new Date(),
): T[] {
  return notas.map((nota) =>
    nota.id === atualizacao.noteId
      ? {
          ...nota,
          title: atualizacao.title,
          plainText: atualizacao.plainText,
          updatedAt,
        }
      : nota,
  );
}

