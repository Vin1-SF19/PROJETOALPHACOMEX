export {
  ErroMesclagem,
  LIMITE_ARQUIVO_MESCLAGEM_BYTES,
  LIMITE_LINHAS_MESCLAGEM,
  carregarWorkbookXlsx,
  extensaoDoArquivo,
  inspecionarWorkbook,
  lerLinhasWorkbook,
  parseCsvTexto,
  validarExtensaoMesclagem,
  validarTamanhoArquivo,
} from "./parsing";

export {
  CAMPOS_DESTINO_MESCLAGEM,
  CAMPOS_DESTINO_MESCLAGEM_SET,
  campoDestinoMesclagemSchema,
  criarMapeamentoInicial,
  EXTENSOES_MESCLAGEM,
  LIMITE_CELULAS_MESCLAGEM,
  LIMITE_COLUNAS_MESCLAGEM,
  type CampoDestinoMesclagem,
  type ExtensaoMesclagem,
} from "./catalogo";

export { classificarCnpj, extrairDigitos, normalizarCnpjMesclagem, type RecuperacaoCnpj } from "./cnpj";

export {
  diagnosticarCnjs,
  LIMITE_LINHAS_RESULTADO_MESCLAGEM,
  LIMITE_MULTIPLICIDADE_CNPJ_MESCLAGEM,
  mapearCamposAutomaticos,
  mesclarPlanilhas,
  normalizarCabecalho,
} from "./mesclador";
export { obterTimeoutMapeamentoIa, obterUrlIaLocal, sugerirCamposComFallbackLocal } from "./mapeamento-ia";

export {
  NOME_TEMPLATE_MESCLAGEM,
  caminhoTemplateMesclagem,
  gerarTemplateMesclagem,
  gerarXlsxMesclagem,
  lerTemplateMesclagem,
} from "./template";

export {
  criarPreviaMesclagem,
  inspecionarArquivoMesclagem,
  LIMITE_LINHAS_PREVIA,
  processarMesclagem,
  sugerirMapeamentoMesclagem,
  validarMapeamentoMesclagem,
} from "./processamento";

export type {
  AbaPlanilha,
  CampoMapeamento,
  ColunaPlanilha,
  DiagnosticoCnpj,
  InspecaoPlanilha,
  LinhaMesclada,
  ResultadoMesclagem,
  ResumoMesclagem,
  PreviaMesclagem,
  StatusCnpj,
  SugestaoMapeamento,
  ObservabilidadeMapeamentoIa,
  TipoArquivoMesclagem,
} from "./tipos";
