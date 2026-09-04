import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";

export type CampoDinamicoBpm = {
  id: string;
  nome: string;
  tipo: string;
  opcoesJson: string | null;
  escopo?: string;
  fonteEntidade?: string | null;
  editavel?: boolean;
  somenteLeitura?: boolean;
};

function normalizarNomeCampo(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Detecção estrita de campo CNPJ: verdadeiro para o tipo dedicado `"cnpj"`
 * ou, por compatibilidade com campos legados digitados como texto livre,
 * quando o nome do campo é exatamente "CNPJ" (após trim/normalização de
 * acentos e caixa). Nomes aproximados (ex.: "Cartão CNPJ") não contam.
 */
export function campoBpmEhCnpj(campo: { tipo: string; nome: string }): boolean {
  if (campo.tipo === "cnpj") return true;
  return normalizarNomeCampo(campo.nome) === "cnpj";
}

export type ResultadoValidacaoCamposBpm =
  | { success: true; valores: Record<string, string> }
  | { success: false; error: string };

function lerOpcoesSeguras(campo: CampoDinamicoBpm): string[] | null {
  if (!campo.opcoesJson) return null;
  try {
    const opcoes: unknown = JSON.parse(campo.opcoesJson);
    if (
      !Array.isArray(opcoes)
      || !opcoes.every((opcao) => typeof opcao === "string" && opcao.trim())
    ) {
      return null;
    }
    return opcoes.map((opcao) => opcao.trim());
  } catch {
    return null;
  }
}

function cpfEhValido(valor: string): boolean {
  const cpf = valor.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((total, caractere, indice) => total + Number(caractere) * (pesoInicial - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return Number(cpf[9]) === digito(cpf.slice(0, 9), 10)
    && Number(cpf[10]) === digito(cpf.slice(0, 10), 11);
}

export function validarValoresCamposBpm(
  campos: readonly CampoDinamicoBpm[],
  valores: Readonly<Record<string, string>>,
): ResultadoValidacaoCamposBpm {
  const camposPorId = new Map(campos.map((campo) => [campo.id, campo]));
  const validados: Record<string, string> = {};

  for (const [campoId, valorOriginal] of Object.entries(valores)) {
    const campo = camposPorId.get(campoId);
    if (!campo) {
      return { success: false, error: "Um ou mais campos não pertencem a este contexto." };
    }
    if ((campo.escopo === "GLOBAL" && Boolean(campo.fonteEntidade)) || campo.somenteLeitura || campo.editavel === false) {
      return { success: false, error: `O campo "${campo.nome}" é somente leitura.` };
    }
    const valor = valorOriginal.trim();
    if (!valor) {
      validados[campoId] = "";
      continue;
    }

    if (campoBpmEhCnpj(campo)) {
      if (!cnpjEhValido(valor)) {
        return { success: false, error: `O campo "${campo.nome}" deve conter um CNPJ válido.` };
      }
      validados[campoId] = normalizarCNPJ(valor);
      continue;
    }
    if (["texto", "texto_longo", "arquivo", "relacionamento"].includes(campo.tipo)) {
      validados[campoId] = valor;
      continue;
    }
    if (campo.tipo === "cpf") {
      if (!cpfEhValido(valor)) {
        return { success: false, error: `O campo "${campo.nome}" deve conter um CPF válido.` };
      }
      validados[campoId] = valor.replace(/\D/g, "");
      continue;
    }
    if (["numero", "moeda", "percentual"].includes(campo.tipo)) {
      const normalizado = valor.replace(",", ".");
      const numero = Number(normalizado);
      if (!Number.isFinite(numero)) {
        return { success: false, error: `O campo "${campo.nome}" deve ser numérico.` };
      }
      if (campo.tipo === "percentual" && (numero < 0 || numero > 100)) {
        return { success: false, error: `O campo "${campo.nome}" deve estar entre 0 e 100%.` };
      }
      validados[campoId] = normalizado;
      continue;
    }
    if (campo.tipo === "data") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return { success: false, error: `O campo "${campo.nome}" deve conter uma data válida.` };
      }
      const data = new Date(`${valor}T00:00:00.000Z`);
      if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) {
        return { success: false, error: `O campo "${campo.nome}" deve conter uma data válida.` };
      }
      validados[campoId] = valor;
      continue;
    }
    if (campo.tipo === "booleano") {
      if (valor !== "Sim" && valor !== "Não") {
        return { success: false, error: `O campo "${campo.nome}" deve ser Sim ou Não.` };
      }
      validados[campoId] = valor;
      continue;
    }
    if (campo.tipo === "selecao") {
      const opcoes = lerOpcoesSeguras(campo);
      if (!opcoes || !opcoes.includes(valor)) {
        return { success: false, error: `O campo "${campo.nome}" possui uma opção inválida.` };
      }
      validados[campoId] = valor;
      continue;
    }
    if (campo.tipo === "multiselecao") {
      const opcoes = lerOpcoesSeguras(campo);
      let selecionadas: unknown;
      try { selecionadas = JSON.parse(valor); } catch { selecionadas = null; }
      if (!opcoes || !Array.isArray(selecionadas) || selecionadas.some((item) => typeof item !== "string" || !opcoes.includes(item))) {
        return { success: false, error: `O campo "${campo.nome}" possui uma opção inválida.` };
      }
      validados[campoId] = JSON.stringify([...new Set(selecionadas)]);
      continue;
    }
    if (campo.tipo === "data_hora") {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/.test(valor) || Number.isNaN(new Date(valor).getTime())) {
        return { success: false, error: `O campo "${campo.nome}" deve conter data e hora válidas.` };
      }
      validados[campoId] = valor;
      continue;
    }
    if (campo.tipo === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return { success: false, error: `O campo "${campo.nome}" deve conter um e-mail válido.` };
      validados[campoId] = valor.toLowerCase();
      continue;
    }
    if (campo.tipo === "url") {
      try { new URL(valor); } catch { return { success: false, error: `O campo "${campo.nome}" deve conter uma URL válida.` }; }
      validados[campoId] = valor;
      continue;
    }
    if (campo.tipo === "telefone") {
      const digitos = valor.replace(/\D/g, "");
      if (digitos.length < 10 || digitos.length > 15) return { success: false, error: `O campo "${campo.nome}" deve conter um telefone válido.` };
      validados[campoId] = digitos;
      continue;
    }
    if (campo.tipo === "usuario") {
      if (!/^\d+$/.test(valor)) return { success: false, error: `O campo "${campo.nome}" deve conter um usuário válido.` };
      validados[campoId] = valor;
      continue;
    }

    return { success: false, error: `O campo "${campo.nome}" possui tipo inválido.` };
  }

  return { success: true, valores: validados };
}
