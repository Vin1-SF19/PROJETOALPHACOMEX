"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X, Server, Thermometer, FileText, ShieldAlert, Check,
  Loader2, AlertTriangle, LayoutList, Lock, Plus, Trash2, Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

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
}

type TestStatus = "idle" | "testing" | "ok" | "error";
type CloudProvider = "openai" | "google" | "anthropic";

interface CloudModel {
  id: string;
  provider: CloudProvider;
  modelId: string;
  label: string;
  enabled: boolean;
}

const CTX_PRESETS = [
  { label: "2K",   value: 2048 },
  { label: "4K",   value: 4096 },
  { label: "8K",   value: 8192 },
  { label: "16K",  value: 16384 },
  { label: "32K",  value: 32768 },
  { label: "64K",  value: 65536 },
  { label: "128K", value: 131072 },
];

// ── Provider visual config ─────────────────────────────────────────────────────

const PROVIDER_CFG: Record<CloudProvider, { label: string; color: string; hint: string; icon: React.ReactNode }> = {
  openai: {
    label: "OpenAI",
    color: "#10a37f",
    hint: "gpt-4o, gpt-4o-mini, gpt-4-turbo...",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10.5L10 7L13 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  google: {
    label: "Google",
    color: "#4285f4",
    hint: "gemini-2.0-flash, gemini-1.5-pro...",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <path d="M17 10.1c0-.5-.05-1-.13-1.4H10v2.65h3.93c-.18.9-.71 1.65-1.5 2.16v1.8h2.42c1.42-1.31 2.15-3.24 2.15-5.21Z" fill="currentColor" opacity="0.9" />
        <path d="M10 18c1.97 0 3.62-.65 4.83-1.76l-2.42-1.8c-.65.44-1.5.7-2.41.7-1.85 0-3.42-1.25-3.98-2.93H3.52v1.85C4.72 16.86 7.18 18 10 18Z" fill="currentColor" opacity="0.7" />
        <path d="M6.02 12.21A4.97 4.97 0 0 1 5.74 10a5 5 0 0 1 .28-1.79V6.36H3.52A8 8 0 0 0 2 10c0 1.3.3 2.53.85 3.6l2.5-1.85.67.46Z" fill="currentColor" opacity="0.5" />
        <path d="M10 5.08c1.06 0 2.01.36 2.76 1.07l2.07-2.07A7.43 7.43 0 0 0 10 2C7.18 2 4.72 3.14 3.52 5.36l2.5 1.85C6.58 5.6 8.15 5.08 10 5.08Z" fill="currentColor" />
      </svg>
    ),
  },
  anthropic: {
    label: "Anthropic",
    color: "#d4703a",
    hint: "claude-sonnet-4-6, claude-opus-4-8...",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <path d="M10 3L16 17H4L10 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M7.5 13h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function BibbleSettingsPanel({
  open,
  onClose,
  isAdmin,
  temperature,
  onTemperatureChange,
  systemPrompt,
  onSystemPromptChange,
  ollamaUrl,
  onOllamaUrlChange,
  contextWindow,
  onContextWindowChange,
  computerAccess,
  onComputerAccessChange,
}: BibbleSettingsPanelProps) {
  const [testStatus, setTestStatus]   = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");

  // Cloud providers state (admin)
  const [cloudModels, setCloudModels]     = useState<CloudModel[]>([]);
  const [loadingCloud, setLoadingCloud]   = useState(false);
  const [showCloudForm, setShowCloudForm] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [form, setForm] = useState<{
    provider: CloudProvider;
    modelId: string;
    label: string;
    apiKey: string;
  }>({ provider: "openai", modelId: "", label: "", apiKey: "" });

  // Carrega cloud models quando admin abre o painel
  useEffect(() => {
    if (!open || !isAdmin) return;
    setLoadingCloud(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetch("/api/bibble/cloud-providers")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: CloudModel[]) => setCloudModels(data))
      .catch(() => setCloudModels([]))
      .finally(() => setLoadingCloud(false));
  }, [open, isAdmin]);

  const handleTest = useCallback(async () => {
    const url = ollamaUrl.trim();
    if (!url) return;
    setTestStatus("testing");
    setTestMessage("");
    try {
      const res = await fetch(`/api/bibble/models?url=${encodeURIComponent(url)}`);
      const data = await res.json() as { models?: Array<{ id: string }>; error?: string };
      if (data.models && data.models.length > 0) {
        setTestStatus("ok");
        setTestMessage(`${data.models.length} modelo(s) encontrado(s)`);
      } else if (data.error) {
        setTestStatus("error");
        setTestMessage(data.error);
      } else {
        setTestStatus("error");
        setTestMessage("Nenhum modelo encontrado nessa URL");
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Falha ao conectar");
    }
  }, [ollamaUrl]);

  const handleSaveCloud = useCallback(async () => {
    if (!form.provider || !form.modelId.trim() || !form.apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bibble/cloud-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const newModel = await res.json() as CloudModel;
        setCloudModels(prev => [...prev, newModel]);
        setForm({ provider: "openai", modelId: "", label: "", apiKey: "" });
        setShowCloudForm(false);
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  }, [form]);

  const handleDeleteCloud = useCallback(async (id: string) => {
    try {
      await fetch(`/api/bibble/cloud-providers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setCloudModels(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-[440px] flex flex-col shadow-2xl shadow-black/60"
        style={{ background: "#0d1526", borderLeft: "1px solid #1e2d4a" }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 h-14 border-b" style={{ borderColor: "#1e2d4a" }}>
          <h2 className="text-sm font-bold text-[#f4f6fb]">Configurações</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 grid place-items-center rounded-lg transition-colors duration-150 hover:bg-[#1e2d4a]"
            title="Fechar"
            style={{ color: "#4f6272" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-7">

          {/* ── URL Ollama ─────────────────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Server size={14} style={{ color: "#a5b4fc" }} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a5b4fc]">Modelo</h3>
              {!isAdmin && (
                <span className="ml-auto flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171" }}>
                  <Lock size={9} /> somente admin
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>
              URL da instância Ollama usada para listar modelos locais.
            </p>
            <div className="flex gap-2">
              <input
                value={ollamaUrl}
                onChange={e => { if (isAdmin) { onOllamaUrlChange(e.target.value); setTestStatus("idle"); } }}
                readOnly={!isAdmin}
                placeholder="http://localhost:11434"
                className={cn(
                  "flex-1 h-9 px-3 text-[12px] rounded-lg outline-none transition-colors",
                  !isAdmin && "cursor-not-allowed opacity-50 select-none",
                )}
                style={{ background: "rgba(30,45,74,0.5)", border: "1px solid #1e2d4a", color: "#cbd5e1" }}
              />
              <button
                onClick={handleTest}
                disabled={testStatus === "testing" || !ollamaUrl.trim()}
                className="px-3 h-9 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40 flex items-center gap-1.5"
                style={{ background: "rgba(79,70,229,0.2)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" }}
              >
                {testStatus === "testing" ? <Loader2 size={12} className="animate-spin" /> : null}
                Testar
              </button>
            </div>
            {testStatus === "ok" && (
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#4ade80" }}>
                <Check size={12} /><span>{testMessage}</span>
              </div>
            )}
            {testStatus === "error" && (
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#fca5a5" }}>
                <AlertTriangle size={12} /><span>{testMessage}</span>
              </div>
            )}
          </section>

          {/* ── Temperatura ────────────────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Thermometer size={14} style={{ color: "#a5b4fc" }} />
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a5b4fc]">Temperatura</h3>
              </div>
              <span
                className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-md"
                style={{ background: "rgba(74,98,246,.12)", border: "1px solid rgba(74,98,246,.3)", color: "#a5b4fc" }}
              >
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range" min={0} max={2} step={0.1} value={temperature}
              onChange={e => onTemperatureChange(Number(e.target.value))}
              className="w-full accent-[#6366f1] cursor-pointer"
            />
            <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>
              Menor = mais focado, Maior = mais criativo
            </p>
          </section>

          {/* ── Janela de contexto ──────────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutList size={14} style={{ color: "#a5b4fc" }} />
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a5b4fc]">Janela de Contexto</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={512} max={131072} step={512} value={contextWindow}
                  onChange={e => {
                    const v = Math.max(512, Math.min(131072, Number(e.target.value) || 4096));
                    onContextWindowChange(v);
                  }}
                  className="w-20 h-7 px-2 text-center text-[12px] font-bold rounded-md outline-none tabular-nums"
                  style={{ background: "rgba(74,98,246,.12)", border: "1px solid rgba(74,98,246,.3)", color: "#a5b4fc" }}
                />
                <span className="text-[10px]" style={{ color: "#4f6272" }}>tokens</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CTX_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => onContextWindowChange(p.value)}
                  className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors duration-150")}
                  style={{
                    background: contextWindow === p.value ? "rgba(74,98,246,.2)" : "rgba(30,45,74,0.5)",
                    border: contextWindow === p.value ? "1px solid rgba(74,98,246,.45)" : "1px solid #1e2d4a",
                    color: contextWindow === p.value ? "#a5b4fc" : "#4f6272",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>
              Tokens de contexto enviados ao modelo. Apenas Ollama local.
            </p>
          </section>

          {/* ── System Prompt ───────────────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <FileText size={14} style={{ color: "#a5b4fc" }} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a5b4fc]">System Prompt Global</h3>
            </div>

            <p className="text-[10px]" style={{ color: "#475569" }}>
              Instrução global do Bibble. Vazio = comportamento padrão.
            </p>

            <textarea
              value={systemPrompt}
              onChange={e => onSystemPromptChange(e.target.value)}
              placeholder="Instrução global para o Bibble em todas as conversas..."
              rows={6}
              className="w-full rounded-lg px-3 py-2.5 text-[12px] leading-relaxed outline-none resize-none"
              style={{ background: "rgba(20,35,60,0.5)", border: "1px solid #1e2d4a", color: "#cbd5e1" }}
            />
          </section>

          {/* ── Acesso ao computador ────────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} style={{ color: "#a5b4fc" }} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a5b4fc]">Acesso ao Computador</h3>
            </div>
            <div
              className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl"
              style={{ background: "rgba(30,45,74,0.4)", border: "1px solid #1e2d4a" }}
            >
              <span className="text-[12px] font-semibold text-[#cbd5e1]">Permitir acesso a arquivos</span>
              <button
                role="switch"
                aria-checked={computerAccess}
                onClick={() => onComputerAccessChange(!computerAccess)}
                className="relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200"
                style={{ background: computerAccess ? "#6366f1" : "#1e2d4a" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200"
                  style={{ transform: computerAccess ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>
            {computerAccess && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
                style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)" }}
              >
                <AlertTriangle size={13} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
                <span className="text-[11px] leading-relaxed" style={{ color: "#fca5a5" }}>
                  Acesso a arquivos ativo. Use apenas em ambiente local.
                </span>
              </div>
            )}
          </section>

          {/* ── Configurar IA Externa (admin only) ─────────────── */}
          {isAdmin && (
            <section className="space-y-3">
              {/* Header com badge admin */}
              <div className="flex items-center gap-2">
                <Cloud size={14} style={{ color: "#a5b4fc" }} />
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a5b4fc]">Configurar IA Externa</h3>
                <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.3)", color: "#a5b4fc" }}>
                  ADMIN
                </span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>
                Vincule provedores de IA em nuvem. Os modelos configurados aparecerão para todos os usuários.
              </p>

              {/* Lista de modelos configurados */}
              {loadingCloud ? (
                <div className="space-y-1.5">
                  {[1, 2].map(i => (
                    <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "rgba(30,45,74,0.4)" }} />
                  ))}
                </div>
              ) : cloudModels.length > 0 ? (
                <div className="space-y-1.5">
                  {cloudModels.map(m => {
                    const cfg = PROVIDER_CFG[m.provider];
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(20,35,60,0.6)", border: "1px solid #1e2d4a" }}
                      >
                        <span style={{ color: cfg.color }}>{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold truncate text-[#cbd5e1]">{m.label}</p>
                          <p className="text-[9px]" style={{ color: "#475569" }}>{cfg.label} · {m.modelId}</p>
                        </div>
                        <button
                          onClick={() => void handleDeleteCloud(m.id)}
                          className="p-1.5 rounded-lg transition-colors hover:text-red-400"
                          style={{ color: "#475569" }}
                          title="Remover"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : !showCloudForm ? (
                <div
                  className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl"
                  style={{ background: "rgba(20,35,60,0.4)", border: "1px dashed #1e2d4a" }}
                >
                  <Cloud size={18} style={{ color: "#1e2d4a" }} />
                  <p className="text-[10px] text-center" style={{ color: "#334155" }}>
                    Nenhuma IA em nuvem configurada
                  </p>
                </div>
              ) : null}

              {/* Botão adicionar / formulário */}
              {!showCloudForm ? (
                <button
                  onClick={() => setShowCloudForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold transition-all hover:bg-[rgba(99,102,241,0.15)]"
                  style={{ background: "rgba(79,70,229,0.08)", border: "1px dashed rgba(99,102,241,0.3)", color: "#6366f1" }}
                >
                  <Plus size={12} />
                  Adicionar modelo
                </button>
              ) : (
                <div
                  className="space-y-3 p-3 rounded-xl"
                  style={{ background: "rgba(10,18,36,0.8)", border: "1px solid #1e2d4a" }}
                >
                  {/* Seletor de provedor */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.entries(PROVIDER_CFG) as [CloudProvider, typeof PROVIDER_CFG[CloudProvider]][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setForm(f => ({ ...f, provider: key }))}
                        className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all text-[10px] font-bold"
                        style={{
                          background: form.provider === key ? "rgba(30,45,74,0.9)" : "rgba(15,23,42,0.5)",
                          border: form.provider === key ? `1px solid ${cfg.color}40` : "1px solid #1e2d4a",
                          color: form.provider === key ? cfg.color : "#475569",
                        }}
                      >
                        <span style={{ color: form.provider === key ? cfg.color : "#334155" }}>{cfg.icon}</span>
                        {cfg.label}
                      </button>
                    ))}
                  </div>

                  {/* Campos */}
                  <div className="space-y-2">
                    <input
                      value={form.modelId}
                      onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))}
                      placeholder={PROVIDER_CFG[form.provider].hint}
                      className="w-full h-8 px-3 text-[11px] rounded-lg outline-none"
                      style={{ background: "rgba(30,45,74,0.5)", border: "1px solid #1e2d4a", color: "#cbd5e1" }}
                    />
                    <input
                      value={form.label}
                      onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                      placeholder="Nome de exibição (opcional)"
                      className="w-full h-8 px-3 text-[11px] rounded-lg outline-none"
                      style={{ background: "rgba(30,45,74,0.5)", border: "1px solid #1e2d4a", color: "#cbd5e1" }}
                    />
                    <input
                      type="password"
                      value={form.apiKey}
                      onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                      placeholder="API Key"
                      className="w-full h-8 px-3 text-[11px] rounded-lg outline-none font-mono"
                      style={{ background: "rgba(30,45,74,0.5)", border: "1px solid #1e2d4a", color: "#cbd5e1" }}
                    />
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setShowCloudForm(false); setForm({ provider: "openai", modelId: "", label: "", apiKey: "" }); }}
                      className="px-3 h-7 rounded-lg text-[10px] transition-colors"
                      style={{ color: "#475569" }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => void handleSaveCloud()}
                      disabled={saving || !form.modelId.trim() || !form.apiKey.trim()}
                      className="px-3 h-7 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 flex items-center gap-1.5"
                      style={{ background: "rgba(79,70,229,0.2)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" }}
                    >
                      {saving && <Loader2 size={10} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
