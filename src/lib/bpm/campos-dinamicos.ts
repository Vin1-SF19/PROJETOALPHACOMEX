export type CampoDinamicoBpm = {
  id: string;
  nome: string;
  tipo: string;
  opcoesJson: string | null;
};

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
    const valor = valorOriginal.trim();
    if (!valor) {
      validados[campoId] = "";
      continue;
    }

    if (campo.tipo === "texto" || campo.tipo === "texto_longo") {
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
    if (campo.tipo === "numero") {
      const numero = Number(valor);
      if (!Number.isFinite(numero)) {
        return { success: false, error: `O campo "${campo.nome}" deve ser numérico.` };
      }
      validados[campoId] = valor;
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

    return { success: false, error: `O campo "${campo.nome}" possui tipo inválido.` };
  }

  return { success: true, valores: validados };
}
