"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
  X, Bot, Wrench, Plus, Trash2, Pencil, MessageSquare,
  Loader2, Check, AlertTriangle, ArrowLeft, Sparkles, ImagePlus,
  Globe, Lock, User, Users, Search, LayoutGrid, Pin, HelpCircle,
} from "lucide-react";
import {
  fetchAgents, fetchAgent, fetchTools, createAgent, updateAgent, deleteAgent, createCustomTool,
  uploadAgentImage, agentAvatarUrl,
  type OnyxAgent, type OnyxTool, type AgentFormData,
} from "@/lib/onyx/browser";
import { stripGlobalRule } from "@/lib/onyx/rule";
import { DEFAULT_AGENT_TOOL_NAMES, toolDescriptionPT } from "@/lib/onyx/tools-meta";

type Tab = "agentes" | "skills";
type View = "list" | "editor" | "skill-editor";

interface OnyxAgentsModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  /** Abre uma conversa NOVA e vazia com o agente (sem apresentação automática) */
  onConverse: (agent: OnyxAgent) => void;
  /** Abre conversa NOVA e já pergunta "Quem é você?" (apresentação) */
  onQuemEhVoce: (agent: OnyxAgent) => void;
  /** Ativa o agente na conversa ATUAL, sem reiniciar nem apresentar */
  onAddToConversation: (agent: OnyxAgent) => void;
  selectedAgentId: number | null;
  /** Lista de agentes fixados (onyxAgentId) — controla o estado do pino */
  fixadosIds: number[];
  /** Fixa/desfixa um agente */
  onToggleFixar: (agent: OnyxAgent) => void;
  /** Cor do tema do usuário (string "R, G, B") — colore destaques do modal */
  accent?: string;
}

const EMPTY_FORM: AgentFormData = {
  name: "",
  description: "",
  system_prompt: "",
  task_prompt: "",
  tool_ids: [],
  is_public: false, // privado por padrão; usuário escolhe tornar público
  uploaded_image_id: null,
  remove_image: false,
};

const SKILL_PLACEHOLDER = `{
  "openapi": "3.0.0",
  "info": { "title": "Minha Skill", "version": "1.0.0", "description": "O que ela faz" },
  "servers": [{ "url": "https://api.exemplo.com" }],
  "paths": {
    "/recurso": {
      "get": {
        "summary": "Resumo da ação",
        "operationId": "buscarRecurso",
        "responses": { "200": { "description": "ok" } }
      }
    }
  }
}`;

export default function OnyxAgentsModal({
  open, onClose, isAdmin, onConverse, onQuemEhVoce, onAddToConversation, selectedAgentId,
  fixadosIds, onToggleFixar, accent,
}: OnyxAgentsModalProps) {
  const ac = accent ?? "99, 102, 241";
  const [tab, setTab] = useState<Tab>("agentes");
  const [view, setView] = useState<View>("list");

  const [agents, setAgents] = useState<OnyxAgent[]>([]);
  const [tools, setTools] = useState<OnyxTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // busca + filtro da lista de agentes
  const [agentSearch, setAgentSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<"todos" | "meus" | "equipe">("todos");

  // editor de agente
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AgentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null); // object URL ou avatar URL
  const [imgUploading, setImgUploading] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(false); // carrega o detalhe (system_prompt)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // editor de skill
  const [skillJson, setSkillJson] = useState("");
  const [skillSaving, setSkillSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, t] = await Promise.all([fetchAgents(), fetchTools()]);
      setAgents(a);
      setTools(t);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      // Reset intencional do estado visual ao reabrir o modal
      setView("list");        // eslint-disable-line react-hooks/set-state-in-effect
      setTab("agentes");
      void load();
    }
  }, [open, load]);

  if (!open) return null;

  // ── Ações de agente ──
  const openNew = () => {
    setEditingId(null);
    // Skills ativadas por padrão (Internal Search, Web Search, Open URL)
    const defaultToolIds = tools.filter(t => DEFAULT_AGENT_TOOL_NAMES.includes(t.name)).map(t => t.id);
    setForm({ ...EMPTY_FORM, tool_ids: defaultToolIds });
    setImgPreview(null);
    setView("editor");
  };

  const openEdit = async (agent: OnyxAgent) => {
    setEditingId(agent.id);
    // Preenche com o que a lista tem; o system_prompt vem do detalhe (lista não traz)
    setForm({
      name: agent.name,
      description: agent.description,
      system_prompt: "",
      task_prompt: "",
      tool_ids: agent.tools?.map(t => t.id) ?? [],
      is_public: agent.isPublic ?? false,
      uploaded_image_id: agent.uploaded_image_id ?? null,
      remove_image: false,
    });
    setImgPreview(agent.uploaded_image_id ? agentAvatarUrl(agent.id) : null);
    setView("editor");

    // Busca o detalhe completo (system_prompt, task_prompt)
    setLoadingPrompt(true);
    try {
      const full = await fetchAgent(agent.id);
      setForm(f => ({
        ...f,
        system_prompt: stripGlobalRule(full.system_prompt),
        task_prompt: full.task_prompt ?? "",
        tool_ids: full.tools?.map(t => t.id) ?? f.tool_ids,
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingPrompt(false);
    }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    setError(null);
    setImgUploading(true);
    try {
      const id = await uploadAgentImage(file);
      setForm(f => ({ ...f, uploaded_image_id: id, remove_image: false }));
      setImgPreview(URL.createObjectURL(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImgUploading(false);
    }
  };

  const removeImage = () => {
    setForm(f => ({ ...f, uploaded_image_id: null, remove_image: true }));
    setImgPreview(null);
  };

  const saveAgent = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.system_prompt.trim()) {
      setError("Preencha nome, descrição e instruções (system prompt).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId !== null) await updateAgent(editingId, form);
      else await createAgent(form);
      await load();
      setView("list");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeAgent = async (id: number) => {
    if (!confirm("Excluir este agente? Esta ação não pode ser desfeita.")) return;
    setError(null);
    try {
      await deleteAgent(id);
      setAgents(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleTool = (toolId: number) => {
    setForm(f => {
      const has = f.tool_ids?.includes(toolId);
      return { ...f, tool_ids: has ? f.tool_ids!.filter(t => t !== toolId) : [...(f.tool_ids ?? []), toolId] };
    });
  };

  // Lista filtrada por busca (nome) + filtro (meus / equipe / todos)
  const filteredAgents = agents.filter(a => {
    if (agentFilter === "meus" && !a.ownedByMe) return false;
    if (agentFilter === "equipe" && a.ownedByMe) return false;
    const q = agentSearch.trim().toLowerCase();
    if (q && !a.name.toLowerCase().includes(q) && !(a.description ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  // Separa fixados (seção própria no topo) dos demais
  const fixadosList = filteredAgents.filter(a => fixadosIds.includes(a.id));
  const outrosList = filteredAgents.filter(a => !fixadosIds.includes(a.id));

  const renderAgentCard = (agent: OnyxAgent) => {
    const fixado = fixadosIds.includes(agent.id);
    return (
      <div
        key={agent.id}
        className="group rounded-2xl p-3.5 transition-all"
        style={{
          background: selectedAgentId === agent.id ? "rgba(79,70,229,0.15)" : "rgba(15,23,42,0.5)",
          border: `1px solid ${selectedAgentId === agent.id ? "rgba(99,102,241,0.45)" : fixado ? "rgba(245,158,11,0.3)" : "rgba(99,102,241,0.12)"}`,
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0 overflow-hidden relative" style={{ background: "rgba(99,102,241,0.15)" }}>
            {agent.uploaded_image_id ? (
              <Image src={agentAvatarUrl(agent.id)} alt={agent.name} fill unoptimized className="object-cover" />
            ) : (
              <Bot size={17} style={{ color: "#a5b4fc" }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold truncate" style={{ color: "#f1f5f9" }}>{agent.name}</h3>
              {/* Pino para fixar/desfixar */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFixar(agent); }}
                title={fixado ? "Desfixar agente" : "Fixar agente (máx. 3)"}
                className="shrink-0 p-1 rounded-md transition-all hover:scale-110"
                style={{
                  background: fixado ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                  color: fixado ? "#fbbf24" : "#64748b",
                }}
              >
                <Pin size={13} strokeWidth={2.5} fill={fixado ? "#fbbf24" : "none"} className={fixado ? "" : "rotate-45"} />
              </button>
              {selectedAgentId === agent.id && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.25)", color: "#a5b4fc" }}>Ativo</span>
              )}
              <span
                className="flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                style={agent.isPublic
                  ? { background: "rgba(16,185,129,0.15)", color: "#6ee7b7" }
                  : { background: "rgba(100,116,139,0.15)", color: "#94a3b8" }}
              >
                {agent.isPublic ? <Globe size={9} /> : <Lock size={9} />}
                {agent.isPublic ? "Público" : "Privado"}
              </span>
            </div>
            <p className="text-[11.5px] mt-0.5 line-clamp-2" style={{ color: "#8fa3bc" }}>{agent.description}</p>
            {agent.tools && agent.tools.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {agent.tools.map(t => (
                  <span key={t.id} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(30,45,74,0.7)", color: "#6b7fa0" }}>
                    {t.display_name ?? t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={() => { onConverse(agent); onClose(); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-black transition-all active:scale-[0.97] hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              boxShadow: "0 4px 16px rgba(79,70,229,0.45), 0 0 0 1px rgba(129,140,248,0.4)",
            }}
            title="Abrir uma conversa nova e vazia com este agente"
          >
            <MessageSquare size={14} strokeWidth={2.5} /> Conversar
          </button>

          <button
            onClick={() => { onQuemEhVoce(agent); onClose(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-bold transition-all active:scale-[0.97]"
            style={{
              background: "rgba(168,85,247,0.14)",
              border: "1px solid rgba(168,85,247,0.4)",
              color: "#d8b4fe",
            }}
            title="Abrir conversa nova e pedir que o agente se apresente"
          >
            <HelpCircle size={13} strokeWidth={2.5} /> Quem é você?
          </button>

          <button
            onClick={() => { onAddToConversation(agent); onClose(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-bold transition-all active:scale-[0.97]"
            style={{
              background: "rgba(79,70,229,0.12)",
              border: "1px solid rgba(99,102,241,0.35)",
              color: "#a5b4fc",
            }}
            title="Usar este agente na conversa atual, sem reiniciar"
          >
            <Plus size={13} strokeWidth={2.5} /> Adicionar à conversa
          </button>

          {agent.createdByName && (
            <span className="flex items-center gap-1 text-[10.5px] min-w-0" style={{ color: "#6b7fa0" }}>
              <User size={11} className="shrink-0" />
              <span className="shrink-0">Criado por:</span>
              <span className="font-semibold truncate" style={{ color: "#8fa3bc" }}>{agent.createdByName}</span>
            </span>
          )}

          <div className="flex-1" />

          {(agent.ownedByMe || isAdmin) && (
            <>
              <button onClick={() => void openEdit(agent)} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "#6b7fa0" }} title="Editar">
                <Pencil size={13} />
              </button>
              <button onClick={() => removeAgent(agent.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400" style={{ color: "#6b7fa0" }} title="Excluir">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const saveSkill = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(skillJson) as Record<string, unknown>;
    } catch {
      setError("O schema OpenAPI não é um JSON válido.");
      return;
    }
    setSkillSaving(true);
    setError(null);
    try {
      await createCustomTool(parsed);
      await load();
      setSkillJson("");
      setView("list");
      setTab("skills");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSkillSaving(false);
    }
  };

  const inputCls = "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-colors";
  const inputStyle = { background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99,102,241,0.2)", color: "#e2e8f0" };
  const labelCls = "block text-[11px] font-black uppercase tracking-widest mb-1.5";
  const labelStyle = { color: "#6b7fa0" };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-3xl overflow-hidden"
        style={{ background: "#0a1020", border: `1px solid rgba(${ac},0.25)`, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid rgba(${ac},0.15)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: `rgba(${ac},0.15)`, border: `1px solid rgba(${ac},0.3)` }}>
              <Sparkles size={15} style={{ color: `rgba(${ac},1)` }} />
            </div>
            <div>
              <h2 className="text-[14px] font-black" style={{ color: "#f1f5f9" }}>Agentes de IA</h2>
              <p className="text-[10px]" style={{ color: "#5a7090" }}>Powered by Onyx</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg transition-colors hover:bg-white/5" style={{ color: "#6b7fa0" }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs (só na listagem) */}
        {view === "list" && (
          <div className="flex gap-1.5 px-5 pt-3 shrink-0">
            {([["agentes", "Agentes", Bot], ["skills", "Skills", Wrench]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all"
                style={{
                  background: tab === key ? `rgba(${ac},0.2)` : "transparent",
                  border: tab === key ? `1px solid rgba(${ac},0.35)` : "1px solid transparent",
                  color: tab === key ? `rgba(${ac},1)` : "#6b7fa0",
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
          {error && (
            <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <AlertTriangle size={14} style={{ color: "#f87171", marginTop: 1, flexShrink: 0 }} />
              <span className="text-[12px]" style={{ color: "#fca5a5" }}>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={26} className="animate-spin" style={{ color: "#6366f1" }} />
              <p className="text-[12px]" style={{ color: "#5a7090" }}>Carregando do Onyx…</p>
            </div>
          ) : view === "list" && tab === "agentes" ? (
            <>
              <button
                onClick={openNew}
                className="w-full flex items-center justify-center gap-2 py-3 mb-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all duration-150 cursor-pointer hover:brightness-125 active:scale-[0.98]"
                style={{ background: `rgba(${ac},0.2)`, border: `1px dashed rgba(${ac},0.4)`, color: `rgba(${ac},1)` }}
              >
                <Plus size={14} /> Novo agente
              </button>

              {/* Busca + filtro */}
              {agents.length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#5a7090" }} />
                    <input
                      value={agentSearch}
                      onChange={e => setAgentSearch(e.target.value)}
                      placeholder="Buscar agente por nome…"
                      className="w-full rounded-xl pl-9 pr-3 py-2 text-[12px] outline-none transition-colors"
                      style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(99,102,241,0.2)", color: "#e2e8f0" }}
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {([
                      { val: "todos", label: "Todos", Icon: LayoutGrid },
                      { val: "meus", label: "Meus agentes", Icon: User },
                      { val: "equipe", label: "Da equipe", Icon: Users },
                    ] as const).map(({ val, label, Icon }) => {
                      const active = agentFilter === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setAgentFilter(val)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          style={{
                            background: active ? "rgba(79,70,229,0.22)" : "rgba(15,23,42,0.5)",
                            border: `1px solid ${active ? "rgba(99,102,241,0.45)" : "rgba(99,102,241,0.12)"}`,
                            color: active ? "#c7d2fe" : "#6b7fa0",
                          }}
                        >
                          <Icon size={12} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {agents.length === 0 ? (
                <p className="text-center text-[12px] py-8" style={{ color: "#5a7090" }}>Nenhum agente ainda. Crie o primeiro.</p>
              ) : filteredAgents.length === 0 ? (
                <p className="text-center text-[12px] py-8" style={{ color: "#5a7090" }}>Nenhum agente encontrado com esse filtro.</p>
              ) : (
                <div className="space-y-4">
                  {/* Seção: Fixados */}
                  {fixadosList.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-1" style={{ color: "#fbbf24" }}>
                        <Pin size={11} fill="#fbbf24" /> Fixados ({fixadosList.length})
                      </p>
                      {fixadosList.map(renderAgentCard)}
                    </div>
                  )}

                  {/* Seção: Todos os demais */}
                  {outrosList.length > 0 && (
                    <div className="space-y-2">
                      {fixadosList.length > 0 && (
                        <p className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: "#5a7090" }}>Todos</p>
                      )}
                      {outrosList.map(renderAgentCard)}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : view === "list" && tab === "skills" ? (
            <>
              {isAdmin && (
                <button
                  onClick={() => { setSkillJson(""); setView("skill-editor"); }}
                  className="w-full flex items-center justify-center gap-2 py-3 mb-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                  style={{ background: "rgba(79,70,229,0.2)", border: "1px dashed rgba(99,102,241,0.4)", color: "#a5b4fc" }}
                >
                  <Plus size={14} /> Nova skill
                </button>
              )}
              {tools.length === 0 ? (
                <p className="text-center text-[12px] py-8" style={{ color: "#5a7090" }}>Nenhuma skill disponível.</p>
              ) : (
                <div className="space-y-2">
                  {tools.map(tool => (
                    <div key={tool.id} className="rounded-2xl p-3.5 flex items-start gap-3" style={{ background: "rgba(15,23,42,0.5)", border: "1px solid rgba(99,102,241,0.12)" }}>
                      <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(99,102,241,0.12)" }}>
                        <Wrench size={16} style={{ color: "#818cf8" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[13px] font-bold" style={{ color: "#f1f5f9" }}>{tool.display_name ?? tool.name}</h3>
                        {tool.description && <p className="text-[11.5px] mt-0.5" style={{ color: "#8fa3bc" }}>{tool.description}</p>}
                        {tool.in_code_tool_id && (
                          <span className="inline-block text-[9px] mt-1.5 px-1.5 py-0.5 rounded" style={{ background: "rgba(30,45,74,0.7)", color: "#6b7fa0" }}>built-in</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : view === "editor" ? (
            /* ── Editor de agente ── */
            <div className="space-y-4">
              <button onClick={() => setView("list")} className="flex items-center gap-1.5 text-[12px] font-bold transition-colors" style={{ color: "#6b7fa0" }}>
                <ArrowLeft size={14} /> Voltar
              </button>
              <h3 className="text-[15px] font-black" style={{ color: "#f1f5f9" }}>{editingId !== null ? "Editar agente" : "Novo agente"}</h3>

              {/* Imagem do agente */}
              <div className="flex items-center gap-3.5">
                <div
                  className="w-16 h-16 rounded-2xl overflow-hidden grid place-items-center shrink-0 relative"
                  style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}
                >
                  {imgUploading ? (
                    <Loader2 size={20} className="animate-spin" style={{ color: "#a5b4fc" }} />
                  ) : imgPreview ? (
                    <Image src={imgPreview} alt="Imagem do agente" fill unoptimized className="object-cover" />
                  ) : (
                    <Bot size={26} style={{ color: "#a5b4fc" }} />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imgUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                    style={{ background: "rgba(79,70,229,0.18)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
                  >
                    <ImagePlus size={13} /> {imgPreview ? "Trocar imagem" : "Adicionar imagem"}
                  </button>
                  {imgPreview && (
                    <button type="button" onClick={removeImage} className="text-[10px] font-bold text-left transition-colors hover:text-red-400" style={{ color: "#6b7fa0" }}>
                      Remover imagem
                    </button>
                  )}
                  <span className="text-[10px]" style={{ color: "#5a7090" }}>PNG, JPG, WEBP ou GIF · até 5MB. Vazio = ícone padrão.</span>
                </div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onPickImage} className="hidden" />
              </div>

              <div>
                <label className={labelCls} style={labelStyle}>Nome</label>
                <input className={inputCls} style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Analista de Comex" />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Descrição</label>
                <input className={inputCls} style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="O que este agente faz" />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>
                  Instruções (system prompt)
                  {loadingPrompt && <Loader2 size={11} className="inline-block ml-2 animate-spin align-[-1px]" style={{ color: "#a5b4fc" }} />}
                </label>
                <textarea
                  className={inputCls + " resize-none"}
                  style={inputStyle}
                  rows={6}
                  value={form.system_prompt}
                  disabled={loadingPrompt}
                  onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                  placeholder={loadingPrompt ? "Carregando instruções do agente…" : "Defina personalidade, regras e objetivo do agente…"}
                />
              </div>

              {/* Visibilidade: público x privado */}
              <div>
                <label className={labelCls} style={labelStyle}>Visibilidade</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { val: false, icon: Lock, title: "Privado", desc: "Só você vê e usa" },
                    { val: true, icon: Globe, title: "Público", desc: "Todos podem ver e usar" },
                  ] as const).map(opt => {
                    const active = !!form.is_public === opt.val;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, is_public: opt.val }))}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{
                          background: active ? "rgba(79,70,229,0.2)" : "rgba(15,23,42,0.6)",
                          border: `1px solid ${active ? "rgba(99,102,241,0.5)" : "rgba(99,102,241,0.12)"}`,
                        }}
                      >
                        <Icon size={16} style={{ color: active ? "#a5b4fc" : "#6b7fa0", marginTop: 1, flexShrink: 0 }} />
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold" style={{ color: active ? "#e2e8f0" : "#8fa3bc" }}>{opt.title}</p>
                          <p className="text-[10px] leading-tight" style={{ color: "#5a7090" }}>{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls} style={labelStyle}>Skills (habilidades do agente)</label>
                {tools.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "#5a7090" }}>Nenhuma skill cadastrada.</p>
                ) : (
                  <div className="space-y-1.5">
                    {tools.map(tool => {
                      const active = form.tool_ids?.includes(tool.id);
                      return (
                        <button
                          key={tool.id}
                          onClick={() => toggleTool(tool.id)}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                          style={{
                            background: active ? "rgba(79,70,229,0.2)" : "rgba(15,23,42,0.6)",
                            border: `1px solid ${active ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.12)"}`,
                          }}
                        >
                          <div className="w-4 h-4 rounded grid place-items-center shrink-0 mt-0.5" style={{ background: active ? "#6366f1" : "transparent", border: active ? "none" : "1px solid #475569" }}>
                            {active && <Check size={11} color="#fff" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold" style={{ color: active ? "#e2e8f0" : "#8fa3bc" }}>{tool.display_name ?? tool.name}</p>
                            <p className="text-[10.5px] leading-snug" style={{ color: "#5a7090" }}>{toolDescriptionPT(tool.name, tool.description)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setView("list")} className="px-4 py-2 rounded-xl text-[12px] font-bold" style={{ color: "#6b7fa0" }}>Cancelar</button>
                <button
                  onClick={saveAgent}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  style={{ background: "rgba(79,70,229,0.3)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {editingId !== null ? "Salvar" : "Criar agente"}
                </button>
              </div>
            </div>
          ) : (
            /* ── Editor de skill (admin) ── */
            <div className="space-y-4">
              <button onClick={() => setView("list")} className="flex items-center gap-1.5 text-[12px] font-bold transition-colors" style={{ color: "#6b7fa0" }}>
                <ArrowLeft size={14} /> Voltar
              </button>
              <h3 className="text-[15px] font-black" style={{ color: "#f1f5f9" }}>Nova skill (OpenAPI)</h3>
              <p className="text-[11.5px]" style={{ color: "#8fa3bc" }}>
                Cole o schema OpenAPI da API que o agente poderá chamar. O Onyx deriva nome e ações do próprio schema.
              </p>
              <textarea
                className={inputCls + " resize-none font-mono"}
                style={{ ...inputStyle, fontSize: 11 }}
                rows={14}
                value={skillJson}
                onChange={e => setSkillJson(e.target.value)}
                placeholder={SKILL_PLACEHOLDER}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setView("list")} className="px-4 py-2 rounded-xl text-[12px] font-bold" style={{ color: "#6b7fa0" }}>Cancelar</button>
                <button
                  onClick={saveSkill}
                  disabled={skillSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  style={{ background: "rgba(79,70,229,0.3)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}
                >
                  {skillSaving && <Loader2 size={13} className="animate-spin" />}
                  Criar skill
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
