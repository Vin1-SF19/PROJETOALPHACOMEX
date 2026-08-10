import { useRef, useState } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronsDown, ChevronsUp, FileUp, Italic, Minus, Plus, Underline, X } from "lucide-react";
import { toast } from "sonner";
import type { TextoComponente } from "@/lib/validations/slide-componentes";
import { FONTES_ALPHA_MOTION } from "@/lib/apresentacoes/fontes";
import {
  aplicarEstiloNoIntervaloRichText,
  atualizarRunRichText,
  criarRichTextDoTexto,
  sincronizarRichTextComTexto,
  textoPlanoDoRichText,
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
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [intervalo, setIntervalo] = useState<IntervaloTexto>({ inicio: 0, fim: 0 });
  const [adicionandoFonte, setAdicionandoFonte] = useState(false);
  const [nomeNovaFonte, setNomeNovaFonte] = useState("");
  const [arquivoNovaFonte, setArquivoNovaFonte] = useState<File | null>(null);
  const [enviandoFonte, setEnviandoFonte] = useState(false);
  const { fontesPersonalizadas, adicionarFonte } = useFontesPersonalizadas();
  const runs = componente.richText?.paragraphs.flatMap((paragraph) => paragraph.runs) ?? [];
  const todosEmNegrito = runs.length > 0 ? runs.every((run) => run.bold) : componente.fontWeight === "bold";
  const todosEmItalico = runs.length > 0 ? runs.every((run) => run.italic) : componente.fontStyle === "italic";
  const todosSublinhados = runs.length > 0
    ? runs.every((run) => Boolean(run.underline && run.underline !== "none"))
    : componente.textDecoration?.includes("underline") === true;
  const temTrechoSelecionado = intervalo.fim > intervalo.inicio;

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

  function aplicarEstilo(patchRun: RichRunPatch, patchComponente: Partial<TextoComponente>) {
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
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(intervalo.inicio, intervalo.fim);
    });
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
              <optgroup label="Minhas fontes">
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
              <p className="text-[9px] leading-relaxed text-slate-500">Até 10 MB. A fonte fica disponível em todos os slides e será incluída na apresentação exportada.</p>
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
            type="number"
            min={6}
            max={300}
            value={componente.fontSize ?? 16}
            onChange={(event) => {
              const fontSize = Math.max(6, Math.min(300, Number(event.target.value)));
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
            aplicarEstilo({ bold }, { fontWeight: bold ? "bold" : "normal" });
          }}
        ><Bold size={15} aria-hidden="true" /></BotaoFormato>
        <BotaoFormato
          ativo={todosEmItalico}
          label="Itálico"
          onClick={() => {
            const italic = !todosEmItalico;
            aplicarEstilo({ italic }, { fontStyle: italic ? "italic" : "normal" });
          }}
        ><Italic size={15} aria-hidden="true" /></BotaoFormato>
        <BotaoFormato
          ativo={todosSublinhados}
          label="Sublinhado"
          onClick={() => {
            const underline = todosSublinhados ? "none" : "sng";
            aplicarEstilo({ underline }, { textDecoration: todosSublinhados ? "none" : "underline" });
          }}
        ><Underline size={15} aria-hidden="true" /></BotaoFormato>
      </div>

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
        <label className="text-[11px] text-slate-400">Estilo semântico</label>
        <select value={componente.tag} onChange={(event) => onChange({ tag: event.target.value as TextoComponente["tag"] })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500">
          <option value="h1">Título grande</option>
          <option value="h2">Título</option>
          <option value="p">Parágrafo</option>
          <option value="span">Texto simples</option>
        </select>
      </div>

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
