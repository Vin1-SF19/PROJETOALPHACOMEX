import type {
  PrevisualizacaoImportacao,
  RespostaApi,
  ResumoImportacaoSalva,
  TipoImportacao,
  LinhaSalvarImportacao,
} from "@/lib/cs-nps/importacao-tipos";

const NOME_MODELO_PADRAO = "modelo-importacao-cs-nps.xlsx";

function nomeArquivoResposta(contentDisposition: string | null): string {
  const encontrado = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    ?? contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1];

  if (!encontrado) return NOME_MODELO_PADRAO;

  try {
    return decodeURIComponent(encontrado).replace(/[\\/:*?"<>|]/g, "-");
  } catch {
    return NOME_MODELO_PADRAO;
  }
}

async function lerResposta<T>(response: Response): Promise<RespostaApi<T>> {
  const corpo: unknown = await response.json();
  if (typeof corpo !== "object" || corpo === null || !("success" in corpo)) {
    return { success: false, error: "O servidor retornou uma resposta inesperada." };
  }
  return corpo as RespostaApi<T>;
}

export async function baixarModeloImportacao(tipos: TipoImportacao[]): Promise<void> {
  const response = await fetch(`/api/cs-nps/importar/modelo?tipos=${encodeURIComponent(tipos.join(","))}`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const resultado = await lerResposta<never>(response);
    throw new Error(resultado.success ? "Não foi possível baixar o modelo." : resultado.error);
  }

  const arquivo = await response.blob();
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivoResposta(response.headers.get("content-disposition"));
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function previsualizarImportacao(
  arquivo: File,
  tipos: TipoImportacao[],
): Promise<PrevisualizacaoImportacao> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  formData.append("tipos", JSON.stringify(tipos));

  const response = await fetch("/api/cs-nps/importar/previsualizar", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });
  const resultado = await lerResposta<PrevisualizacaoImportacao>(response);
  if (!response.ok || !resultado.success) {
    throw new Error(resultado.success ? "Não foi possível analisar a planilha." : resultado.error);
  }
  return resultado.data;
}

export async function salvarImportacao(
  linhas: LinhaSalvarImportacao[],
): Promise<ResumoImportacaoSalva> {
  const response = await fetch("/api/cs-nps/importar/salvar", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ linhas }),
  });
  const resultado = await lerResposta<{ resumo: ResumoImportacaoSalva }>(response);
  if (!response.ok || !resultado.success) {
    throw new Error(resultado.success ? "Não foi possível salvar a importação." : resultado.error);
  }
  return resultado.data.resumo;
}

