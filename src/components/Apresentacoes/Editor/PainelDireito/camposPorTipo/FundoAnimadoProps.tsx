"use client";

import { Crosshair } from "lucide-react";
import type { FundoAnimadoComponente } from "@/lib/validations/slide-componentes";
import { useEditorStore } from "../../store/useEditorStore";

const NOMES_ESTILO: Record<FundoAnimadoComponente["estilo"], string> = {
  cosmosIAlpha: "Cosmos IAlpha",
  radar: "Radar Sonar",
  estelar: "Estelar",
  blueprintTecnico: "Blueprint Técnico",
  auroraModulos: "Aurora dos Módulos",
};

const inputClass = "w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";
const HEX_VALIDO = /^#[0-9a-fA-F]{6}$/;

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}

/** Swatch nativo (`type="color"`) + campo de texto lado a lado — o usuário pode escolher vendo as cores OU continuar digitando o hex. */
function ColorField({ id, label, value, fallback, onChange }: ColorFieldProps) {
  const corSwatch = HEX_VALIDO.test(value) ? value : fallback;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] text-slate-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={corSwatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-slate-900 p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className={`${inputClass} min-w-0 flex-1`}
        />
      </div>
    </div>
  );
}

export function FundoAnimadoProps({ componente, onChange }: { componente: FundoAnimadoComponente; onChange: (patch: Partial<FundoAnimadoComponente>) => void }) {
  const canvas = useEditorStore((s) => s.canvas);
  const { estilo } = componente;
  const usaDensidade = estilo === "cosmosIAlpha" || estilo === "radar" || estilo === "estelar" || estilo === "blueprintTecnico";
  const usaCorSecundaria = estilo === "estelar" || estilo === "blueprintTecnico" || estilo === "auroraModulos";

  function centralizar() {
    onChange({
      x: (canvas.width - componente.w) / 2,
      y: (canvas.height - componente.h) / 2,
    });
  }

  return (
    <>
      <div className="rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-500">
        Estilo: <span className="font-semibold text-slate-300">{NOMES_ESTILO[estilo]}</span>
      </div>

      <button
        type="button"
        onClick={centralizar}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <Crosshair size={15} aria-hidden="true" />
        Centralizar
      </button>

      <ColorField id="fundo-cor-primaria" label="Cor primária" value={componente.corPrimaria} fallback="#4f46e5" onChange={(corPrimaria) => onChange({ corPrimaria })} />

      {usaCorSecundaria && (
        <ColorField id="fundo-cor-secundaria" label="Cor secundária" value={componente.corSecundaria} fallback="#0ea5e9" onChange={(corSecundaria) => onChange({ corSecundaria })} />
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Velocidade</label>
        <input
          type="number"
          min={0.1}
          max={5}
          step={0.1}
          value={componente.velocidade}
          onChange={(e) => onChange({ velocidade: Number(e.target.value) })}
          className={inputClass}
        />
      </div>

      {usaDensidade && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Densidade</label>
          <input
            type="number"
            min={0.2}
            max={3}
            step={0.1}
            value={componente.densidade}
            onChange={(e) => onChange({ densidade: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
      )}

      {estilo === "auroraModulos" && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Intensidade</label>
          <input
            type="number"
            min={0.1}
            max={2}
            step={0.1}
            value={componente.intensidade}
            onChange={(e) => onChange({ intensidade: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
      )}

      {estilo === "radar" && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Direção da varredura</label>
          <select
            value={componente.direcao}
            onChange={(e) => onChange({ direcao: e.target.value as FundoAnimadoComponente["direcao"] })}
            className={inputClass}
          >
            <option value="horario">Horário</option>
            <option value="antihorario">Anti-horário</option>
          </select>
        </div>
      )}

      {estilo === "cosmosIAlpha" && (
        <>
          <div className="flex items-center justify-between">
            <label htmlFor="fundo-mostrar-sol" className="text-[11px] text-slate-400">Mostrar sol</label>
            <input
              id="fundo-mostrar-sol"
              type="checkbox"
              checked={componente.mostrarSol}
              onChange={(e) => onChange({ mostrarSol: e.target.checked })}
              className="h-4 w-4 accent-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400">Quantidade de planetas</label>
            <input
              type="number"
              min={1}
              max={8}
              step={1}
              value={componente.quantidadePlanetas}
              onChange={(e) => onChange({ quantidadePlanetas: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </>
      )}

      {estilo === "blueprintTecnico" && (
        <div className="flex items-center justify-between">
          <label htmlFor="fundo-mostrar-grade" className="text-[11px] text-slate-400">Mostrar grade</label>
          <input
            id="fundo-mostrar-grade"
            type="checkbox"
            checked={componente.mostrarGrade}
            onChange={(e) => onChange({ mostrarGrade: e.target.checked })}
            className="h-4 w-4 accent-indigo-500"
          />
        </div>
      )}

      {estilo === "estelar" && (
        <div className="flex items-center justify-between">
          <label htmlFor="fundo-mostrar-relogio" className="text-[11px] text-slate-400">Mostrar relógio</label>
          <input
            id="fundo-mostrar-relogio"
            type="checkbox"
            checked={componente.mostrarRelogio}
            onChange={(e) => onChange({ mostrarRelogio: e.target.checked })}
            className="h-4 w-4 accent-indigo-500"
          />
        </div>
      )}
    </>
  );
}
