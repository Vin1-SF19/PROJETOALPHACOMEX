"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ListarCatalogoCardKanban,
  ObterConfiguracaoCardKanban,
  SalvarConfiguracaoCardKanban,
} from "@/actions/bpm/CardKanban";
import {
  elementoCardKanbanChaveEstavel,
  type CardKanbanComposicao,
  type CardKanbanElemento,
} from "@/lib/bpm/card-kanban";
import { CardKanbanRenderer, type CardKanbanValores } from "@/components/bpm/kanban/CardKanbanRenderer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CatalogoItem = { chave: string; label: string; elemento: CardKanbanElemento };

function catalogoParaOpcoes(
  nativos: { key: string; label: string }[],
  campos: { campoId: string; label: string }[],
): CatalogoItem[] {
  return [
    ...nativos.map((nativo) => ({
      chave: `native:${nativo.key}`,
      label: nativo.label,
      elemento: { kind: "NATIVE" as const, key: nativo.key as never },
    })),
    ...campos.map((campo) => ({
      chave: `campo:${campo.campoId}`,
      label: campo.label,
      elemento: { kind: "CAMPO" as const, campoId: campo.campoId },
    })),
  ];
}

function valoresDeExemplo(composicao: CardKanbanComposicao, labelsPorChave: Map<string, string>): CardKanbanValores {
  const nativos: CardKanbanValores["nativos"] = {};
  const campos: CardKanbanValores["campos"] = {};
  const camposLabel: CardKanbanValores["camposLabel"] = {};
  for (const elemento of composicao) {
    if (elemento.kind === "NATIVE") {
      nativos[elemento.key] = { status: "ok", valor: "Exemplo" };
    } else {
      campos[elemento.campoId] = { status: "ok", valor: "Exemplo" };
      camposLabel[elemento.campoId] = labelsPorChave.get(`campo:${elemento.campoId}`) ?? "Campo";
    }
  }
  return { nativos, campos, camposLabel };
}

export function CardKanbanWorkspace({
  pipelineId,
  etapaId,
  etapaNome,
}: {
  pipelineId: string;
  etapaId: string;
  etapaNome: string;
}) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [composicao, setComposicao] = useState<CardKanbanComposicao>([]);
  const [versao, setVersao] = useState<number | null>(null);
  const [selecaoParaAdicionar, setSelecaoParaAdicionar] = useState<string>("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const [catalogoResultado, configuracaoResultado] = await Promise.all([
      ListarCatalogoCardKanban(pipelineId, etapaId),
      ObterConfiguracaoCardKanban(pipelineId, etapaId),
    ]);
    if (!catalogoResultado.success) {
      setErro(catalogoResultado.error);
      setCarregando(false);
      return;
    }
    if (!configuracaoResultado.success) {
      setErro(configuracaoResultado.error);
      setCarregando(false);
      return;
    }
    setCatalogo(catalogoParaOpcoes(catalogoResultado.data.nativos, catalogoResultado.data.campos));
    setComposicao(configuracaoResultado.data.composicao);
    setVersao(configuracaoResultado.data.versao);
    setCarregando(false);
  }, [pipelineId, etapaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da composição ao montar
    void carregar();
  }, [carregar]);

  const labelsPorChave = useMemo(() => new Map(catalogo.map((item) => [item.chave, item.label])), [catalogo]);
  const chavesEmUso = useMemo(
    () => new Set(composicao.map((elemento) => elementoCardKanbanChaveEstavel(elemento))),
    [composicao],
  );
  const opcoesDisponiveis = useMemo(
    () => catalogo.filter((item) => !chavesEmUso.has(item.chave)),
    [catalogo, chavesEmUso],
  );

  function moverItem(indice: number, direcao: -1 | 1) {
    setComposicao((atual) => {
      const destino = indice + direcao;
      if (destino < 0 || destino >= atual.length) return atual;
      const proximo = [...atual];
      [proximo[indice], proximo[destino]] = [proximo[destino], proximo[indice]];
      return proximo;
    });
  }

  function removerItem(indice: number) {
    setComposicao((atual) => atual.filter((_, i) => i !== indice));
  }

  function adicionarItem() {
    const item = catalogo.find((candidato) => candidato.chave === selecaoParaAdicionar);
    if (!item) return;
    setComposicao((atual) => [...atual, item.elemento]);
    setSelecaoParaAdicionar("");
  }

  async function salvar() {
    setSalvando(true);
    const resultado = await SalvarConfiguracaoCardKanban({
      pipelineId,
      etapaId,
      versaoEsperada: versao,
      composicao,
    });
    setSalvando(false);
    if (!resultado.success) {
      const mensagem = typeof resultado.error === "string" ? resultado.error : "Payload inválido";
      toast.error(mensagem);
      if (mensagem.startsWith("CONFLITO_VERSAO_CARD_KANBAN")) await carregar();
      return;
    }
    setVersao(resultado.data.versao);
    setComposicao(resultado.data.composicao);
    toast.success(
      resultado.data.alterado ? "Composição do card salva." : "Nenhuma alteração para salvar.",
    );
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
        <Loader2 className="animate-spin" size={16} aria-hidden="true" />
        Carregando composição do card…
      </div>
    );
  }

  if (erro) {
    return <p className="py-8 text-sm text-red-300">{erro}</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-white">Card do Kanban — {etapaNome}</h3>
        <p className="mt-1 text-xs text-slate-400">
          Escolha e ordene os campos exibidos no card fechado desta etapa. Sem seleção, o card mostra
          apenas os controles estruturais (abertura, arrasto, tarefas e anexos).
        </p>
      </div>

      <div className="space-y-2">
        {composicao.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
            Nenhum campo configurado para esta etapa.
          </p>
        )}
        {composicao.map((elemento, indice) => {
          const chave = elementoCardKanbanChaveEstavel(elemento);
          const label = labelsPorChave.get(chave) ?? chave;
          return (
            <div
              key={chave}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <span className="flex-1 text-sm text-slate-200">{label}</span>
              <button
                type="button"
                onClick={() => moverItem(indice, -1)}
                disabled={indice === 0}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                aria-label={`Mover ${label} para cima`}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => moverItem(indice, 1)}
                disabled={indice === composicao.length - 1}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                aria-label={`Mover ${label} para baixo`}
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => removerItem(indice)}
                className="rounded-lg p-1 text-red-300 hover:bg-red-500/10"
                aria-label={`Remover ${label}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Select value={selecaoParaAdicionar} onValueChange={setSelecaoParaAdicionar}>
          <SelectTrigger className="h-9 flex-1 text-sm">
            <SelectValue placeholder="Adicionar campo…" />
          </SelectTrigger>
          <SelectContent>
            {opcoesDisponiveis.map((item) => (
              <SelectItem key={item.chave} value={item.chave}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={adicionarItem}
          disabled={!selecaoParaAdicionar}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40"
        >
          <Plus size={14} aria-hidden="true" />
          Adicionar
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Pré-visualização (dados de exemplo)
        </p>
        <CardKanbanRenderer composicao={composicao} valores={valoresDeExemplo(composicao, labelsPorChave)} />
      </div>

      <button
        type="button"
        onClick={() => void salvar()}
        disabled={salvando}
        className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
      >
        {salvando ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
        Salvar composição
      </button>
    </div>
  );
}
