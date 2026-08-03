"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Settings2, ArrowRight } from "lucide-react";
import type { TemaAlpha } from "@/lib/temas";
import { CriarPipelineBpm, ListarSetoresParaPipelineBpm } from "@/actions/bpm/Pipelines";

type Pipeline = {
  id: string;
  nome: string;
  ativo: boolean;
  setores: { setor: { id: number; nome: string } }[];
  _count: { cards: number; etapas: number };
};

type Setor = Awaited<ReturnType<typeof ListarSetoresParaPipelineBpm>>["data"][number];

interface Props {
  pipelines: Pipeline[];
  setores: Setor[];
  visual: TemaAlpha;
}

const inputCls = "bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

export default function AdminPipelinesListClient({ pipelines, setores, visual }: Props) {
  const accent = visual.accent;
  const router = useRouter();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nome, setNome] = useState("");
  const [setorIds, setSetorIds] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);

  function toggleSetor(id: number) {
    setSetorIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleCriar() {
    if (!nome.trim() || setorIds.length === 0) {
      toast.error("Informe o nome e selecione ao menos um setor");
      return;
    }
    setSalvando(true);
    const res = await CriarPipelineBpm({ nome: nome.trim(), setorIds });
    setSalvando(false);
    if (res.success) {
      toast.success("Pipeline criado");
      setNome("");
      setSetorIds([]);
      setMostrarForm(false);
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao criar pipeline");
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white mb-1">Configurações</h1>
          <p className="text-sm text-slate-400">Administração central de pipelines.</p>
        </div>
        <button
          onClick={() => setMostrarForm((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: `rgba(${accent},0.85)` }}
        >
          <Plus size={15} /> Novo Pipeline
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 space-y-3">
          <input
            className={`${inputCls} w-full`}
            placeholder="Nome do pipeline"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <div>
            <p className="text-xs text-slate-400 mb-1.5">Setores</p>
            <div className="flex flex-wrap gap-1.5">
              {setores.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSetor(s.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={
                    setorIds.includes(s.id)
                      ? { background: `rgba(${accent},0.2)`, color: `rgb(${accent})` }
                      : { background: "rgba(255,255,255,0.05)", color: "#94a3b8" }
                  }
                >
                  {s.nome}
                </button>
              ))}
              {setores.length === 0 && <p className="text-xs text-slate-600">Nenhum setor cadastrado.</p>}
            </div>
          </div>
          <button
            onClick={handleCriar}
            disabled={salvando}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            {salvando ? "Criando..." : "Criar pipeline"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {pipelines.map((pipeline) => (
          <Link
            key={pipeline.id}
            href={`/PainelAlpha/AlphaCRM/admin/pipelines/${pipeline.id}`}
            className="flex items-center justify-between gap-3 bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 hover:border-white/15 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `rgba(${accent},0.15)` }}
              >
                <Settings2 size={16} style={{ color: `rgb(${accent})` }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  {pipeline.nome}
                  {!pipeline.ativo && (
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                      Inativo
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {pipeline.setores.map((s) => s.setor.nome).join(", ") || "Sem setor vinculado"}
                  {" · "}
                  {pipeline._count.cards} card(s) · {pipeline._count.etapas} etapa(s)
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="text-slate-600 shrink-0" />
          </Link>
        ))}
        {pipelines.length === 0 && <p className="text-sm text-slate-600">Nenhum pipeline configurado ainda.</p>}
      </div>
    </div>
  );
}
