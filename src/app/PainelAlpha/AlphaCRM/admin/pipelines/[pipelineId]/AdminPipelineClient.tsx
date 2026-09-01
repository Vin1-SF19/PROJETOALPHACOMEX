"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, GripVertical, Pencil, Trash2 } from "lucide-react";
import { CriarEtapaBpm, AtualizarEtapaBpm, ReordenarEtapasBpm } from "@/actions/bpm/Etapas";
import { CriarCampoBpm, AtualizarCampoBpm, ExcluirCampoBpm } from "@/actions/bpm/Campos";
import type { TemaAlpha } from "@/lib/temas";
import { FINANCIAL_PIPELINE_NAME, hasConfiguredFinancialPipeline } from "@/lib/bpm/pipeline-financeiro";
import { ConfigurarEtapasFinanceiroButton } from "./ConfigurarEtapasFinanceiroButton";

interface EtapaBpm {
  id: string;
  nome: string;
  ordem: number;
  slaDias: number | null;
  ativo: boolean;
}

interface CampoBpm {
  id: string;
  etapaId: string | null;
  nome: string;
  tipo: string;
  opcoesJson: string | null;
  obrigatorio: boolean;
  ordem: number;
}

interface PipelineBpm {
  id: string;
  nome: string;
  etapas: EtapaBpm[];
  campos: CampoBpm[];
}

const TIPOS_CAMPO: { value: string; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "texto_longo", label: "Texto longo" },
  { value: "numero", label: "Número" },
  { value: "data", label: "Data" },
  { value: "selecao", label: "Seleção" },
  { value: "booleano", label: "Sim/Não" },
  { value: "cpf", label: "CPF" },
];

const TIPOS_COM_OPICOES = new Set(["selecao"]);

const inputCls = "bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

export default function AdminPipelineClient({ pipeline, visual }: { pipeline: PipelineBpm; visual: TemaAlpha }) {
  const accent = visual.accent;
  const router = useRouter();
  const [etapas, setEtapas] = useState(pipeline.etapas.slice().sort((a, b) => a.ordem - b.ordem));
  const [campos, setCampos] = useState(pipeline.campos);
  const [novaEtapaNome, setNovaEtapaNome] = useState("");
  const [novoCampoNome, setNovoCampoNome] = useState("");
  const [novoCampoTipo, setNovoCampoTipo] = useState("texto");
  const [novoCampoEtapaId, setNovoCampoEtapaId] = useState<string>("");
  const [novoCampoObrigatorio, setNovoCampoObrigatorio] = useState(false);
  const [novoCampoOpcoes, setNovoCampoOpcoes] = useState("");
  const [editandoCampoId, setEditandoCampoId] = useState<string | null>(null);
  const [editCampoNome, setEditCampoNome] = useState("");
  const [editCampoTipo, setEditCampoTipo] = useState("texto");
  const [editCampoEtapaId, setEditCampoEtapaId] = useState<string>("");
  const [editCampoObrigatorio, setEditCampoObrigatorio] = useState(false);
  const [editCampoOpcoes, setEditCampoOpcoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function handleCriarEtapa() {
    if (!novaEtapaNome.trim()) return;
    const res = await CriarEtapaBpm({ pipelineId: pipeline.id, nome: novaEtapaNome, ordem: etapas.length });
    if (res.success && res.data) {
      setEtapas((prev) => [...prev, res.data]);
      setNovaEtapaNome("");
    } else {
      setErro(typeof res.error === "string" ? res.error : "Erro ao criar etapa");
    }
  }

  async function handleAtualizarSla(etapaId: string, slaDias: number | null) {
    setEtapas((prev) => prev.map((e) => (e.id === etapaId ? { ...e, slaDias } : e)));
    await AtualizarEtapaBpm({ etapaId, slaDias });
  }

  async function handleRenomearEtapa(etapaId: string, nome: string) {
    setEtapas((prev) => prev.map((e) => (e.id === etapaId ? { ...e, nome } : e)));
    if (!nome.trim()) return;
    const res = await AtualizarEtapaBpm({ etapaId, nome: nome.trim() });
    if (!res.success) {
      setErro(typeof res.error === "string" ? res.error : "Erro ao renomear etapa");
    }
  }

  async function handleMoverEtapa(index: number, direcao: -1 | 1) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= etapas.length) return;

    const reordenadas = etapas.slice();
    [reordenadas[index], reordenadas[novoIndex]] = [reordenadas[novoIndex], reordenadas[index]];
    const comOrdemAtualizada = reordenadas.map((e, i) => ({ ...e, ordem: i }));
    setEtapas(comOrdemAtualizada);

    await ReordenarEtapasBpm({
      pipelineId: pipeline.id,
      ordem: comOrdemAtualizada.map((e) => ({ etapaId: e.id, ordem: e.ordem })),
    });
    router.refresh();
  }

  async function handleCriarCampo() {
    if (!novoCampoNome.trim()) return;
    const opcoes =
      TIPOS_COM_OPICOES.has(novoCampoTipo)
        ? novoCampoOpcoes
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    if (TIPOS_COM_OPICOES.has(novoCampoTipo) && opcoes.length === 0) {
      setErro("Campo do tipo Seleção requer ao menos uma opção (uma por linha)");
      return;
    }
    const res = await CriarCampoBpm({
      pipelineId: pipeline.id,
      etapaId: novoCampoEtapaId || undefined,
      nome: novoCampoNome,
      tipo: novoCampoTipo,
      obrigatorio: novoCampoObrigatorio,
      opcoes,
      ordem: campos.length,
    });
    if (res.success && res.data) {
      setCampos((prev) => [...prev, res.data]);
      setNovoCampoNome("");
      setNovoCampoObrigatorio(false);
      setNovoCampoOpcoes("");
    } else {
      setErro(typeof res.error === "string" ? res.error : "Erro ao criar campo");
    }
  }

  async function handleToggleObrigatorio(campoId: string, obrigatorio: boolean) {
    setCampos((prev) => prev.map((c) => (c.id === campoId ? { ...c, obrigatorio } : c)));
    await AtualizarCampoBpm({ campoId, obrigatorio });
  }

  /* ===== Editor / Exclusão de campos (D-24) =========================== */
  function abrirEditor(c: CampoBpm) {
    let opcoes: string[] = [];
    try {
      const parsed = c.opcoesJson ? JSON.parse(c.opcoesJson) : [];
      if (Array.isArray(parsed)) opcoes = parsed;
    } catch {
      opcoes = [];
    }
    setEditCampoNome(c.nome);
    setEditCampoTipo(c.tipo);
    setEditCampoEtapaId(c.etapaId ?? "");
    setEditCampoObrigatorio(c.obrigatorio);
    setEditCampoOpcoes(opcoes.join("\n"));
    setEditandoCampoId(c.id);
  }

  function cancelarEdicao() {
    setEditandoCampoId(null);
  }

  async function salvarEdicao(campoId: string) {
    if (!editCampoNome.trim()) {
      setErro("Nome do campo é obrigatório");
      return;
    }
    const opcoes =
      TIPOS_COM_OPICOES.has(editCampoTipo)
        ? editCampoOpcoes
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const res = await AtualizarCampoBpm({
      campoId,
      nome: editCampoNome.trim(),
      tipo: editCampoTipo,
      etapaId: editCampoEtapaId || null,
      obrigatorio: editCampoObrigatorio,
      opcoes,
    });
    if (res.success) {
      setCampos((prev) => prev.map((c) => (c.id === campoId ? { ...(res.data ?? c), nome: editCampoNome.trim(), tipo: editCampoTipo, etapaId: editCampoEtapaId || null, obrigatorio: editCampoObrigatorio } : c)));
      router.refresh();
    } else {
      setErro(typeof res.error === "string" ? res.error : "Erro ao salvar campo");
    }
    cancelarEdicao();
  }

  async function excluirCampo(campoId: string, nome: string) {
    if (!confirm(`Excluir o campo "${nome}" e todos os valores associados? Esta ação não pode ser desfeita.`)) return;
    const res = await ExcluirCampoBpm({ campoId });
    if (res.success) {
      setCampos((prev) => prev.filter((c) => c.id !== campoId));
      if (editandoCampoId === campoId) cancelarEdicao();
      router.refresh();
    } else {
      setErro(typeof res.error === "string" ? res.error : "Erro ao excluir campo");
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-black text-white">Configurar Pipeline — {pipeline.nome}</h1>
        <p className="text-sm text-slate-400 mt-1">Etapas, campos e SLA são exclusivos de administradores.</p>
      </div>

      {erro && (
        <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{erro}</div>
      )}

      {pipeline.nome === FINANCIAL_PIPELINE_NAME && (
        hasConfiguredFinancialPipeline(etapas, campos) ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" role="status">
            Pipeline Financeiro configurado com as cinco etapas e campos oficiais.
          </div>
        ) : (
          <ConfigurarEtapasFinanceiroButton
            pipelineId={pipeline.id}
            accent={accent}
            onConfigured={(data) => {
              setEtapas(data.etapas);
              setCampos(
                data.campos.map((c) => ({
                  ...c,
                  opcoesJson: null,
                }))
              );
              router.refresh();
            }}
          />
        )
      )}

      {/* Etapas */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Etapas</h2>
        <div className="space-y-2">
          {etapas.map((etapa, i) => (
            <div key={etapa.id} className="flex items-center gap-3 bg-slate-800/60 border border-white/5 rounded-xl px-3 py-2">
              <GripVertical size={14} className="text-slate-600" />
              <input
                aria-label={`Nome da etapa ${etapa.nome}`}
                className={`${inputCls} flex-1`}
                value={etapa.nome}
                onChange={(e) => setEtapas((prev) => prev.map((it) => (it.id === etapa.id ? { ...it, nome: e.target.value } : it)))}
                onBlur={(e) => handleRenomearEtapa(etapa.id, e.target.value)}
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                SLA (dias)
                <input
                  type="number"
                  min={1}
                  className={`${inputCls} w-16`}
                  value={etapa.slaDias ?? ""}
                  onChange={(e) => handleAtualizarSla(etapa.id, e.target.value ? Number(e.target.value) : null)}
                />
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => handleMoverEtapa(i, -1)}
                  disabled={i === 0}
                  className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMoverEtapa(i, 1)}
                  disabled={i === etapas.length - 1}
                  className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Nome da nova etapa"
            value={novaEtapaNome}
            onChange={(e) => setNovaEtapaNome(e.target.value)}
          />
          <button
            onClick={handleCriarEtapa}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </section>

      {/* Campos personalizados */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Campos Personalizados</h2>
        <div className="space-y-2">
          {campos.map((campo) => {
            const editando = editandoCampoId === campo.id;
            return (
              <div key={campo.id} className="bg-slate-800/60 border border-white/5 rounded-xl">
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-sm text-white">{campo.nome}</span>
                  <span className="text-xs text-slate-500">{campo.tipo}</span>
                  <span className="text-xs text-slate-500">
                    {etapas.find((e) => e.id === campo.etapaId)?.nome || "Todas as etapas"}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      disabled={editando}
                      checked={campo.obrigatorio}
                      onChange={(e) => handleToggleObrigatorio(campo.id, e.target.checked)}
                    />
                    Obrigatório
                  </label>
                  <button
                    onClick={() => (editando ? cancelarEdicao() : abrirEditor(campo))}
                    className="p-1.5 rounded text-slate-400 hover:text-white"
                    aria-label={editando ? "Cancelar edição do campo" : `Editar campo ${campo.nome}`}
                    title={editando ? "Cancelar edição" : "Editar campo"}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => void excluirCampo(campo.id, campo.nome)}
                    disabled={editando}
                    className="p-1.5 rounded text-slate-400 hover:text-rose-300 disabled:opacity-30"
                    aria-label={`Excluir campo ${campo.nome}`}
                    title="Excluir campo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {editando && (
                  <div className="border-t border-white/10 px-3 py-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="space-y-1 text-xs text-slate-400">
                        <span>Nome</span>
                        <input className={inputCls + " w-full"} value={editCampoNome} onChange={(e) => setEditCampoNome(e.target.value)} />
                      </label>
                      <label className="space-y-1 text-xs text-slate-400">
                        <span>Tipo</span>
                        <select className={inputCls + " w-full"} value={editCampoTipo} onChange={(e) => setEditCampoTipo(e.target.value)}>
                          {TIPOS_CAMPO.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs text-slate-400">
                        <span>Etapa</span>
                        <select className={inputCls + " w-full"} value={editCampoEtapaId} onChange={(e) => setEditCampoEtapaId(e.target.value)}>
                          <option value="">Todas as etapas</option>
                          {etapas.map((e) => (
                            <option key={e.id} value={e.id}>{e.nome}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs text-slate-400 flex items-end">
                        <span />
                        <span className="flex items-center gap-1.5 text-slate-400 pb-2">
                          <input type="checkbox" checked={editCampoObrigatorio} onChange={(e) => setEditCampoObrigatorio(e.target.checked)} />
                          Obrigatório
                        </span>
                      </label>
                      {TIPOS_COM_OPICOES.has(editCampoTipo) && (
                        <label className="sm:col-span-2 space-y-1 text-xs text-slate-400">
                          <span>Opções (uma por linha)</span>
                          <textarea className={inputCls + " w-full min-h-[72px] font-mono"} value={editCampoOpcoes} onChange={(e) => setEditCampoOpcoes(e.target.value)} />
                        </label>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void salvarEdicao(campo.id)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: `rgba(${accent},0.85)` }}>
                        Salvar
                      </button>
                      <button onClick={cancelarEdicao} className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className={`${inputCls} flex-1 min-w-[140px]`}
            placeholder="Nome do campo"
            value={novoCampoNome}
            onChange={(e) => setNovoCampoNome(e.target.value)}
          />
          <select className={inputCls} value={novoCampoTipo} onChange={(e) => setNovoCampoTipo(e.target.value)}>
            {TIPOS_CAMPO.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {TIPOS_COM_OPICOES.has(novoCampoTipo) && (
            <textarea
              className={`${inputCls} min-w-[160px] min-h-[36px] font-mono`}
              placeholder="Opções (uma por linha)"
              value={novoCampoOpcoes}
              onChange={(e) => setNovoCampoOpcoes(e.target.value)}
            />
          )}
          <select className={inputCls} value={novoCampoEtapaId} onChange={(e) => setNovoCampoEtapaId(e.target.value)}>
            <option value="">Todas as etapas</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" checked={novoCampoObrigatorio} onChange={(e) => setNovoCampoObrigatorio(e.target.checked)} />
            Obrigatório
          </label>
          <button
            onClick={handleCriarCampo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </section>
    </div>
  );
}
