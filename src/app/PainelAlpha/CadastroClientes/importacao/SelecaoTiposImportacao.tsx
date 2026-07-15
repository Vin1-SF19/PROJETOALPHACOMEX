"use client";

import { CheckCircle2, Users, Headphones, MessageSquareText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TipoImportacao } from "@/lib/cs-nps/importacao-tipos";
import { cn } from "@/lib/utils";
import { OPCOES_IMPORTACAO } from "./constantes";

interface SelecaoTiposImportacaoProps {
  tipos: TipoImportacao[];
  onChange: (tipos: TipoImportacao[]) => void;
}

const ICONES = {
  socios: Users,
  cs: Headphones,
  feedbacks: MessageSquareText,
} satisfies Record<TipoImportacao, typeof Users>;

export function SelecaoTiposImportacao({ tipos, onChange }: SelecaoTiposImportacaoProps) {
  function alternar(tipo: TipoImportacao, marcado: boolean) {
    onChange(marcado ? [...tipos, tipo] : tipos.filter((item) => item !== tipo));
  }

  return (
    <section className="space-y-5" aria-labelledby="titulo-tipos-importacao">
      <div>
        <h3 id="titulo-tipos-importacao" className="text-lg font-black text-slate-100">
          O que você quer importar?
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Marque uma opção, uma combinação ou todas. O modelo será preparado somente com as abas escolhidas.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {OPCOES_IMPORTACAO.map(({ tipo, titulo, descricao }) => {
          const Icone = ICONES[tipo];
          const selecionado = tipos.includes(tipo);
          const id = `tipo-importacao-${tipo}`;

          return (
            <Label
              key={tipo}
              htmlFor={id}
              className={cn(
                "group relative cursor-pointer rounded-2xl border p-4 transition-all",
                selecionado
                  ? "border-indigo-400/50 bg-indigo-500/10 shadow-lg shadow-indigo-950/30"
                  : "border-white/10 bg-slate-900/50 hover:border-white/20 hover:bg-slate-900/80",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn("rounded-xl p-2", selecionado ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-800 text-slate-400")}>
                  <Icone className="size-5" aria-hidden="true" />
                </span>
                <Checkbox
                  id={id}
                  checked={selecionado}
                  onCheckedChange={(valor) => alternar(tipo, valor === true)}
                  aria-label={`Selecionar importação de ${titulo}`}
                  className="border-slate-600 data-[state=checked]:border-indigo-500 data-[state=checked]:bg-indigo-600"
                />
              </div>
              <span className="mt-4 flex items-center gap-2 text-sm font-black text-slate-100">
                {titulo}
                {selecionado && <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-400">{descricao}</span>
            </Label>
          );
        })}
      </div>

      <div className="rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3 text-xs leading-relaxed text-sky-200/80">
        Para localizar a empresa, cada linha pede apenas <strong>CNPJ ou razão social</strong>. Em Sócios, repita a empresa em uma nova linha para cada pessoa.
      </div>
    </section>
  );
}

