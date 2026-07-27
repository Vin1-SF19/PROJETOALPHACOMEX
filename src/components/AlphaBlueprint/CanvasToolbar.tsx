"use client";

import {
  Type, Square, Circle, Diamond, Frame, StickyNote, Monitor, Smartphone, Minus, ArrowRight,
  Triangle, Hexagon, Star, CircleDot, FileText, Database, Layers,
  RectangleHorizontal, CheckSquare, Circle as RadioIcon, ChevronDown, CreditCard, Table,
  PanelTop, PanelLeft, ImageIcon, StickyNote as NotaIcon, AlertTriangle, Check, X, Hash, Tag as TagIcon, MessageSquare,
} from "lucide-react";
import type { VarianteForma } from "./canvas/tipos-node";

export type TipoElementoCanvas =
  | "texto" | "sticky" | "container" | "imagem"
  | VarianteForma
  | "linha-horizontal" | "linha-vertical" | "seta-horizontal" | "seta-vertical"
  | "tela-desktop" | "tela-mobile";

interface Ferramenta {
  tipo: TipoElementoCanvas;
  icon: typeof Type;
  label: string;
}

interface Categoria {
  nome: string;
  ferramentas: Ferramenta[];
  abertaPorPadrao?: boolean;
}

const CATEGORIAS: Categoria[] = [
  {
    nome: "Básicos",
    abertaPorPadrao: true,
    ferramentas: [
      { tipo: "texto", icon: Type, label: "Texto" },
      { tipo: "sticky", icon: StickyNote, label: "Sticky note" },
      { tipo: "container", icon: Frame, label: "Container / Frame" },
      { tipo: "imagem", icon: ImageIcon, label: "Imagem (upload)" },
    ],
  },
  {
    nome: "Linhas",
    ferramentas: [
      { tipo: "linha-horizontal", icon: Minus, label: "Linha reta (horizontal)" },
      { tipo: "linha-vertical", icon: Minus, label: "Linha reta (vertical)" },
      { tipo: "seta-horizontal", icon: ArrowRight, label: "Seta (horizontal)" },
      { tipo: "seta-vertical", icon: ArrowRight, label: "Seta (vertical)" },
    ],
  },
  {
    nome: "Formas",
    ferramentas: [
      { tipo: "retangulo", icon: Square, label: "Retângulo" },
      { tipo: "circulo", icon: Circle, label: "Círculo" },
      { tipo: "losango", icon: Diamond, label: "Losango" },
      { tipo: "triangulo", icon: Triangle, label: "Triângulo" },
      { tipo: "hexagono", icon: Hexagon, label: "Hexágono" },
      { tipo: "estrela", icon: Star, label: "Estrela" },
    ],
  },
  {
    nome: "Fluxograma",
    ferramentas: [
      { tipo: "inicioFim", icon: CircleDot, label: "Início/Fim" },
      { tipo: "decisao", icon: Diamond, label: "Decisão" },
      { tipo: "entradaSaida", icon: RectangleHorizontal, label: "Entrada/Saída" },
      { tipo: "conector", icon: Circle, label: "Conector" },
      { tipo: "documento", icon: FileText, label: "Documento" },
      { tipo: "bancoDados", icon: Database, label: "Banco de Dados" },
      { tipo: "subprocesso", icon: Layers, label: "Subprocesso" },
    ],
  },
  {
    nome: "Wireframe",
    ferramentas: [
      { tipo: "botao", icon: RectangleHorizontal, label: "Botão" },
      { tipo: "input", icon: Type, label: "Campo de texto" },
      { tipo: "checkbox", icon: CheckSquare, label: "Checkbox" },
      { tipo: "radio", icon: RadioIcon, label: "Radio button" },
      { tipo: "select", icon: ChevronDown, label: "Select" },
      { tipo: "card", icon: CreditCard, label: "Card" },
      { tipo: "tabela", icon: Table, label: "Tabela" },
      { tipo: "navbar", icon: PanelTop, label: "Navbar" },
      { tipo: "sidebar", icon: PanelLeft, label: "Sidebar" },
    ],
  },
  {
    nome: "Anotações",
    ferramentas: [
      { tipo: "nota", icon: NotaIcon, label: "Nota" },
      { tipo: "alerta", icon: AlertTriangle, label: "Alerta" },
      { tipo: "check", icon: Check, label: "Check" },
      { tipo: "x", icon: X, label: "Rejeitado" },
      { tipo: "numeracao", icon: Hash, label: "Numeração" },
      { tipo: "tag", icon: TagIcon, label: "Tag" },
      { tipo: "balao", icon: MessageSquare, label: "Balão de comentário" },
    ],
  },
  {
    nome: "Telas",
    ferramentas: [
      { tipo: "tela-desktop", icon: Monitor, label: "Tela desktop" },
      { tipo: "tela-mobile", icon: Smartphone, label: "Tela mobile" },
    ],
  },
];

interface CanvasToolbarProps {
  onAdicionar: (tipo: TipoElementoCanvas) => void;
  accent: string;
}

export function CanvasToolbar({ onAdicionar, accent }: CanvasToolbarProps) {
  return (
    <div className="absolute top-3 left-3 z-10 w-56 max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-950/90 backdrop-blur-xl shadow-xl">
      {CATEGORIAS.map((categoria) => (
        <details key={categoria.nome} open={categoria.abertaPorPadrao} className="border-b border-white/5 last:border-b-0">
          <summary className="px-3 py-2 text-[11px] font-medium text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors">
            {categoria.nome}
          </summary>
          <div className="grid grid-cols-5 gap-0.5 p-1.5 pt-0.5">
            {categoria.ferramentas.map(({ tipo, icon: Icon, label }) => (
              <button
                key={tipo}
                onClick={() => onAdicionar(tipo)}
                title={label}
                className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center"
                onMouseEnter={(e) => (e.currentTarget.style.background = `rgba(${accent},0.15)`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </details>
      ))}
      <div className="px-3 py-2 text-[10px] text-slate-600 flex items-center gap-1 border-t border-white/5">
        <ArrowRight size={11} /> conecte arrastando das bordas
      </div>
    </div>
  );
}
