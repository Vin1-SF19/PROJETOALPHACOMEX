"use client";

import { useState } from "react";
import { toast } from "sonner";
import { campoBpmEhCnpj } from "@/lib/bpm/campos-dinamicos";
import { formatarCNPJProgressivo, normalizarCNPJ } from "@/lib/format-cnpj";
import { RegistrarAnexoBpm } from "@/actions/bpm/Anexos";

export interface CampoBpmEditavel {
  id: string;
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  opcoesJson: string | null;
  escopo?: string;
  editavel?: boolean;
  somenteLeitura?: boolean;
}

interface CampoBpmInputProps {
  campo: CampoBpmEditavel;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
  cardId?: string;
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
  readOnly = false,
  invalid = false,
  describedBy,
  cardId,
}: CampoBpmInputProps) {
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const bloqueado = disabled || readOnly;
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
        disabled={bloqueado}
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

  if (campo.tipo === "multiselecao") {
    let selecionadas: string[] = [];
    try {
      const parsed: unknown = JSON.parse(value || "[]");
      if (Array.isArray(parsed)) selecionadas = parsed.filter((item): item is string => typeof item === "string");
    } catch { selecionadas = []; }
    return (
      <select
        id={`campo-bpm-${campo.id}`}
        className={className}
        multiple
        value={selecionadas}
        disabled={bloqueado}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(JSON.stringify(Array.from(event.currentTarget.selectedOptions, (option) => option.value)))}
        onBlur={onBlur}
      >
        {opcoes.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
      </select>
    );
  }

  if (campo.tipo === "arquivo") {
    return (
      <div className="space-y-1">
        <input
          id={`campo-bpm-${campo.id}`}
          className={className}
          type="file"
          disabled={bloqueado || enviandoArquivo || !cardId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || !cardId) return;
            setEnviandoArquivo(true);
            try {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("cardId", cardId);
              const resposta = await fetch("/api/bpm/upload", { method: "POST", body: formData });
              const upload = await resposta.json();
              if (!resposta.ok || !upload.success) throw new Error(upload.error ?? "Falha no upload");
              const registro = await RegistrarAnexoBpm({ cardId, campoId: campo.id, recibo: upload.file.recibo });
              if (!registro.success || !registro.data) throw new Error(typeof registro.error === "string" ? registro.error : "Falha ao registrar arquivo");
              onChange(registro.data.id);
              toast.success("Arquivo vinculado ao campo");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo");
            } finally {
              setEnviandoArquivo(false);
            }
          }}
        />
        {value && <p className="text-[10px] text-emerald-300">Arquivo vinculado</p>}
      </div>
    );
  }

  if (campoBpmEhCnpj(campo)) {
    return (
      <input
        id={`campo-bpm-${campo.id}`}
        className={className}
        required={campo.obrigatorio}
        aria-required={campo.obrigatorio}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        type="text"
        inputMode="numeric"
        placeholder="00.000.000/0000-00"
        maxLength={18}
        value={formatarCNPJProgressivo(value)}
        disabled={bloqueado}
        onChange={(event) => onChange(normalizarCNPJ(event.target.value))}
        onBlur={onBlur}
      />
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
        disabled={bloqueado}
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
      type={
        ["numero", "moeda", "percentual", "usuario"].includes(campo.tipo) ? "number"
          : campo.tipo === "data" ? "date"
            : campo.tipo === "data_hora" ? "datetime-local"
              : campo.tipo === "email" ? "email"
                : campo.tipo === "url" ? "url"
                  : campo.tipo === "telefone" ? "tel"
                    : "text"
      }
      step={["moeda", "percentual"].includes(campo.tipo) ? "0.01" : undefined}
      inputMode={["cpf", "telefone"].includes(campo.tipo) ? "numeric" : undefined}
      maxLength={campo.tipo === "cpf" ? 14 : undefined}
      value={value}
      disabled={bloqueado}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  );
}
