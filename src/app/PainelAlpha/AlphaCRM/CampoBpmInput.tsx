"use client";

import { useState } from "react";
import { toast, type ExternalToast } from "sonner";
import { cn } from "@/lib/utils";
import { campoBpmEhCnpj } from "@/lib/bpm/campos-dinamicos";
import { formatarCNPJProgressivo, normalizarCNPJ } from "@/lib/format-cnpj";
import { RegistrarAnexoBpm } from "@/actions/bpm/Anexos";
import { VisualizadorAnexoCard, type AnexoParaVisualizar } from "@/components/bpm/anexos/VisualizadorAnexoCard";

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
  errorToastOptions?: Pick<ExternalToast, "duration" | "closeButton">;
  arquivoAtual?: { id: string; nome: string; url: string; tipo?: string | null } | null;
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

function lerListaEmails(valor: string): string[] {
  if (!valor) return [""];
  try {
    const emails: unknown = JSON.parse(valor);
    if (Array.isArray(emails)) {
      const validos = emails.filter((email): email is string => typeof email === "string");
      return validos.length ? validos : [""];
    }
  } catch { /* valor legado ou malformado é apresentado como uma linha editável */ }
  return [valor];
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
  errorToastOptions,
  arquivoAtual,
  registerFileSave,
  onFileConfirmed,
}: CampoBpmInputProps) {
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [anexoSelecionado, setAnexoSelecionado] = useState<AnexoParaVisualizar | null>(null);
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
                toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo", errorToastOptions);
                return false;
              }
            };
            if (registerFileSave) await registerFileSave(enviar); else await enviar();
            inputArquivo.value = "";
            setEnviandoArquivo(false);
          }}
        />
        {value.startsWith("https://") ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[11px] text-emerald-300 hover:underline"
          >
            Abrir link do contrato
          </a>
        ) : value ? (
          <button type="button" onClick={() => setAnexoSelecionado({ id: arquivoAtual?.id ?? value, nome: arquivoAtual?.nome ?? "Arquivo vinculado", tipo: arquivoAtual?.tipo ?? null })} className="block max-w-full truncate text-left text-[11px] text-emerald-300 hover:underline">
            {arquivoAtual?.nome ?? "Abrir arquivo vinculado"}
          </button>
        ) : null}
        <VisualizadorAnexoCard anexo={anexoSelecionado} onClose={() => setAnexoSelecionado(null)} />
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

  if (campo.tipo === "lista_email") {
    const emails = lerListaEmails(value);
    const atualizar = (proximos: string[]) => onChange(JSON.stringify(proximos));
    return (
      <div id={`campo-bpm-${campo.id}`} role="group" aria-describedby={describedBy} className="space-y-2">
        {emails.map((email, indice) => (
          <div key={indice} className="flex items-center gap-2">
            <input
              className={className}
              type="email"
              aria-label={`${campo.nome} ${indice + 1}`}
              aria-invalid={invalid || undefined}
              value={email}
              disabled={bloqueado}
              placeholder="email@exemplo.com"
              onChange={(event) => atualizar(emails.map((atual, posicao) => posicao === indice ? event.target.value : atual))}
              onBlur={onBlur}
            />
            <button
              type="button"
              disabled={bloqueado || emails.length === 1}
              aria-label={`Remover e-mail ${indice + 1}`}
              onClick={() => { atualizar(emails.filter((_, posicao) => posicao !== indice)); onBlur?.(); }}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-red-400/20 text-red-300 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden="true">−</span>
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={bloqueado}
          onClick={() => atualizar([...emails, ""])}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-cyan-400/20 px-3 text-xs font-medium text-cyan-200 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true">+</span> Adicionar e-mail
        </button>
      </div>
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
