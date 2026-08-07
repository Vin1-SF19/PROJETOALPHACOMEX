export interface PassoTutorialModulo {
  id: string;
  seletor: string;
  titulo: string;
  descricao: string;
}

export interface ConfigTutorialModulo {
  modulo: string;
  versao: number;
  titulo: string;
  passos: readonly PassoTutorialModulo[];
}

export interface ArmazenamentoTutorial {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

function segmentoSeguro(valor: string | number): string {
  return String(valor).trim().toLocaleLowerCase("pt-BR").replace(/[^a-z0-9_-]+/g, "-");
}

export function criarChaveTutorialModulo(
  config: Pick<ConfigTutorialModulo, "modulo" | "versao">,
  usuarioId: number,
): string {
  return `painelalpha:guia-modulo:${segmentoSeguro(config.modulo)}:v${config.versao}:usuario:${segmentoSeguro(usuarioId)}`;
}

export function tutorialModuloFoiVisto(
  armazenamento: ArmazenamentoTutorial,
  config: Pick<ConfigTutorialModulo, "modulo" | "versao">,
  usuarioId: number,
): boolean {
  return armazenamento.getItem(criarChaveTutorialModulo(config, usuarioId)) === "concluido";
}

export function marcarTutorialModuloComoVisto(
  armazenamento: ArmazenamentoTutorial,
  config: Pick<ConfigTutorialModulo, "modulo" | "versao">,
  usuarioId: number,
): void {
  armazenamento.setItem(criarChaveTutorialModulo(config, usuarioId), "concluido");
}

export function filtrarPassosTutorialDisponiveis(
  passos: readonly PassoTutorialModulo[],
  raiz: Pick<Document, "querySelector">,
): PassoTutorialModulo[] {
  return passos.filter((passo) => raiz.querySelector(passo.seletor));
}
