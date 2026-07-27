"use client";

import { useCallback, useEffect, useState } from "react";
import { X, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { ListarPerguntasBlueprint, CriarPerguntaBlueprint, ResponderPerguntaBlueprint, ResolverPerguntaBlueprint } from "@/actions/BlueprintQuestions";

interface Pergunta {
  id: string;
  question: string;
  answer: string | null;
  status: string;
}

interface QuestionsPanelProps {
  projectId: string;
  accent: string;
  onFechar: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  RESPONDIDA: "Respondida",
  RESOLVIDA: "Resolvida",
  DESCARTADA: "Descartada",
};

export function QuestionsPanel({ projectId, accent, onFechar }: QuestionsPanelProps) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [novaPergunta, setNovaPergunta] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    const res = await ListarPerguntasBlueprint(projectId);
    if (res.success && res.data) setPerguntas(res.data as unknown as Pergunta[]);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function criarPergunta() {
    if (!novaPergunta.trim()) return;
    const res = await CriarPerguntaBlueprint({ projectId, question: novaPergunta.trim() });
    if (res.success) {
      setNovaPergunta("");
      carregar();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao criar pergunta");
    }
  }

  async function responder(questionId: string) {
    const answer = respostas[questionId]?.trim();
    if (!answer) return;
    const res = await ResponderPerguntaBlueprint({ questionId, answer });
    if (res.success) {
      setRespostas((r) => ({ ...r, [questionId]: "" }));
      carregar();
    } else {
      toast.error("Erro ao responder");
    }
  }

  async function resolver(questionId: string) {
    const res = await ResolverPerguntaBlueprint(questionId);
    if (res.success) carregar();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <HelpCircle size={18} />
          Perguntas e dúvidas
        </h2>
        <button onClick={onFechar} className="text-slate-500 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={novaPergunta}
          onChange={(e) => setNovaPergunta(e.target.value)}
          placeholder="Registrar uma nova pergunta..."
          className="flex-1 rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && criarPergunta()}
        />
        <button onClick={criarPergunta} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: `rgba(${accent},0.9)` }}>
          Perguntar
        </button>
      </div>

      <div className="space-y-3">
        {perguntas.map((p) => (
          <div key={p.id} className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-white">{p.question}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-slate-400 shrink-0">
                {STATUS_LABEL[p.status]}
              </span>
            </div>

            {p.answer ? (
              <p className="text-sm text-slate-400 pl-3 border-l-2 border-white/10">{p.answer}</p>
            ) : (
              <div className="flex gap-2">
                <input
                  value={respostas[p.id] ?? ""}
                  onChange={(e) => setRespostas((r) => ({ ...r, [p.id]: e.target.value }))}
                  placeholder="Responder..."
                  className="flex-1 rounded-lg bg-slate-950/60 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none"
                />
                <button onClick={() => responder(p.id)} className="text-xs text-white px-3 py-1.5 rounded-lg" style={{ background: `rgba(${accent},0.9)` }}>
                  Responder
                </button>
              </div>
            )}

            {p.status === "RESPONDIDA" && (
              <button onClick={() => resolver(p.id)} className="text-xs text-slate-500 hover:text-white">
                Marcar como resolvida
              </button>
            )}
          </div>
        ))}
        {perguntas.length === 0 && <p className="text-sm text-slate-500 text-center py-6">Nenhuma pergunta registrada</p>}
      </div>
    </div>
  );
}
