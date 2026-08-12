"use client";

export interface CampoBpmEditavel {
  id: string;
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  opcoesJson: string | null;
}

interface CampoBpmInputProps {
  campo: CampoBpmEditavel;
  value: string;
  onChange: (value: string) => void;
  className: string;
  disabled?: boolean;
}

function lerOpcoes(opcoesJson: string | null): string[] {
  if (!opcoesJson) return [];
  try {
    const opcoes: unknown = JSON.parse(opcoesJson);
    return Array.isArray(opcoes)
      ? opcoes.filter((opcao): opcao is string => typeof opcao === "string")
      : [];
  } catch {
    return [];
  }
}

export function CampoBpmInput({ campo, value, onChange, className, disabled = false }: CampoBpmInputProps) {
  const opcoes = campo.tipo === "booleano"
    ? ["Sim", "Não"]
    : lerOpcoes(campo.opcoesJson);

  if (campo.tipo === "selecao" || campo.tipo === "booleano") {
    return (
      <select
        id={`campo-bpm-${campo.id}`}
        className={className}
        required={campo.obrigatorio}
        aria-required={campo.obrigatorio}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecione...</option>
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>{opcao}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={`campo-bpm-${campo.id}`}
      className={className}
      required={campo.obrigatorio}
      aria-required={campo.obrigatorio}
      type={campo.tipo === "numero" ? "number" : campo.tipo === "data" ? "date" : "text"}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
