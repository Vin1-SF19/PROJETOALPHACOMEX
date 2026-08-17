import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronsDown, ChevronsUp, FileUp, Italic, Link2, Minus, Plus, Underline, X } from "lucide-react";
import { toast } from "sonner";
import type { TextoComponente } from "@/lib/validations/slide-componentes";
import { FONTES_ALPHA_MOTION } from "@/lib/apresentacoes/fontes";
import {
  aplicarEstiloNoIntervaloRichText,
  aplicarPropriedadeParagrafo,
  atualizarRunRichText,
  criarRichTextDoTexto,
  removerListaDoRichText,
  richTextTemLista,
  sincronizarRichTextComTexto,
  textoPlanoDoRichText,
  type RichParagraphPatch,
  type RichRunPatch,
} from "@/lib/apresentacoes/rich-text-edit";
import { useFontesPersonalizadas } from "../../FontesPersonalizadasContext";

interface IntervaloTexto {
  inicio: number;
  fim: number;
}

function estiloBase(componente: TextoComponente): RichRunPatch {
  return {
    color: componente.corTexto,
    fontFamily: componente.fontFamily,
    fontSize: componente.fontSize,
    bold: componente.fontWeight === "bold",
    italic: componente.fontStyle === "italic",
    underline: componente.textDecoration?.includes("underline") ? "sng" : "none",
  };
}

/** Preset de tamanho/peso aplicado ao trocar o "Estilo semântico" — sem isso, trocar H1↔Parágrafo
 * só mudava a tag HTML invisível, sem nenhum efeito visual perceptível (bug relatado pelo usuário). */
const PRESET_ESTILO_SEMANTICO: Record<TextoComponente["tag"], { fontSize: number; fontWeight: "normal" | "bold" }> = {
  h1: { fontSize: 44, fontWeight: "bold" },
  h2: { fontSize: 32, fontWeight: "bold" },
  p: { fontSize: 18, fontWeight: "normal" },
  span: { fontSize: 14, fontWeight: "normal" },
};

function BotaoFormato({ ativo, label, onClick, children }: { ativo: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      aria-label={label}
      title={label}
      className={`flex size-9 cursor-pointer items-center justify-center rounded-lg border ${ativo ? "border-indigo-400 bg-indigo-500/20 text-indigo-200" : "border-white/10 bg-slate-900 text-slate-400 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

export function TextoProps({ componente, onChange }: { componente: TextoComponente; onChange: (patch: Partial<TextoComponente>) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputTamanhoRef = useRef<HTMLInputElement>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [intervalo, setIntervalo] = useState<IntervaloTexto>({ inicio: 0, fim: 0 });
  const [adicionandoFonte, setAdicionandoFonte] = useState(false);
  const [nomeNovaFonte, setNomeNovaFonte] = useState("");
  const [arquivoNovaFonte, setArquivoNovaFonte] = useState<File | null>(null);
  const [enviandoFonte, setEnviandoFonte] = useState(false);
  const [tamanhoDigitado, setTamanhoDigitado] = useState(String(componente.fontSize ?? 16));
  const [editandoLink, setEditandoLink] = useState(false);
  const [urlDigitada, setUrlDigitada] = useState("");
  const { fontesPersonalizadas, adicionarFonte } = useFontesPersonalizadas();
  const runs = componente.richText?.paragraphs.flatMap((paragraph) => paragraph.runs) ?? [];
  const todosEmNegrito = runs.length > 0 ? runs.every((run) => run.bold) : componente.fontWeight === "bold";
  const todosEmItalico = runs.length > 0 ? runs.every((run) => run.italic) : componente.fontStyle === "italic";
  const todosSublinhados = runs.length > 0
    ? runs.every((run) => Boolean(run.underline && run.underline !== "none"))
    : componente.textDecoration?.includes("underline") === true;
  const temTrechoSelecionado = intervalo.fim > intervalo.inicio;
  const linkDoTrechoAtual = (() => {
    if (runs.length === 0) return undefined;
    if (!temTrechoSelecionado) return runs.find((run) => run.hyperlink)?.hyperlink;
    let cursor = 0;
    for (const run of runs) {
      const inicioRun = cursor;
      const fimRun = cursor + run.text.length;
      cursor = fimRun;
      if (inicioRun < intervalo.fim && fimRun > intervalo.inicio) return run.hyperlink;
    }
    return undefined;
  })();

  function atualizarSelecao() {
    const campo = textareaRef.current;
    if (!campo) return;
    setIntervalo({ inicio: campo.selectionStart, fim: campo.selectionEnd });
  }

  function atualizarTexto(texto: string) {
    onChange({
      texto,
      ...(componente.richText ? { richText: sincronizarRichTextComTexto(componente.richText, texto) } : {}),
    });
  }

  useEffect(() => {
    if (document.activeElement !== inputTamanhoRef.current) {
      setTamanhoDigitado(String(componente.fontSize ?? 16));
    }
  }, [componente.fontSize]);

  function aplicarEstilo(
    patchRun: RichRunPatch,
    patchComponente: Partial<TextoComponente>,
    restaurarSelecao = false,
  ) {
    const richTextBase = componente.richText ?? criarRichTextDoTexto(componente.texto, estiloBase(componente));
    const inicio = temTrechoSelecionado ? intervalo.inicio : 0;
    const fim = temTrechoSelecionado ? intervalo.fim : componente.texto.length;
    const richText = aplicarEstiloNoIntervaloRichText(richTextBase, inicio, fim, patchRun);
    const abrangeTudo = inicio === 0 && fim === componente.texto.length;
    onChange({
      ...(abrangeTudo ? patchComponente : {}),
      richText,
      texto: textoPlanoDoRichText(richText),
    });
    if (restaurarSelecao) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(intervalo.inicio, intervalo.fim);
      });
    }
  }

  function aplicarAlinhamento(alinhamento: NonNullable<TextoComponente["alinhamento"]>) {
    onChange({
      alinhamento,
      ...(componente.richText
        ? { richText: { paragraphs: componente.richText.paragraphs.map((paragraph) => ({ ...paragraph, alignment: alinhamento })) } }
        : {}),
    });
  }

  function editarRun(paragraphIndex: number, runIndex: number, patch: Parameters<typeof atualizarRunRichText>[3]) {
    if (!componente.richText) return;
    const richText = atualizarRunRichText(componente.richText, paragraphIndex, runIndex, patch);
    onChange({ richText, texto: textoPlanoDoRichText(richText) });
  }

  /** Espaçamento de parágrafo estilo Word (espaço antes/depois, recuo, margem) — aplica a
   * TODOS os parágrafos, mesmo padrão de "Altura da linha"/"Espaço entre letras" (globais). */
  function aplicarParagrafo(patch: RichParagraphPatch) {
    const richTextBase = componente.richText ?? criarRichTextDoTexto(componente.texto, estiloBase(componente));
    const richText = aplicarPropriedadeParagrafo(richTextBase, patch);
    onChange({ richText, texto: textoPlanoDoRichText(richText) });
  }
  const paragrafoAtual = componente.richText?.paragraphs[0];

  const categorias = Array.from(new Set(FONTES_ALPHA_MOTION.map((fonte) => fonte.categoria)));
  const fonteAtual = componente.fontFamily ?? "Inter";
  const fonteAtualEstaNoCatalogo = FONTES_ALPHA_MOTION.some((fonte) => fonte.nome === fonteAtual)
    || fontesPersonalizadas.some((fonte) => fonte.nome === fonteAtual);

  async function handleAdicionarFonte() {
    if (!arquivoNovaFonte || !nomeNovaFonte.trim() || enviandoFonte) return;
    setEnviandoFonte(true);
    try {
      const fonte = await adicionarFonte(nomeNovaFonte.trim(), arquivoNovaFonte);
      aplicarEstilo({ fontFamily: fonte.nome }, { fontFamily: fonte.nome });
      toast.success(`Fonte "${fonte.nome}" adicionada e aplicada.`);
      setNomeNovaFonte("");
      setArquivoNovaFonte(null);
      if (inputArquivoRef.current) inputArquivoRef.current.value = "";
      setAdicionandoFonte(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar a fonte.");
    } finally {
      setEnviandoFonte(false);
    }
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] text-slate-400" htmlFor={`texto-${componente.id}`}>Texto</label>
          <span className={`rounded px-1.5 py-0.5 text-[9px] ${temTrechoSelecionado ? "bg-cyan-500/15 text-cyan-200" : "bg-white/5 text-slate-500"}`}>
            {temTrechoSelecionado ? `${intervalo.fim - intervalo.inicio} caracteres selecionados` : "Sem seleção: aplica ao texto inteiro"}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          id={`texto-${componente.id}`}
          value={componente.texto}
          onChange={(event) => atualizarTexto(event.target.value)}
          onSelect={atualizarSelecao}
          onKeyUp={atualizarSelecao}
          onMouseUp={atualizarSelecao}
          className="h-24 w-full resize-y rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
        <p className="text-[10px] leading-relaxed text-slate-600">Selecione um trecho acima e use fonte, tamanho, cor ou estilo. Sem seleção, a mudança vale para todo o texto.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`fonte-${componente.id}`} className="text-[11px] text-slate-400">Fonte</label>
            <button
              type="button"
              onClick={() => setAdicionandoFonte((aberto) => !aberto)}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-500/20"
            >
              {adicionandoFonte ? <X size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
              {adicionandoFonte ? "Fechar" : "Adicionar fonte"}
            </button>
          </div>
          <select
            id={`fonte-${componente.id}`}
            value={fonteAtual}
            onChange={(event) => aplicarEstilo({ fontFamily: event.target.value }, { fontFamily: event.target.value })}
            style={{ fontFamily: `"${fonteAtual}", sans-serif` }}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          >
            {!fonteAtualEstaNoCatalogo && <option value={fonteAtual}>{fonteAtual} (importada)</option>}
            {categorias.map((categoria) => (
              <optgroup key={categoria} label={categoria}>
                {FONTES_ALPHA_MOTION.filter((fonte) => fonte.categoria === categoria).map((fonte) => (
                  <option key={fonte.nome} value={fonte.nome} style={{ fontFamily: `"${fonte.nome}", sans-serif` }}>{fonte.nome}</option>
                ))}
              </optgroup>
            ))}
            {fontesPersonalizadas.length > 0 && (
              <optgroup label="Fontes globais">
                {fontesPersonalizadas.map((fonte) => (
                  <option key={fonte.id} value={fonte.nome} style={{ fontFamily: `"${fonte.nome}", sans-serif` }}>{fonte.nome}</option>
                ))}
              </optgroup>
            )}
          </select>
          {adicionandoFonte && (
            <div className="space-y-2 rounded-lg border border-indigo-400/20 bg-indigo-950/20 p-2.5">
              <label className="block space-y-1">
                <span className="text-[10px] font-medium text-slate-300">Nome da fonte</span>
                <input
                  type="text"
                  maxLength={80}
                  value={nomeNovaFonte}
                  onChange={(event) => setNomeNovaFonte(event.target.value)}
                  placeholder="Ex.: Fonte da minha marca"
                  className="w-full rounded-md border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-indigo-500"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-white/15 bg-slate-950/70 px-2.5 py-2 text-xs text-slate-400 hover:border-indigo-400/50 hover:text-slate-200">
                <FileUp size={15} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{arquivoNovaFonte?.name ?? "Escolher WOFF2, WOFF, TTF ou OTF"}</span>
                <input
                  ref={inputArquivoRef}
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                  className="sr-only"
                  onChange={(event) => {
                    const arquivo = event.target.files?.[0] ?? null;
                    setArquivoNovaFonte(arquivo);
                    if (arquivo && !nomeNovaFonte.trim()) setNomeNovaFonte(arquivo.name.replace(/\.[^.]+$/, ""));
                  }}
                />
              </label>
              <p className="text-[9px] leading-relaxed text-slate-500">Até 10 MB. A fonte fica disponível globalmente para todos os usuários e nas apresentações exportadas.</p>
              <button
                type="button"
                onClick={() => void handleAdicionarFonte()}
                disabled={!arquivoNovaFonte || !nomeNovaFonte.trim() || enviandoFonte}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileUp size={14} aria-hidden="true" />
                {enviandoFonte ? "Enviando..." : "Adicionar e aplicar"}
              </button>
            </div>
          )}
        </div>
        <label className="space-y-1.5">
          <span className="text-[11px] text-slate-400">Tamanho (px)</span>
          <input
            ref={inputTamanhoRef}
            type="number"
            min={6}
            max={300}
            value={tamanhoDigitado}
            onChange={(event) => {
              const proximo = event.target.value;
              setTamanhoDigitado(proximo);
              const fontSize = Number(proximo);
              if (Number.isFinite(fontSize) && fontSize >= 6 && fontSize <= 300) {
                aplicarEstilo({ fontSize }, { fontSize });
              }
            }}
            onBlur={() => {
              const fontSize = Math.max(6, Math.min(300, Number(tamanhoDigitado) || 16));
              setTamanhoDigitado(String(fontSize));
              aplicarEstilo({ fontSize }, { fontSize });
            }}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] text-slate-400">Cor</span>
          <input
            type="color"
            value={componente.corTexto ?? "#ffffff"}
            onChange={(event) => aplicarEstilo({ color: event.target.value }, { corTexto: event.target.value })}
            className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-slate-900"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Formatação do texto ou trecho selecionado">
        <BotaoFormato
          ativo={todosEmNegrito}
          label="Negrito"
          onClick={() => {
            const bold = !todosEmNegrito;
            aplicarEstilo({ bold }, { fontWeight: bold ? "bold" : "normal" }, true);
          }}
        ><Bold size={15} aria-hidden="true" /></BotaoFormato>
        <BotaoFormato
          ativo={todosEmItalico}
          label="Itálico"
          onClick={() => {
            const italic = !todosEmItalico;
            aplicarEstilo({ italic }, { fontStyle: italic ? "italic" : "normal" }, true);
          }}
        ><Italic size={15} aria-hidden="true" /></BotaoFormato>
        <BotaoFormato
          ativo={todosSublinhados}
          label="Sublinhado"
          onClick={() => {
            const underline = todosSublinhados ? "none" : "sng";
            aplicarEstilo({ underline }, { textDecoration: todosSublinhados ? "none" : "underline" }, true);
          }}
        ><Underline size={15} aria-hidden="true" /></BotaoFormato>
        <BotaoFormato
          ativo={Boolean(linkDoTrechoAtual)}
          label="Link"
          onClick={() => {
            setUrlDigitada(linkDoTrechoAtual ?? "");
            setEditandoLink((aberto) => !aberto);
          }}
        ><Link2 size={15} aria-hidden="true" /></BotaoFormato>
      </div>

      {editandoLink && (
        <div className="space-y-2 rounded-lg border border-indigo-400/20 bg-indigo-950/20 p-2.5">
          <label className="block space-y-1">
            <span className="text-[10px] font-medium text-slate-300">
              {temTrechoSelecionado ? "Link do trecho selecionado" : "Link do texto inteiro"}
            </span>
            <input
              type="url"
              value={urlDigitada}
              onChange={(event) => setUrlDigitada(event.target.value)}
              placeholder="https://exemplo.com"
              className="w-full rounded-md border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-indigo-500"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                aplicarEstilo({ hyperlink: urlDigitada.trim() || undefined }, {}, true);
                setEditandoLink(false);
              }}
              className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Aplicar
            </button>
            {linkDoTrechoAtual && (
              <button
                type="button"
                onClick={() => {
                  aplicarEstilo({ hyperlink: undefined }, {}, true);
                  setEditandoLink(false);
                }}
                className="rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <span className="text-[11px] text-slate-400">Alinhamento no componente</span>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1" role="group" aria-label="Alinhamento horizontal">
            {([
              ["left", AlignLeft, "Alinhar à esquerda"],
              ["center", AlignCenter, "Centralizar horizontalmente"],
              ["right", AlignRight, "Alinhar à direita"],
              ["justify", AlignJustify, "Justificar texto"],
            ] as const).map(([valor, Icone, label]) => (
              <button key={valor} type="button" onClick={() => aplicarAlinhamento(valor)} aria-label={label} aria-pressed={(componente.alinhamento ?? "left") === valor} className={`flex size-9 cursor-pointer items-center justify-center rounded-lg border ${(componente.alinhamento ?? "left") === valor ? "border-indigo-400 bg-indigo-500/20 text-indigo-200" : "border-white/10 bg-slate-900 text-slate-400"}`}>
                <Icone size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Alinhamento vertical">
            {([
              ["top", ChevronsUp, "Alinhar ao topo"],
              ["middle", Minus, "Centralizar verticalmente"],
              ["bottom", ChevronsDown, "Alinhar à base"],
            ] as const).map(([valor, Icone, label]) => (
              <button key={valor} type="button" onClick={() => onChange({ verticalAlign: valor })} aria-label={label} aria-pressed={(componente.verticalAlign ?? "top") === valor} className={`flex size-9 cursor-pointer items-center justify-center rounded-lg border ${(componente.verticalAlign ?? "top") === valor ? "border-indigo-400 bg-indigo-500/20 text-indigo-200" : "border-white/10 bg-slate-900 text-slate-400"}`}>
                <Icone size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1.5">
          <span className="text-[11px] text-slate-400">Altura da linha</span>
          <input type="number" min={0.7} max={4} step={0.1} value={componente.lineHeight ?? 1.2} onChange={(event) => onChange({ lineHeight: Math.max(0.7, Number(event.target.value)) })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] text-slate-400">Espaço entre letras</span>
          <input type="number" min={-10} max={50} step={0.5} value={componente.letterSpacing ?? 0} onChange={(event) => onChange({ letterSpacing: Number(event.target.value) })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
        </label>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] text-slate-400">Espaçamento de parágrafo</span>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] text-slate-500">Antes (px)</span>
            <input
              type="number"
              min={0}
              max={200}
              step={1}
              value={paragrafoAtual?.spaceBefore ?? 0}
              onChange={(event) => aplicarParagrafo({ spaceBefore: Math.max(0, Number(event.target.value)) })}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-slate-500">Depois (px)</span>
            <input
              type="number"
              min={0}
              max={200}
              step={1}
              value={paragrafoAtual?.spaceAfter ?? 0}
              onChange={(event) => aplicarParagrafo({ spaceAfter: Math.max(0, Number(event.target.value)) })}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-slate-500">Recuo primeira linha (px)</span>
            <input
              type="number"
              min={-200}
              max={200}
              step={1}
              value={paragrafoAtual?.indent ?? 0}
              onChange={(event) => aplicarParagrafo({ indent: Number(event.target.value) })}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-slate-500">Margem esquerda (px)</span>
            <input
              type="number"
              min={0}
              max={400}
              step={1}
              value={paragrafoAtual?.marginLeft ?? 0}
              onChange={(event) => aplicarParagrafo({ marginLeft: Math.max(0, Number(event.target.value)) })}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-600">Aplica a todos os parágrafos do texto — igual ao espaçamento do Word.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Estilo semântico</label>
        <select
          value={componente.tag}
          onChange={(event) => {
            const tag = event.target.value as TextoComponente["tag"];
            const preset = PRESET_ESTILO_SEMANTICO[tag];
            setTamanhoDigitado(String(preset.fontSize));
            aplicarEstilo(
              { fontSize: preset.fontSize, bold: preset.fontWeight === "bold" },
              { tag, fontSize: preset.fontSize, fontWeight: preset.fontWeight },
            );
          }}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="h1">Título grande</option>
          <option value="h2">Título</option>
          <option value="p">Parágrafo</option>
          <option value="span">Texto simples</option>
        </select>
        <p className="text-[10px] leading-relaxed text-slate-600">Aplica um tamanho e peso padrão junto com o estilo — ajuste fino continua disponível nos campos acima.</p>
      </div>

      {richTextTemLista(componente.richText) && (
        <button
          type="button"
          onClick={() => {
            if (!componente.richText) return;
            const richText = removerListaDoRichText(componente.richText);
            onChange({ richText, texto: textoPlanoDoRichText(richText) });
          }}
          className="w-full rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
        >
          Remover marcador/numeração da lista
        </button>
      )}

      {componente.richText && (
        <details className="group rounded-lg border border-white/10 bg-slate-950/40">
          <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-slate-300">Runs avançados ({runs.length})</summary>
          <div className="space-y-2 border-t border-white/10 p-2">
            {componente.richText.paragraphs.flatMap((paragraph, paragraphIndex) => paragraph.runs.map((run, runIndex) => (
              <div key={`${paragraphIndex}-${runIndex}`} className="flex items-start gap-1 rounded-md bg-slate-900/80 p-1.5">
                <textarea value={run.text} rows={1} onChange={(event) => editarRun(paragraphIndex, runIndex, { text: event.target.value })} aria-label={`Trecho ${runIndex + 1} do parágrafo ${paragraphIndex + 1}`} className="min-h-8 min-w-0 flex-1 resize-y rounded border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500" />
                <input type="color" value={run.color ?? componente.corTexto ?? "#ffffff"} onChange={(event) => editarRun(paragraphIndex, runIndex, { color: event.target.value })} aria-label={`Cor do trecho ${runIndex + 1}`} className="size-7 rounded border border-white/10 bg-transparent" />
              </div>
            )))}
          </div>
        </details>
      )}
    </>
  );
}
