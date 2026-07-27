"use client";

import { createContext, useContext, useRef, useState } from "react";
import { NodeResizer, Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import {
  corRgbPorId,
  type DadosTextoNode, type DadosStickyNode, type DadosFormaNode, type DadosTelaNode, type DadosLinhaNode,
  type DadosImagemNode, type VarianteForma,
} from "./tipos-node";

/**
 * Handles nas 4 bordas, cada uma funcionando como source E target (permite arrastar uma
 * conexão a partir de qualquer lado e soltar em qualquer lado). Nodes customizados do
 * xyflow NÃO ganham handles automaticamente como o node `type: "default"` nativo — sem
 * este componente em cada node, não é possível criar conectores arrastando das bordas.
 */
function HandlesQuatroLados({ cor, selected }: { cor: string; selected?: boolean }) {
  const estiloHandle = {
    width: 8,
    height: 8,
    background: `rgb(${cor})`,
    border: "1.5px solid rgba(2,6,23,0.8)",
  };
  const classe = selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity";
  return (
    <>
      <Handle className={classe} type="source" position={Position.Top} id="top" style={{ ...estiloHandle, left: "50%" }} />
      <Handle className={classe} type="target" position={Position.Top} id="top-target" style={{ ...estiloHandle, left: "50%" }} />
      <Handle className={classe} type="source" position={Position.Right} id="right" style={{ ...estiloHandle, top: "50%" }} />
      <Handle className={classe} type="target" position={Position.Right} id="right-target" style={{ ...estiloHandle, top: "50%" }} />
      <Handle className={classe} type="source" position={Position.Bottom} id="bottom" style={{ ...estiloHandle, left: "50%" }} />
      <Handle className={classe} type="target" position={Position.Bottom} id="bottom-target" style={{ ...estiloHandle, left: "50%" }} />
      <Handle className={classe} type="source" position={Position.Left} id="left" style={{ ...estiloHandle, top: "50%" }} />
      <Handle className={classe} type="target" position={Position.Left} id="left-target" style={{ ...estiloHandle, top: "50%" }} />
    </>
  );
}

/**
 * Context (não `data.onDataChange`): `data` é serializado direto em `elementsJson`
 * (JSON.stringify no autosave) — se guardássemos a função ali, o autosave quebraria ao
 * tentar serializar uma função, ou perderia o callback ao recarregar do banco. O contexto
 * carrega o callback de fora da árvore de dados persistida.
 *
 * NUNCA usar `useReactFlow().updateNodeData` aqui: ele atualiza o store interno do
 * provider sem disparar `onNodesChange`, então o autosave (que só roda dentro de
 * `handleNodesChange`) nunca seria acionado — edição de texto pareceria funcionar
 * visualmente mas nunca seria persistida.
 */
export const CanvasDataChangeContext = createContext<(nodeId: string, patch: Record<string, unknown>) => void>(() => {});

function useOnDataChange(nodeId: string) {
  const onDataChange = useContext(CanvasDataChangeContext);
  return (patch: Record<string, unknown>) => onDataChange(nodeId, patch);
}

/** Fornece o projectId aos nodes de imagem, que precisam dele para chamar a rota de upload. */
export const CanvasProjectIdContext = createContext<string>("");

function ajustarAltura(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function TextareaInline({
  valor, onChange, className, placeholder, corTexto,
}: {
  valor: string; onChange: (v: string) => void; className?: string; placeholder?: string; corTexto?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        ajustarAltura(el);
      }}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        ajustarAltura(e.target);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`w-full resize-none bg-transparent outline-none placeholder:text-slate-600 overflow-hidden ${className ?? ""}`}
      rows={1}
      style={corTexto ? { color: corTexto } : undefined}
    />
  );
}

// Piso universal de redimensionamento — antes cada tipo tinha um mínimo alto (80-240px)
// que fazia o resize "travar" bem antes do usuário conseguir encolher de verdade.
const MIN_GENERICO = 24;

const TAMANHO_FONTE: Record<string, string> = { sm: "text-xs", md: "text-sm", lg: "text-lg font-medium" };

export function TextoNode({ id, data, selected }: NodeProps<Node<DadosTextoNode>>) {
  const onDataChange = useOnDataChange(id);
  const cor = corRgbPorId(data.cor);
  return (
    <div
      className="group min-w-[60px] px-1 py-0.5 rounded-lg"
      style={selected ? { boxShadow: `0 0 0 1.5px rgba(${cor},0.6)` } : undefined}
    >
      <NodeResizer isVisible={selected} minWidth={MIN_GENERICO} minHeight={MIN_GENERICO} handleStyle={{ background: `rgb(${cor})` }} lineStyle={{ borderColor: `rgb(${cor})` }} />
      <HandlesQuatroLados cor={cor} selected={selected} />
      <TextareaInline
        valor={data.texto}
        onChange={(v) => onDataChange({ texto: v })}
        placeholder="Texto"
        className={`${TAMANHO_FONTE[data.tamanhoFonte ?? "md"]} text-slate-200`}
      />
    </div>
  );
}

export function StickyNode({ id, data, selected }: NodeProps<Node<DadosStickyNode>>) {
  const onDataChange = useOnDataChange(id);
  const cor = corRgbPorId(data.cor ?? "amber");
  return (
    <div
      className="group w-full h-full p-2.5 rounded-xl"
      style={{
        background: `rgba(${cor},0.12)`,
        border: `1px solid rgba(${cor},${selected ? 0.6 : 0.3})`,
      }}
    >
      <NodeResizer isVisible={selected} minWidth={MIN_GENERICO} minHeight={MIN_GENERICO} handleStyle={{ background: `rgb(${cor})` }} lineStyle={{ borderColor: `rgb(${cor})` }} />
      <HandlesQuatroLados cor={cor} selected={selected} />
      <TextareaInline
        valor={data.texto}
        onChange={(v) => onDataChange({ texto: v })}
        placeholder="Observação..."
        className="text-sm h-full"
        corTexto={`rgb(${cor})`}
      />
    </div>
  );
}

/** Formas via `clip-path` real (não rotação de retângulo) para losango/triângulo/hexágono/estrela. */
const CLIP_PATH_VARIANTE: Partial<Record<VarianteForma, string>> = {
  losango: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  triangulo: "polygon(50% 0%, 100% 100%, 0% 100%)",
  hexagono: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  estrela: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  inicioFim: "inset(0% round 999px)",
  entradaSaida: "polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)",
  documento: "polygon(0% 0%, 100% 0%, 100% 85%, 50% 100%, 0% 85%)",
  bancoDados: "inset(8% 0% round 999px 999px 12% 12%)",
};

const CLASSNAME_VARIANTE: Partial<Record<VarianteForma, string>> = {
  retangulo: "rounded-lg",
  circulo: "rounded-full",
  container: "rounded-xl border-dashed",
  conector: "rounded-full",
  subprocesso: "rounded-lg ring-1 ring-inset ring-white/10",
  card: "rounded-2xl shadow-sm",
  input: "rounded-md",
  checkbox: "rounded-md",
  radio: "rounded-full",
  select: "rounded-md",
  navbar: "rounded-lg",
  sidebar: "rounded-lg",
  nota: "rounded-lg",
  alerta: "rounded-lg",
  tag: "rounded-full",
  balao: "rounded-2xl",
  botao: "rounded-full",
  decisao: "", // losango via clip-path
};

/** Ícone/texto padrão exibido dentro da forma quando o label está vazio, por variante. */
const PLACEHOLDER_VARIANTE: Partial<Record<VarianteForma, string>> = {
  decisao: "Decisão?", inicioFim: "Início/Fim", entradaSaida: "Dados", conector: "1",
  documento: "Documento", bancoDados: "Base de dados", subprocesso: "Subprocesso",
  botao: "Botão", input: "Campo de texto", checkbox: "☐ Opção", radio: "○ Opção",
  select: "Selecionar ▾", card: "Card", tabela: "Tabela", navbar: "Navbar", sidebar: "Sidebar",
  nota: "📝 Nota", alerta: "⚠ Alerta", check: "✓", x: "✕",
  numeracao: "1", tag: "tag", balao: "💬 Comentário",
};

function usaClipPath(variante: VarianteForma): boolean {
  return variante in CLIP_PATH_VARIANTE;
}

export function FormaNode({ id, data, selected }: NodeProps<Node<DadosFormaNode>>) {
  const onDataChange = useOnDataChange(id);
  const cor = corRgbPorId(data.cor);
  const variante = data.variante ?? "retangulo";
  const clipPath = CLIP_PATH_VARIANTE[variante];
  const classe = CLASSNAME_VARIANTE[variante] ?? "";
  const placeholder = PLACEHOLDER_VARIANTE[variante] ?? "Elemento";

  return (
    <div className="group w-full h-full min-w-[24px] min-h-[24px] relative">
      <NodeResizer isVisible={selected} minWidth={MIN_GENERICO} minHeight={MIN_GENERICO} handleStyle={{ background: `rgb(${cor})` }} lineStyle={{ borderColor: `rgb(${cor})` }} />
      <HandlesQuatroLados cor={cor} selected={selected} />
      <div
        className={`w-full h-full flex items-center justify-center p-2 ${classe}`}
        style={{
          background: `rgba(${cor},${clipPath ? 0.14 : 0.06})`,
          border: clipPath ? undefined : `1px solid rgba(${cor},${selected ? 0.6 : 0.25})`,
          clipPath,
          filter: selected && clipPath ? `drop-shadow(0 0 0 1.5px rgba(${cor},0.6))` : undefined,
        }}
      >
        <TextareaInline
          valor={data.label}
          onChange={(v) => onDataChange({ label: v })}
          placeholder={placeholder}
          className="text-sm text-center text-slate-300"
        />
      </div>
    </div>
  );
}

export function LinhaNode({ data, selected }: NodeProps<Node<DadosLinhaNode>>) {
  const cor = corRgbPorId(data.cor ?? "slate");
  const vertical = data.orientacao === "vertical";
  const comPonta = !!data.comPonta;

  return (
    <div className="group relative w-full h-full flex items-center justify-center">
      <NodeResizer
        isVisible={selected}
        minWidth={vertical ? 2 : 24}
        minHeight={vertical ? 24 : 2}
        handleStyle={{ background: `rgb(${cor})` }}
        lineStyle={{ borderColor: `rgb(${cor})` }}
      />
      <HandlesQuatroLados cor={cor} selected={selected} />
      <div
        style={{
          background: `rgb(${cor})`,
          width: vertical ? 2 : "100%",
          height: vertical ? "100%" : 2,
          opacity: selected ? 1 : 0.7,
        }}
      />
      {comPonta && (
        <div
          className="absolute"
          style={
            vertical
              ? { bottom: -4, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `8px solid rgb(${cor})`, opacity: selected ? 1 : 0.7 }
              : { right: -4, top: "50%", transform: "translateY(-50%)", width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: `8px solid rgb(${cor})`, opacity: selected ? 1 : 0.7 }
          }
        />
      )}
    </div>
  );
}

export function TelaNode({ id, data, selected }: NodeProps<Node<DadosTelaNode>>) {
  const onDataChange = useOnDataChange(id);
  const cor = corRgbPorId(data.cor);
  const mobile = data.plataforma === "mobile";
  return (
    <div
      className={`group w-full h-full flex flex-col overflow-hidden ${mobile ? "rounded-2xl" : "rounded-xl"}`}
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(${cor},${selected ? 0.6 : 0.15})` }}
    >
      <NodeResizer isVisible={selected} minWidth={mobile ? 60 : 80} minHeight={mobile ? 80 : 60} handleStyle={{ background: `rgb(${cor})` }} lineStyle={{ borderColor: `rgb(${cor})` }} />
      <HandlesQuatroLados cor={cor} selected={selected} />
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60" />
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
        <TextareaInline
          valor={data.nome}
          onChange={(v) => onDataChange({ nome: v })}
          placeholder="Nome da tela"
          className="text-[11px] text-slate-400 ml-1"
        />
      </div>
      <div className="flex-1 flex items-center justify-center text-[10px] text-slate-700">
        {mobile ? "Wireframe mobile" : "Wireframe desktop"}
      </div>
    </div>
  );
}

export function ImagemNode({ id, data, selected }: NodeProps<Node<DadosImagemNode>>) {
  const onDataChange = useOnDataChange(id);
  const projectId = useContext(CanvasProjectIdContext);
  const cor = corRgbPorId(data.cor);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviarImagem(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      const resp = await fetch("/api/blueprint/upload", { method: "POST", body: formData });
      const resultado = await resp.json();
      if (!resp.ok || !resultado.success) {
        toast.error(resultado.error ?? "Erro ao enviar imagem");
        return;
      }
      onDataChange({ url: resultado.file.url, nomeArquivo: resultado.file.originalName });
    } catch {
      toast.error("Erro de conexão ao enviar imagem");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="group w-full h-full min-w-[24px] min-h-[24px] relative">
      <NodeResizer isVisible={selected} minWidth={MIN_GENERICO} minHeight={MIN_GENERICO} handleStyle={{ background: `rgb(${cor})` }} lineStyle={{ borderColor: `rgb(${cor})` }} />
      <HandlesQuatroLados cor={cor} selected={selected} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void enviarImagem(file);
          e.target.value = "";
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
      {data.url ? (
        <div
          className="w-full h-full rounded-lg overflow-hidden relative"
          style={{ boxShadow: selected ? `0 0 0 1.5px rgba(${cor},0.6)` : undefined }}
        >
          <Image src={data.url} alt={data.legenda ?? data.nomeArquivo ?? "Imagem"} fill className="object-cover" />
          <button
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-1 rounded-md bg-slate-950/80 text-slate-200 hover:text-white"
          >
            Substituir
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-1.5 border border-dashed transition-colors"
          style={{ background: `rgba(${cor},0.06)`, borderColor: `rgba(${cor},${selected ? 0.6 : 0.25})` }}
        >
          {enviando ? (
            <Loader2 size={18} className="animate-spin text-slate-400" />
          ) : (
            <ImageIcon size={18} className="text-slate-500" />
          )}
          <span className="text-[11px] text-slate-500">{enviando ? "Enviando..." : "Clique para enviar imagem"}</span>
        </button>
      )}
    </div>
  );
}

export const CANVAS_NODE_TYPES = {
  textoNode: TextoNode,
  stickyNode: StickyNode,
  formaNode: FormaNode,
  telaNode: TelaNode,
  linhaNode: LinhaNode,
  imagemNode: ImagemNode,
};

export { usaClipPath };
