export interface Documento {
  id: number
  titulo: string
  data_criacao: string
  url: string
  setor: string
  PastaArquivos: string
  tipo: string
  criado_por: string
  protecao: string
  ordem_manual: number
  status: string
}

export interface AcessosPop {
  setoresAcessiveis: string[]
  podeUpload: boolean
  podeGerenciar: boolean
  ehAdminUser: boolean
}

export type OrdemTipo = "PADRAO" | "recentes" | "az" | "za"
