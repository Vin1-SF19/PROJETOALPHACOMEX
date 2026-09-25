"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  fonteEntidade?: string | null;
  fonteAtributo?: string | null;
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
  arquivoAtual?: { id: string; nome: string; url: string } | null;
  registerFileSave?: (save: () => Promise<boolean>) => Promise<boolean>;
  onFileConfirmed?: (arquivo: { id: string; nome: string; url: string }) => void;
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

function dataHoraParaInput(valor: string): string {
  if (!valor) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  const parte = (numero: number) => String(numero).padStart(2, "0");
  return `${data.getFullYear()}-${parte(data.getMonth() + 1)}-${parte(data.getDate())}T${parte(data.getHours())}:${parte(data.getMinutes())}`;
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
  arquivoAtual,
  registerFileSave,
  onFileConfirmed,
}: CampoBpmInputProps) {
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const bloqueado = disabled || readOnly;
  const opcoes = campo.tipo === "booleano"
    ? ["Sim", "Não"]
    : lerOpcoes(campo.opcoesJson);

  if ((campo.tipo === "selecao" || campo.tipo === "multiselecao") && campo.fonteEntidade) {
    return (
      <input
        id={`campo-bpm-${campo.id}`}
        className={className}
        type="text"
        value={value}
        disabled={disabled}
        readOnly
        aria-readonly="true"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        title={`Valor canônico de ${campo.fonteEntidade}.${campo.fonteAtributo ?? "atributo"}`}
      />
    );
  }

  if (campo.tipo === "selecao" || campo.tipo === "booleano") {
    return (
      <select
        id={`campo-bpm-${campo.id}`}
        className={cn(className, "bg-slate-900 text-slate-100")}
        required={campo.obrigatorio}
        aria-required={campo.obrigatorio}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        disabled={bloqueado}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      >
        <option value="" className="bg-slate-900 text-slate-100">
          Selecione...
        </option>
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao} className="bg-slate-900 text-slate-100">
            {opcao}
          </option>
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
      <div
        id={`campo-bpm-${campo.id}`}
        role="group"
        aria-describedby={describedBy}
        data-invalid={invalid || undefined}
        className="flex flex-wrap gap-1.5"
      >
        {opcoes.map((opcao) => {
          const ativo = selecionadas.includes(opcao);
          return (
            <button
              key={opcao}
              type="button"
              disabled={bloqueado}
              aria-pressed={ativo}
              onClick={() => {
                const proximas = ativo
                  ? selecionadas.filter((item) => item !== opcao)
                  : [...selecionadas, opcao];
                onChange(JSON.stringify(proximas));
                onBlur?.();
              }}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                ativo
                  ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]",
                bloqueado && "cursor-not-allowed opacity-50",
              )}
            >
              {ativo && <span className="mr-1 font-bold">✓</span>}
              {opcao}
            </button>
          );
        })}
      </div>
    );
  }

  if (campo.tipo === "arquivo" || campo.tipo === "url_ou_arquivo") {
    return (
      <div className="space-y-1">
        {campo.tipo === "url_ou_arquivo" && (
          <input
            id={`campo-bpm-${campo.id}`}
            className={className}
            type="url"
            placeholder="https://... ou envie um arquivo abaixo"
            value={value.startsWith("https://") ? value : ""}
            disabled={bloqueado}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
          />
        )}
        <input
          id={campo.tipo === "arquivo" ? `campo-bpm-${campo.id}` : undefined}
          className={className}
          type="file"
          disabled={bloqueado || enviandoArquivo || !cardId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={async (event) => {
            const inputArquivo = event.currentTarget;
            const file = event.target.files?.[0];
            if (!file || !cardId) return;
            setEnviandoArquivo(true);
            const resultadoEnvio: {
              confirmado: { id: string; nome: string; url: string } | null;
            } = { confirmado: null };
            const enviar = async () => {
              try {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("cardId", cardId);
              const resposta = await fetch("/api/bpm/upload", { method: "POST", body: formData });
              const upload = await resposta.json();
              if (!resposta.ok || !upload.success) throw new Error(upload.error ?? "Falha no upload");
              const registro = await RegistrarAnexoBpm({ cardId, campoId: campo.id, recibo: upload.file.recibo });
              if (!registro.success || !registro.data) throw new Error(typeof registro.error === "string" ? registro.error : "Falha ao registrar arquivo");
              resultadoEnvio.confirmado = { id: registro.data.id, nome: registro.data.nome, url: registro.data.url };
              if (onFileConfirmed) onFileConfirmed(resultadoEnvio.confirmado);
              else onChange(resultadoEnvio.confirmado.id);
              toast.success("Arquivo vinculado ao campo");
              return true;
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo");
                return false;
              }
            };
            if (registerFileSave) await registerFileSave(enviar); else await enviar();
            inputArquivo.value = "";
            setEnviandoArquivo(false);
          }}
        />
        {value && (
          <a
            href={value.startsWith("https://") ? value : arquivoAtual?.url ?? `/api/bpm/anexos/${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[11px] text-emerald-300 hover:underline"
          >
            {value.startsWith("https://") ? "Abrir link do contrato" : arquivoAtual?.nome ?? "Abrir arquivo vinculado"}
          </a>
        )}
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
    <>
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
      min={campo.tipo === "percentual" ? 0 : undefined}
      max={campo.tipo === "percentual" ? 100 : undefined}
      inputMode={["cpf", "telefone"].includes(campo.tipo) ? "numeric" : undefined}
      maxLength={campo.tipo === "cpf" ? 14 : undefined}
      value={campo.tipo === "data_hora" ? dataHoraParaInput(value) : value}
      disabled={bloqueado}
      onChange={(event) => {
        const proximo = event.target.value;
        if (campo.tipo === "percentual" && proximo !== "") {
          const numero = Number(proximo);
          if (!Number.isFinite(numero) || numero < 0 || numero > 100) return;
        }
        onChange(campo.tipo === "data_hora" && proximo ? new Date(proximo).toISOString() : proximo);
      }}
      onBlur={onBlur}
    />
    {campo.tipo === "data_hora" && /^\d{4}-\d{2}-\d{2}$/.test(value) && (
      <small>Registro anterior: {value}, sem horário. Informe a hora do envio para atualizar.</small>
    )}
    </>
  );
}
