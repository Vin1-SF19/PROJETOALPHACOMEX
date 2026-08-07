import { Link2 } from "lucide-react";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

interface SharedElementIdInputProps {
  componente: ComponenteSlide;
  onChange: (patch: Partial<ComponenteSlide>) => void;
}

/**
 * Fase 06 (Alpha Motion) — campo para configurar `sharedElementId`, usado pelo Morph
 * (Fase 06) para identificar o mesmo elemento entre slides consecutivos. Campo simples de
 * texto — o usuário escolhe um identificador livre (ex: "logo-empresa", "foto-produto") e
 * repete o mesmo valor no elemento correspondente do próximo slide.
 */
export function SharedElementIdInput({ componente, onChange }: SharedElementIdInputProps) {
  return (
    <div className="space-y-1.5 border-t border-white/5 pt-4">
      <label htmlFor={`shared-element-id-${componente.id}`} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <Link2 size={11} aria-hidden="true" /> Elemento Compartilhado (Morph)
      </label>
      <input
        id={`shared-element-id-${componente.id}`}
        type="text"
        placeholder="ex: logo-empresa"
        value={componente.sharedElementId ?? ""}
        onChange={(e) => onChange({ sharedElementId: e.target.value.trim() || null })}
        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
      />
      <p className="text-[10px] text-slate-600">
        Use o mesmo valor em um elemento do próximo slide para animá-los como Morph.
      </p>
    </div>
  );
}
