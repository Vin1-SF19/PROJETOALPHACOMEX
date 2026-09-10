"use client";

import type { ReactNode } from "react";
import { AlertTriangle, FileWarning } from "lucide-react";

import type {
  ComponenteFormularioResolvido,
  FormularioEtapaResolvido,
} from "@/lib/bpm/formulario-renderer";

export type FormularioEtapaRendererBindings = {
  renderCampos: (params: {
    campoIds: string[];
    secaoId: string;
    secaoTitulo: string;
    runKey: string;
  }) => ReactNode;
  renderComponente: (componente: ComponenteFormularioResolvido) => ReactNode;
};

function agruparComponentes(
  componentes: ComponenteFormularioResolvido[],
): Array<
  | { tipo: "CAMPOS"; key: string; campoIds: string[] }
  | { tipo: "COMPONENTE"; key: string; componente: ComponenteFormularioResolvido }
> {
  const grupos: Array<
    | { tipo: "CAMPOS"; key: string; campoIds: string[] }
    | { tipo: "COMPONENTE"; key: string; componente: ComponenteFormularioResolvido }
  > = [];
  for (const componente of componentes) {
    if (componente.tipo === "CAMPO" && componente.campoId && componente.valido) {
      if (!componente.visivel) continue;
      const anterior = grupos.at(-1);
      if (anterior?.tipo === "CAMPOS") {
        anterior.campoIds.push(componente.campoId);
      } else {
        grupos.push({ tipo: "CAMPOS", key: componente.id, campoIds: [componente.campoId] });
      }
      continue;
    }
    grupos.push({ tipo: "COMPONENTE", key: componente.id, componente });
  }
  return grupos;
}

/** Estrutura única consumida pelo card real e pelo preview administrativo. */
export function FormularioEtapaRenderer({
  formulario,
  bindings,
  mode,
}: {
  formulario: FormularioEtapaResolvido;
  bindings: FormularioEtapaRendererBindings;
  mode: "runtime" | "preview";
}) {
  if (formulario.status === "MISSING" || formulario.status === "INACTIVE") {
    return (
      <div
        role="status"
        data-form-renderer-mode={mode}
        className="rounded-2xl border border-dashed border-amber-300/25 bg-amber-300/[0.05] p-5 text-sm text-amber-100"
      >
        <FileWarning size={18} className="mb-2" aria-hidden="true" />
        {formulario.diagnosticos[0]?.message ?? "Formulário indisponível."}
      </div>
    );
  }

  return (
    <div data-form-renderer-mode={mode} className="space-y-4">
      {formulario.diagnosticos.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-3 text-xs text-amber-100">
          <AlertTriangle size={14} className="mr-1.5 inline" aria-hidden="true" />
          A composição possui {formulario.diagnosticos.length} item(ns) inválido(s). Eles foram isolados e não receberam fallback implícito.
        </div>
      )}
      {formulario.secoes.map((secao) => {
        const grupos = agruparComponentes(secao.componentes);
        return (
          <section key={secao.id} data-form-section={secao.chave} className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              {secao.titulo}
            </h2>
            {grupos.map((grupo) => {
              if (grupo.tipo === "CAMPOS") {
                return (
                  <div key={grupo.key} data-form-field-run={grupo.key}>
                    {bindings.renderCampos({
                      campoIds: grupo.campoIds,
                      secaoId: secao.id,
                      secaoTitulo: secao.titulo,
                      runKey: grupo.key,
                    })}
                  </div>
                );
              }
              if (!grupo.componente.valido) {
                return (
                  <div key={grupo.key} role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-3 text-xs text-rose-200">
                    Componente indisponível: {grupo.componente.motivo ?? "referência inválida"}
                  </div>
                );
              }
              return <div key={grupo.key} data-form-component={grupo.componente.rendererId ?? "unknown"}>{bindings.renderComponente(grupo.componente)}</div>;
            })}
          </section>
        );
      })}
      {formulario.secoes.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
          Este formulário não possui seções publicadas.
        </p>
      )}
    </div>
  );
}
