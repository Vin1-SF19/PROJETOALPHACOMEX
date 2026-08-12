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

    if (campo.tipo === "texto") {
      validados[campoId] = valor;
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
