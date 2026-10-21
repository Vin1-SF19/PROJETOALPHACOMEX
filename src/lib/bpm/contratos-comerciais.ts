/** Client-safe presentation contracts; storage references never cross this boundary. */
export type TipoContratoComercial = "para_envio" | "assinado";
export type DocumentoContratacaoComercial = {
  id: string;
  nome: string;
  tipo: string;
  urlAcesso: string;
  origem: "CONTRATACAO";
  somenteLeitura: true;
};
export type SlotContratoComercial = {
  estado: "PENDENTE" | "DISPONIVEL";
  documento: DocumentoContratacaoComercial | null;
};
export type DocumentosContratacaoComercial = {
  paraEnvio: SlotContratoComercial;
  assinado: SlotContratoComercial;
};
