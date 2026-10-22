export function documentoDTO(d: {
  id: string;
  nome: string;
  uploadedByCliente: boolean;
  observacao: string | null;
  criadoEm: Date;
  deletadoEm: Date | null;
  deletadoPorCliente: boolean;
  uploadedByUsuarioId: number | null;
  uploadedByContaId: string | null;
  deletadoPorUsuarioId: number | null;
  deletadoPorContaId: string | null;
}) {
  return {
    id: d.id,
    nome: d.nome,
    url: `/api/checklist/documentos/${encodeURIComponent(d.id)}/download`,
    uploadedByCliente: d.uploadedByCliente,
    observacao: d.observacao,
    criadoEm: d.criadoEm,
    deletadoEm: d.deletadoEm,
    deletadoPorCliente: d.deletadoPorCliente,
    uploadedByUsuarioId: d.uploadedByUsuarioId,
    uploadedByContaId: d.uploadedByContaId,
    deletadoPorUsuarioId: d.deletadoPorUsuarioId,
    deletadoPorContaId: d.deletadoPorContaId,
  };
}
