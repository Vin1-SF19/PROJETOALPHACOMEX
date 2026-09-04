import { normalizarCNPJ } from "@/lib/format-cnpj";

export const ATRIBUTOS_FONTE_CAMPO = {
  CLIENTE: ["id", "cnpj", "razaoSocial", "nomeFantasia", "uf", "municipio", "regimeTributario", "status"],
  CONTATO: ["id", "nome", "cpf", "celular", "email", "telefoneExtra", "vinculo", "cargo"],
  PARCEIRO: ["id", "documento", "nome", "nomeFantasia", "email", "telefone", "segmento", "ativo"],
  CONTRATO: ["id", "valorContrato", "formaPagamento", "servico", "status", "contratoUrl"],
  SERVICO: ["id", "nome"],
  PROCESSO: ["id", "status", "dataInicio", "dataProtocolo", "dataExito", "tentativas"],
  CARD: ["id", "servico", "tipoProcesso", "status", "responsavelId", "createdAt"],
} as const;

export type EntidadeFonteCampo = keyof typeof ATRIBUTOS_FONTE_CAMPO;
export type ModoMapeamentoCampo = "COPIAR" | "SINCRONIZAR" | "REFERENCIAR";

export interface MapeamentoCampo {
  campoOrigemId: string;
  campoDestinoId: string;
  modo: ModoMapeamentoCampo;
  ativo: boolean;
}

export function fonteCampoPermitida(entidade: string | null | undefined, atributo: string | null | undefined): boolean {
  if (!entidade || !atributo || !(entidade in ATRIBUTOS_FONTE_CAMPO)) return false;
  return (ATRIBUTOS_FONTE_CAMPO[entidade as EntidadeFonteCampo] as readonly string[]).includes(atributo);
}

export function chaveOpcaoCampo(rotulo: string): string {
  const base = rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return base || "opcao";
}

export function normalizarValorCampo(tipo: string, valor: string): string {
  const texto = valor.trim();
  if (!texto) return "";
  if (tipo === "cnpj") return normalizarCNPJ(texto);
  if (tipo === "cpf" || tipo === "telefone") return texto.replace(/\D/g, "");
  if (tipo === "numero" || tipo === "moeda" || tipo === "percentual") return texto.replace(",", ".");
  if (tipo === "booleano") return ["1", "true", "sim"].includes(texto.toLowerCase()) ? "true" : "false";
  if (tipo === "multiselecao") {
    let itens: string[];
    try {
      const parsed: unknown = JSON.parse(texto);
      itens = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [texto];
    } catch {
      itens = texto.split(",");
    }
    return JSON.stringify([...new Set(itens.map((item) => item.trim()).filter(Boolean))]);
  }
  return texto;
}

export function erroValorCampo(tipo: string, valor: string, opcoes: readonly string[] = []): string | null {
  if (!valor) return null;
  if (["numero", "moeda", "percentual"].includes(tipo) && !Number.isFinite(Number(valor))) return "Valor numérico inválido";
  if (tipo === "percentual" && (Number(valor) < 0 || Number(valor) > 100)) return "Percentual deve estar entre 0 e 100";
  if (tipo === "cnpj" && normalizarCNPJ(valor).length !== 14) return "CNPJ inválido";
  if (tipo === "cpf" && valor.replace(/\D/g, "").length !== 11) return "CPF inválido";
  if (tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return "E-mail inválido";
  if (tipo === "url") {
    try { new URL(valor); } catch { return "URL inválida"; }
  }
  if (tipo === "selecao" && opcoes.length > 0 && !opcoes.includes(valor)) return "Opção inválida";
  if (tipo === "multiselecao" && opcoes.length > 0) {
    try {
      const itens: unknown = JSON.parse(valor);
      if (!Array.isArray(itens) || itens.some((item) => typeof item !== "string" || !opcoes.includes(item))) return "Opção inválida";
    } catch { return "Seleção múltipla inválida"; }
  }
  return null;
}

export function mapeamentoCriariaCiclo(mapeamentos: readonly MapeamentoCampo[], candidato: MapeamentoCampo): boolean {
  const arestas = new Map<string, string[]>();
  for (const item of [...mapeamentos.filter((item) => item.ativo && item.campoDestinoId !== candidato.campoDestinoId), candidato]) {
    if (!item.ativo) continue;
    const destinos = arestas.get(item.campoOrigemId) ?? [];
    destinos.push(item.campoDestinoId);
    arestas.set(item.campoOrigemId, destinos);
  }
  const visitando = new Set<string>();
  const visitados = new Set<string>();
  const visitar = (id: string): boolean => {
    if (visitando.has(id)) return true;
    if (visitados.has(id)) return false;
    visitando.add(id);
    for (const destino of arestas.get(id) ?? []) if (visitar(destino)) return true;
    visitando.delete(id);
    visitados.add(id);
    return false;
  };
  return [...arestas.keys()].some(visitar);
}

export function resolverMapeamentosCampo({
  valores,
  valoresCanonicos = {},
  mapeamentos,
}: {
  valores: Readonly<Record<string, string>>;
  valoresCanonicos?: Readonly<Record<string, string>>;
  mapeamentos: readonly MapeamentoCampo[];
}) {
  const efetivos: Record<string, string> = { ...valores };
  const snapshots: Record<string, string> = {};
  const somenteLeitura = new Set<string>();
  const pendentes = mapeamentos.filter((item) => item.ativo);

  for (let rodada = 0; rodada <= pendentes.length; rodada += 1) {
    let alterou = false;
    for (const item of pendentes) {
      const origem = valoresCanonicos[item.campoOrigemId] ?? efetivos[item.campoOrigemId] ?? "";
      if (item.modo === "COPIAR") {
        if (!efetivos[item.campoDestinoId] && origem) {
          efetivos[item.campoDestinoId] = origem;
          snapshots[item.campoDestinoId] = origem;
          alterou = true;
        }
        continue;
      }
      somenteLeitura.add(item.campoDestinoId);
      if (efetivos[item.campoDestinoId] !== origem) {
        efetivos[item.campoDestinoId] = origem;
        alterou = true;
      }
    }
    if (!alterou) break;
  }

  return { efetivos, snapshots, somenteLeitura };
}
