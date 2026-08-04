"use client";

import { useEffect, useRef } from "react";
import { Crosshair, Monitor, Play, Volume2 } from "lucide-react";
import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";
import { tocarSomAberturaContainer } from "@/lib/apresentacoes/container-carga-audio";
import { useEditorStore } from "../../store/useEditorStore";

interface ContainerCargaPropsProps {
  componente: ContainerCargaComponente;
  onChange: (patch: Partial<ContainerCargaComponente>) => void;
  modo?: "componente" | "entrada";
  idPrefix?: string;
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ id, label, value, onChange }: ColorFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] text-slate-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-slate-900 p-1"
        />
        <code className="min-w-0 flex-1 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          {value.toUpperCase()}
        </code>
      </div>
    </div>
  );
}

export function ContainerCargaProps({
  componente,
  onChange,
  modo = "componente",
  idPrefix = "container-carga",
}: ContainerCargaPropsProps) {
  const pararPreviewRef = useRef<(() => void) | null>(null);
  const canvas = useEditorStore((state) => state.canvas);
  const ehEntrada = modo === "entrada";
  const campoId = (sufixo: string) => `${idPrefix}-${sufixo}`;

  useEffect(() => () => pararPreviewRef.current?.(), []);

  function centralizar() {
    onChange({
      x: (canvas.width - componente.w) / 2,
      y: (canvas.height - componente.h) / 2,
    });
  }

  function aplicarFormato16x9() {
    let altura = Math.min(componente.h, canvas.height);
    let largura = altura * (16 / 9);
    if (largura > canvas.width) {
      largura = canvas.width;
      altura = largura * (9 / 16);
    }
    onChange({
      w: largura,
      h: altura,
      x: (canvas.width - largura) / 2,
      y: (canvas.height - altura) / 2,
    });
  }

  function ouvirPreview() {
    pararPreviewRef.current?.();
    pararPreviewRef.current = tocarSomAberturaContainer(componente.somAbertura, componente.volumeSom);
  }

  return (
    <>
      {!ehEntrada && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={centralizar}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Crosshair size={15} aria-hidden="true" />
            Centralizar
          </button>
          <button
            type="button"
            onClick={aplicarFormato16x9}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Monitor size={15} aria-hidden="true" />
            Aplicar 16:9
          </button>
        </div>
      )}

      <ColorField id={campoId("cor-principal")} label="Cor do container" value={componente.corPrincipal} onChange={(corPrincipal) => onChange({ corPrincipal })} />
      <ColorField id={campoId("cor-metal")} label="Cor das travas" value={componente.corMetal} onChange={(corMetal) => onChange({ corMetal })} />
      <ColorField id={campoId("cor-interior")} label="Cor do interior" value={componente.corInterior} onChange={(corInterior) => onChange({ corInterior })} />

      <div className="space-y-1.5">
        <label htmlFor={campoId("angulo")} className="text-[11px] text-slate-400">Ângulo de abertura</label>
        <input
          id={campoId("angulo")}
          type="number"
          min={45}
          max={120}
          value={componente.anguloAbertura}
          onChange={(event) => onChange({ anguloAbertura: Number(event.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label htmlFor={campoId("atraso")} className="text-[11px] text-slate-400">Atraso (s)</label>
          <input
            id={campoId("atraso")}
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={componente.atrasoAbertura}
            onChange={(event) => onChange({ atrasoAbertura: Number(event.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={campoId("duracao")} className="text-[11px] text-slate-400">Duração (s)</label>
          <input
            id={campoId("duracao")}
            type="number"
            min={0.2}
            max={10}
            step={0.1}
            value={componente.duracaoAbertura}
            onChange={(event) => onChange({ duracaoAbertura: Number(event.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="h-px bg-white/5" />

      {!ehEntrada && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <label htmlFor={campoId("transicao")} className="text-[11px] text-slate-300">Transição pelo interior</label>
            <p className="text-[10px] text-slate-500">Inicia o próximo slide durante o zoom.</p>
          </div>
          <input
            id={campoId("transicao")}
            type="checkbox"
            checked={componente.transicaoProximoSlide}
            onChange={(event) => onChange({ transicaoProximoSlide: event.target.checked })}
            className="h-4 w-4 shrink-0 accent-indigo-500"
          />
        </div>
      )}

      {(ehEntrada || componente.transicaoProximoSlide) && (
        <div className="space-y-1.5">
          <label htmlFor={campoId("duracao-zoom")} className="text-[11px] text-slate-400">Duração do zoom (s)</label>
          <input
            id={campoId("duracao-zoom")}
            type="number"
            min={0.3}
            max={5}
            step={0.1}
            value={componente.duracaoZoom}
            onChange={(event) => onChange({ duracaoZoom: Number(event.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      )}

      <div className="h-px bg-white/5" />

      <div className="flex items-center justify-between gap-3">
        <label htmlFor={campoId("som")} className="flex items-center gap-2 text-[11px] text-slate-300">
          <Volume2 size={14} aria-hidden="true" />
          Som de abertura
        </label>
        <input
          id={campoId("som")}
          type="checkbox"
          checked={componente.somHabilitado}
          onChange={(event) => onChange({ somHabilitado: event.target.checked })}
          className="h-4 w-4 accent-indigo-500"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select
          aria-label="Som de exemplo do container"
          value={componente.somAbertura}
          onChange={(event) => onChange({ somAbertura: event.target.value as ContainerCargaComponente["somAbertura"] })}
          className="min-w-0 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
        >
          <option value="industrial">Industrial metálico</option>
          <option value="hidraulico">Hidráulico suave</option>
        </select>
        <button
          type="button"
          onClick={ouvirPreview}
          aria-label="Ouvir prévia do som selecionado"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Play size={13} aria-hidden="true" />
          Ouvir
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <label htmlFor={campoId("volume")}>Volume</label>
          <span>{Math.round(componente.volumeSom * 100)}%</span>
        </div>
        <input
          id={campoId("volume")}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={componente.volumeSom}
          onChange={(event) => onChange({ volumeSom: Number(event.target.value) })}
          className="w-full accent-indigo-500"
        />
      </div>

      {!ehEntrada && (
        <div className="space-y-1.5">
          <label htmlFor={campoId("estado-editor")} className="text-[11px] text-slate-400">Pré-visualização no editor</label>
          <select
            id={campoId("estado-editor")}
            value={componente.estadoEditor}
            onChange={(event) => onChange({ estadoEditor: event.target.value as ContainerCargaComponente["estadoEditor"] })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="fechado">Fechado</option>
            <option value="aberto">Aberto</option>
          </select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label htmlFor={campoId("logo")} className="text-[11px] text-slate-400">Mostrar marca Alpha</label>
        <input
          id={campoId("logo")}
          type="checkbox"
          checked={componente.mostrarLogo}
          onChange={(event) => onChange({ mostrarLogo: event.target.checked })}
          className="h-4 w-4 accent-indigo-500"
        />
      </div>

      <p className="rounded-lg border border-white/5 bg-slate-900/60 p-2 text-[10px] leading-relaxed text-slate-500">
        {ehEntrada
          ? "A prévia acima mostra somente o container fechado. Ao apresentar, ele funciona como capa e revela o slide 1 durante o zoom."
          : "Na apresentação, o container abre automaticamente. O navegador pode exigir um clique para liberar o áudio."}
      </p>
    </>
  );
}
