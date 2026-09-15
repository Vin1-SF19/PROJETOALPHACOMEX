"use client";

import { Bot, ShieldCheck, X } from "lucide-react";
import {
  DEFAULT_ADAPTIVE_PREFERENCES,
  type AdaptiveTonePreferences,
  type AggressionReaction,
  type DetailPreference,
  type HumorLevel,
} from "@/lib/bibble/adaptive-style";

interface BibbleSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  temperature: number;
  onTemperatureChange: (v: number) => void;
  systemPrompt: string;
  onSystemPromptChange: (v: string) => void;
  ollamaUrl: string;
  onOllamaUrlChange: (url: string) => void;
  contextWindow: number;
  onContextWindowChange: (v: number) => void;
  computerAccess: boolean;
  onComputerAccessChange: (v: boolean) => void;
  adaptivePreferences: AdaptiveTonePreferences;
  onAdaptivePreferencesChange: (v: AdaptiveTonePreferences) => void;
  maxContextWindow?: number;
  approximateContextTokens?: number;
}


export default function BibbleSettingsPanel({
  open,
  onClose,
  adaptivePreferences,
  onAdaptivePreferencesChange,
}: BibbleSettingsPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Fechar configurações" />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-[440px] flex flex-col shadow-2xl" style={{ background: "#0d1526", borderLeft: "1px solid #1e2d4a" }} aria-label="Configurações do Bibble">
        <div className="shrink-0 flex items-center justify-between px-5 h-14 border-b" style={{ borderColor: "#1e2d4a" }}>
          <h2 className="text-sm font-bold text-[#f4f6fb]">Bibble</h2>
          <button onClick={onClose} aria-label="Fechar" className="w-8 h-8 grid place-items-center rounded-lg text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-5">
          <section className="rounded-xl p-4 space-y-2" style={{ background: "rgba(30,45,74,.45)", border: "1px solid #1e2d4a" }}>
            <div className="flex items-center gap-2 text-indigo-300"><Bot size={16} /><h3 className="text-xs font-bold uppercase tracking-wider">Identidade ativa</h3></div>
            <p className="text-sm font-semibold text-slate-100">Bibble · assistente do Painel Alpha</p>
            <p className="text-xs leading-relaxed text-slate-400">Modelo, provider, janela operacional e ferramentas são definidos e autorizados exclusivamente pelo servidor.</p>
          </section>
          <section className="rounded-xl p-4 space-y-2" style={{ background: "rgba(30,45,74,.45)", border: "1px solid #1e2d4a" }}>
            <div className="flex items-center gap-2 text-emerald-300"><ShieldCheck size={16} /><h3 className="text-xs font-bold uppercase tracking-wider">Capacidades seguras</h3></div>
            <p className="text-xs leading-relaxed text-slate-400">Somente consultas liberadas para seu perfil aparecem durante a conversa. Uploads, acesso a arquivos e ações mutáveis permanecem indisponíveis.</p>
          </section>
          <section className="rounded-xl p-4 space-y-4" style={{ background: "rgba(30,45,74,.45)", border: "1px solid #1e2d4a" }} aria-labelledby="adaptive-style-title">
            <div>
              <h3 id="adaptive-style-title" className="text-sm font-semibold text-slate-100">Personalidade adaptativa</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Ajusta forma e tom ao seu jeito de conversar, sem alterar fatos, permissões ou qualidade da execução.</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-medium text-slate-200">Tom adaptativo</p><p id="adaptive-tone-help" className="text-xs text-slate-500">Usa sinais compactos do seu histórico nativo.</p></div>
              <button type="button" role="switch" aria-label="Ativar tom adaptativo" aria-describedby="adaptive-tone-help" aria-checked={adaptivePreferences.adaptiveTone} onClick={() => onAdaptivePreferencesChange({ ...adaptivePreferences, adaptiveTone: !adaptivePreferences.adaptiveTone })} className="relative w-11 h-6 rounded-full shrink-0" style={{ background: adaptivePreferences.adaptiveTone ? "#6366f1" : "#1e2d4a" }}>
                <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: adaptivePreferences.adaptiveTone ? "translateX(20px)" : "translateX(0)" }} />
              </button>
            </div>

            <label className="block text-xs text-slate-400">
              <span className="block mb-1.5 font-medium text-slate-200">Humor</span>
              <select aria-label="Nível de humor" value={adaptivePreferences.humor} onChange={event => onAdaptivePreferencesChange({ ...adaptivePreferences, humor: event.target.value as HumorLevel })} className="w-full rounded-lg border border-[#2b3b5d] bg-[#111d33] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="off">Desligado</option><option value="light">Leve</option><option value="moderate">Moderado</option>
              </select>
            </label>

            <label className="block text-xs text-slate-400">
              <span className="block mb-1.5 font-medium text-slate-200">Reação à agressividade</span>
              <select aria-label="Reação à agressividade" value={adaptivePreferences.aggressionReaction} onChange={event => onAdaptivePreferencesChange({ ...adaptivePreferences, aggressionReaction: event.target.value as AggressionReaction })} className="w-full rounded-lg border border-[#2b3b5d] bg-[#111d33] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="neutral">Neutra</option><option value="firm">Firme</option>
              </select>
              <span className="mt-1 block text-slate-500">Firme permite uma alfinetada curta, mas o Bibble continua o pedido.</span>
            </label>

            <label className="block text-xs text-slate-400">
              <span className="block mb-1.5 font-medium text-slate-200">Nível de detalhe</span>
              <select aria-label="Nível de detalhe" value={adaptivePreferences.detail} onChange={event => onAdaptivePreferencesChange({ ...adaptivePreferences, detail: event.target.value as DetailPreference })} className="w-full rounded-lg border border-[#2b3b5d] bg-[#111d33] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="auto">Automático</option><option value="short">Curto</option><option value="detailed">Detalhado</option>
              </select>
            </label>

            <button type="button" onClick={() => onAdaptivePreferencesChange({ ...DEFAULT_ADAPTIVE_PREFERENCES })} className="text-xs font-medium text-indigo-300 hover:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1 py-1">
              Restaurar padrões de personalidade
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}
