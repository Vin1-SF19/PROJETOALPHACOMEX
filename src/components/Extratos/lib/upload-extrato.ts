export const TAMANHO_MAXIMO_EXTRATO = 20 * 1024 * 1024;

export interface ArquivoExtratoValidavel {
  name: string;
  size: number;
  type?: string;
  lastModified?: number;
}

export interface ResultadoValidacaoArquivos<T extends ArquivoExtratoValidavel> {
  validos: T[];
  erros: string[];
}

function chaveArquivo(arquivo: ArquivoExtratoValidavel): string {
  return `${arquivo.name.toLowerCase()}::${arquivo.size}::${arquivo.lastModified ?? 0}`;
}

function extensaoAceita(nome: string): boolean {
  const nomeNormalizado = nome.trim().toLowerCase();
  return nomeNormalizado.endsWith(".pdf") || nomeNormalizado.endsWith(".docx");
}

export function validarArquivosExtrato<T extends ArquivoExtratoValidavel>(
  candidatos: readonly T[],
  existentes: readonly ArquivoExtratoValidavel[] = [],
): ResultadoValidacaoArquivos<T> {
  const chavesConhecidas = new Set(existentes.map(chaveArquivo));
  const validos: T[] = [];
  const erros: string[] = [];

  candidatos.forEach((arquivo) => {
    const chave = chaveArquivo(arquivo);

    if (!extensaoAceita(arquivo.name)) {
      erros.push(`${arquivo.name}: formato não suportado. Use PDF ou DOCX.`);
      return;
    }

    if (arquivo.size > TAMANHO_MAXIMO_EXTRATO) {
      erros.push(`${arquivo.name}: excede o limite de 20 MB.`);
      return;
    }

    if (arquivo.size <= 0) {
      erros.push(`${arquivo.name}: o arquivo está vazio.`);
      return;
    }

    if (chavesConhecidas.has(chave)) {
      erros.push(`${arquivo.name}: arquivo duplicado.`);
      return;
    }

    chavesConhecidas.add(chave);
    validos.push(arquivo);
  });

  return { validos, erros };
}
