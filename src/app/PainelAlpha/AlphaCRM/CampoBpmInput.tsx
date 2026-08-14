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
  onBlur?: () => void;
  className: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
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

export function CampoBpmInput({
  campo,
  value,
  onChange,
  onBlur,
  className,
  disabled = false,
  invalid = false,
  describedBy,
}: CampoBpmInputProps) {
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
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      >
        <option value="">Selecione...</option>
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>{opcao}</option>
        ))}
      </select>
    );
  }

  if (campo.tipo === "texto_longo") {
    return (
      <textarea
        id={`campo-bpm-${campo.id}`}
        className={`${className} min-h-44 resize-y`}
        required={campo.obrigatorio}
        aria-required={campo.obrigatorio}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    );
  }

  return (
    <input
      id={`campo-bpm-${campo.id}`}
      className={className}
      required={campo.obrigatorio}
      aria-required={campo.obrigatorio}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      type={campo.tipo === "numero" ? "number" : campo.tipo === "data" ? "date" : "text"}
      inputMode={campo.tipo === "cpf" ? "numeric" : undefined}
      maxLength={campo.tipo === "cpf" ? 14 : undefined}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  );
}
