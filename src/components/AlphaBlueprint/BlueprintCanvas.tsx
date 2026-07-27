"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, MiniMap, Controls, addEdge,
  useNodesState, useEdgesState, type Node, type Edge, type Connection, type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Sparkles, FileText } from "lucide-react";
import { ListarBoardsBlueprint, SalvarBoardBlueprint } from "@/actions/BlueprintBoards";
import { CanvasToolbar, type TipoElementoCanvas } from "./CanvasToolbar";
import { CANVAS_NODE_TYPES, CanvasDataChangeContext, CanvasProjectIdContext } from "./canvas/CanvasNodes";
import { CanvasPropertiesPanel } from "./canvas/CanvasPropertiesPanel";
import { GerarLayoutModal } from "./canvas/GerarLayoutModal";
import { GerarPromptPanel } from "./canvas/GerarPromptPanel";
import type { VarianteForma, PlataformaTela, OrientacaoLinha } from "./canvas/tipos-node";

/** Sobrescreve o tema claro padrão do xyflow — sem isso, os ícones de zoom/fit/lock dos
 * Controls ficam escuros sobre fundo escuro e somem visualmente. */
const CANVAS_CSS_VARS: React.CSSProperties = {
  ["--xy-controls-button-background-color-default" as string]: "rgba(15,23,42,0.9)",
  ["--xy-controls-button-background-color-hover-default" as string]: "rgba(30,41,59,0.95)",
  ["--xy-controls-button-color-default" as string]: "#cbd5e1",
  ["--xy-controls-button-color-hover-default" as string]: "#ffffff",
  ["--xy-controls-button-border-color-default" as string]: "rgba(255,255,255,0.1)",
};

const AUTOSAVE_DEBOUNCE_MS = 1500;

interface BlueprintCanvasProps {
  projectId: string;
  accent: string;
}

type StatusSalvamento = "carregando" | "salvo" | "salvando" | "pendente" | "erro";

// Tipos com comportamento especial (não são simplesmente uma variante de formaNode).
const TIPOS_ESPECIAIS = new Set<TipoElementoCanvas>([
  "texto", "sticky", "imagem", "tela-desktop", "tela-mobile",
  "linha-horizontal", "linha-vertical", "seta-horizontal", "seta-vertical",
]);

/** Tamanho inicial por variante — formas de "linha fina" nascem já finas, wireframes maiores. */
const TAMANHO_INICIAL: Partial<Record<VarianteForma, { width: number; height: number }>> = {
  botao: { width: 120, height: 40 },
  input: { width: 200, height: 40 },
  checkbox: { width: 140, height: 28 },
  radio: { width: 140, height: 28 },
  select: { width: 180, height: 40 },
  card: { width: 220, height: 140 },
  tabela: { width: 260, height: 160 },
  navbar: { width: 320, height: 48 },
  sidebar: { width: 160, height: 280 },
  nota: { width: 160, height: 60 },
  alerta: { width: 200, height: 50 },
  check: { width: 40, height: 40 },
  x: { width: 40, height: 40 },
  numeracao: { width: 36, height: 36 },
  tag: { width: 90, height: 32 },
  balao: { width: 180, height: 70 },
  conector: { width: 36, height: 36 },
  inicioFim: { width: 130, height: 50 },
  decisao: { width: 140, height: 100 },
  triangulo: { width: 120, height: 100 },
  hexagono: { width: 130, height: 110 },
  estrela: { width: 120, height: 110 },
};

function criarNode(tipo: TipoElementoCanvas, posicao: { x: number; y: number }): Node {
  const id = crypto.randomUUID();
  const base = { id, position: posicao };

  if (!TIPOS_ESPECIAIS.has(tipo)) {
    const variante = tipo as VarianteForma;
    const tamanho = TAMANHO_INICIAL[variante] ?? { width: 140, height: 90 };
    return {
      ...base,
      type: "formaNode",
      data: { label: "", variante },
      style: tamanho,
    };
  }

  switch (tipo) {
    case "texto":
      return { ...base, type: "textoNode", data: { texto: "" } };
    case "sticky":
      return { ...base, type: "stickyNode", data: { texto: "" }, style: { width: 160, height: 100 } };
    case "imagem":
      return { ...base, type: "imagemNode", data: {}, style: { width: 200, height: 140 } };
    case "tela-desktop":
      return { ...base, type: "telaNode", data: { nome: "Tela", plataforma: "desktop" as PlataformaTela }, style: { width: 320, height: 200 } };
    case "tela-mobile":
      return { ...base, type: "telaNode", data: { nome: "Tela", plataforma: "mobile" as PlataformaTela }, style: { width: 140, height: 260 } };
    case "linha-horizontal":
      return { ...base, type: "linhaNode", data: { orientacao: "horizontal" as OrientacaoLinha }, style: { width: 160, height: 24 } };
    case "linha-vertical":
      return { ...base, type: "linhaNode", data: { orientacao: "vertical" as OrientacaoLinha }, style: { width: 24, height: 160 } };
    case "seta-horizontal":
      return { ...base, type: "linhaNode", data: { orientacao: "horizontal" as OrientacaoLinha, comPonta: true }, style: { width: 160, height: 24 } };
    case "seta-vertical":
      return { ...base, type: "linhaNode", data: { orientacao: "vertical" as OrientacaoLinha, comPonta: true }, style: { width: 24, height: 160 } };
    default:
      return { ...base, type: "formaNode", data: { label: "", variante: "retangulo" as VarianteForma }, style: { width: 140, height: 90 } };
  }
}

export function BlueprintCanvas({ projectId, accent }: BlueprintCanvasProps) {
  const [boardId, setBoardId] = useState<string | undefined>(undefined);
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<StatusSalvamento>("carregando");
  const [selecionado, setSelecionado] = useState<Node | null>(null);
  const [gerarLayoutAberto, setGerarLayoutAberto] = useState(false);
  const [gerarPromptAberto, setGerarPromptAberto] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregouRef = useRef(false);

  useEffect(() => {
    async function carregar() {
      const res = await ListarBoardsBlueprint(projectId);
      if (res.success && res.data && res.data.length > 0) {
        const board = res.data[0];
        setBoardId(board.id);
        setVersion(board.version);
        try {
          const elementos = JSON.parse(board.elementsJson) as { nodes: Node[]; edges: Edge[] };
          setNodes(elementos.nodes ?? []);
          setEdges(elementos.edges ?? []);
        } catch {
          setNodes([]);
          setEdges([]);
        }
      }
      carregouRef.current = true;
      setStatus("salvo");
    }
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const agendarSalvamento = useCallback((novosNodes: Node[], novasEdges: Edge[]) => {
    if (!carregouRef.current) return;
    setStatus("pendente");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setStatus("salvando");
      const elementsJson = JSON.stringify({ nodes: novosNodes, edges: novasEdges });
      const res = await SalvarBoardBlueprint({ projectId, boardId, title: "Canvas Principal", elementsJson, version });
      if (res.success && res.data) {
        setBoardId(res.data.id);
        setVersion(res.data.version);
        setStatus("salvo");
      } else {
        setStatus("erro");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [projectId, boardId, version]);

  function handleNodesChange(changes: Parameters<typeof onNodesChange>[0]) {
    onNodesChange(changes);
    setNodes((atuais) => {
      agendarSalvamento(atuais, edges);
      return atuais;
    });
  }

  function handleEdgesChange(changes: Parameters<typeof onEdgesChange>[0]) {
    onEdgesChange(changes);
    setEdges((atuaisEdges) => {
      setNodes((atuaisNodes) => {
        agendarSalvamento(atuaisNodes, atuaisEdges);
        return atuaisNodes;
      });
      return atuaisEdges;
    });
  }

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const novasEdges = addEdge({ ...connection, type: "smoothstep" }, eds);
      setNodes((atuaisNodes) => {
        agendarSalvamento(atuaisNodes, novasEdges);
        return atuaisNodes;
      });
      return novasEdges;
    });
  }, [agendarSalvamento, setEdges, setNodes]);

  function handleAdicionar(tipo: TipoElementoCanvas) {
    const posicao = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
    const novoNode = criarNode(tipo, posicao);
    setNodes((atuais) => {
      const novos = [...atuais, novoNode];
      agendarSalvamento(novos, edges);
      return novos;
    });
  }

  function aplicarLayoutGerado(novosNodes: Node[], novasEdges: Edge[]) {
    setEdges((atuaisEdges) => {
      const edgesFinais = [...atuaisEdges, ...novasEdges];
      setNodes((atuaisNodes) => {
        const nodesFinais = [...atuaisNodes, ...novosNodes];
        agendarSalvamento(nodesFinais, edgesFinais);
        return nodesFinais;
      });
      return edgesFinais;
    });
  }

  const onSelectionChange = useCallback(({ nodes: selecionados }: OnSelectionChangeParams) => {
    setSelecionado(selecionados.length === 1 ? selecionados[0] : null);
  }, []);

  const handleDataChange = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setEdges((atuaisEdges) => {
      setNodes((atuaisNodes) => {
        const novos = atuaisNodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
        agendarSalvamento(novos, atuaisEdges);
        return novos;
      });
      return atuaisEdges;
    });
    setSelecionado((atual) => (atual && atual.id === nodeId ? { ...atual, data: { ...atual.data, ...patch } } : atual));
  }, [agendarSalvamento, setEdges, setNodes]);

  function atualizarNodeSelecionado(patch: Record<string, unknown>) {
    if (!selecionado) return;
    handleDataChange(selecionado.id, patch);
  }

  function excluirNodeSelecionado() {
    if (!selecionado) return;
    setEdges((atuaisEdges) => {
      const edgesRestantes = atuaisEdges.filter((e) => e.source !== selecionado.id && e.target !== selecionado.id);
      setNodes((atuaisNodes) => {
        const nodesRestantes = atuaisNodes.filter((n) => n.id !== selecionado.id);
        agendarSalvamento(nodesRestantes, edgesRestantes);
        return nodesRestantes;
      });
      return edgesRestantes;
    });
    setSelecionado(null);
  }

  function duplicarNodeSelecionado() {
    if (!selecionado) return;
    const copia: Node = {
      ...selecionado,
      id: crypto.randomUUID(),
      position: { x: selecionado.position.x + 24, y: selecionado.position.y + 24 },
      selected: false,
    };
    setEdges((atuaisEdges) => {
      setNodes((atuaisNodes) => {
        const novos = [...atuaisNodes, copia];
        agendarSalvamento(novos, atuaisEdges);
        return novos;
      });
      return atuaisEdges;
    });
  }

  const nodeTypes = useMemo(() => CANVAS_NODE_TYPES, []);

  return (
    <div className="relative h-[calc(100vh-180px)] rounded-2xl border border-white/5 overflow-hidden bg-[#020617]">
      <CanvasToolbar onAdicionar={handleAdicionar} accent={accent} />

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {!selecionado && <StatusIndicator status={status} accent={accent} />}
        <button
          onClick={() => setGerarPromptAberto(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full text-white shadow-lg border border-white/10 bg-slate-900/90 hover:bg-slate-800/90 transition-colors"
        >
          <FileText size={13} />
          Gerar prompt
        </button>
        <button
          onClick={() => setGerarLayoutAberto(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full text-white shadow-lg"
          style={{ background: `rgba(${accent},0.9)` }}
        >
          <Sparkles size={13} />
          Gerar com IA
        </button>
      </div>

      {selecionado && (
        <CanvasPropertiesPanel
          node={selecionado}
          onAtualizar={atualizarNodeSelecionado}
          onExcluir={excluirNodeSelecionado}
          onDuplicar={duplicarNodeSelecionado}
        />
      )}

      <GerarLayoutModal
        open={gerarLayoutAberto}
        onOpenChange={setGerarLayoutAberto}
        projectId={projectId}
        accent={accent}
        onAplicar={aplicarLayoutGerado}
      />

      {gerarPromptAberto && (
        <GerarPromptPanel projectId={projectId} accent={accent} onFechar={() => setGerarPromptAberto(false)} />
      )}

      <CanvasProjectIdContext.Provider value={projectId}>
      <CanvasDataChangeContext.Provider value={handleDataChange}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          fitView
          proOptions={{ hideAttribution: true }}
          style={CANVAS_CSS_VARS}
        >
          <Background gap={20} color="rgba(255,255,255,0.04)" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            maskColor="rgba(2,6,23,0.8)"
            style={{ background: "rgba(2,6,23,0.9)" }}
            nodeColor={() => `rgba(${accent},0.4)`}
          />
        </ReactFlow>
      </CanvasDataChangeContext.Provider>
      </CanvasProjectIdContext.Provider>

      {selecionado && (
        <div className="absolute bottom-3 right-3 z-10">
          <StatusIndicator status={status} accent={accent} />
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ status, accent }: { status: StatusSalvamento; accent: string }) {
  const config: Record<StatusSalvamento, { texto: string; cor: string }> = {
    carregando: { texto: "Carregando...", cor: "148,163,184" },
    salvando: { texto: "Salvando...", cor: accent },
    salvo: { texto: "Salvo", cor: "52,211,153" },
    pendente: { texto: "Alterações pendentes", cor: "251,191,36" },
    erro: { texto: "Erro ao salvar", cor: "248,113,113" },
  };
  const { texto, cor } = config[status];
  return (
    <span
      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-950/90 backdrop-blur-xl border border-white/10"
      style={{ color: `rgb(${cor})` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: `rgb(${cor})` }} />
      {texto}
    </span>
  );
}
