import { ReactFlow, Background, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GrafoComponente, DiagramaComponente } from "@/lib/validations/slide-componentes";

const CORES_POR_ESTILO: Record<GrafoComponente["estilo"], { no: string; borda: string }> = {
  organograma: { no: "#1e293b", borda: "#818cf8" },
  fluxograma: { no: "#0f172a", borda: "#4f46e5" },
  mapamental: { no: "#312e81", borda: "#a5b4fc" },
};

export function RenderGrafo({ componente }: { componente: GrafoComponente }) {
  const cores = CORES_POR_ESTILO[componente.estilo];
  const nodes: Node[] = componente.nos.map((no) => ({
    id: no.id,
    position: { x: no.x, y: no.y },
    data: { label: no.label },
    style: { background: cores.no, border: `1px solid ${cores.borda}`, color: "#fff", borderRadius: 10, fontSize: 12 },
  }));
  const edges: Edge[] = componente.conexoes.map((con, i) => ({
    id: `${con.origem}-${con.destino}-${i}`,
    source: con.origem,
    target: con.destino,
    label: con.label,
    style: { stroke: cores.borda },
  }));

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }} nodesDraggable={false} nodesConnectable={false} panOnDrag={false} zoomOnScroll={false}>
        <Background color="#334155" gap={16} />
      </ReactFlow>
    </div>
  );
}

/** SWOT/matriz 2x2 — grid fixo de 4 quadrantes. */
function DiagramaQuadrantes({ itens }: { itens: DiagramaComponente["itens"] }) {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
      {itens.slice(0, 4).map((item, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-xl p-3" style={{ background: (item.cor ?? "#4f46e5") + "22", border: `1px solid ${item.cor ?? "#4f46e5"}` }}>
          <span className="text-sm font-bold text-white">{item.label}</span>
          {item.texto && <span className="text-xs text-slate-300">{item.texto}</span>}
        </div>
      ))}
    </div>
  );
}

/** Pirâmide — camadas empilhadas com largura decrescente. */
function DiagramaPiramide({ itens }: { itens: DiagramaComponente["itens"] }) {
  const total = itens.length || 1;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
      {itens.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-center rounded-md py-2 text-xs font-medium text-white"
          style={{ width: `${100 - (i * 70) / total}%`, background: item.cor ?? "#4f46e5" }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

/** Funil — camadas empilhadas com largura crescente (topo largo, base estreita, invertido da pirâmide). */
function DiagramaFunil({ itens }: { itens: DiagramaComponente["itens"] }) {
  const total = itens.length || 1;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
      {itens.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-center rounded-md py-2 text-xs font-medium text-white"
          style={{ width: `${100 - (i * 70) / total}%`, background: item.cor ?? "#4f46e5" }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

export function RenderDiagrama({ componente }: { componente: DiagramaComponente }) {
  switch (componente.formato) {
    case "piramide":
      return <DiagramaPiramide itens={componente.itens} />;
    case "funil":
      return <DiagramaFunil itens={componente.itens} />;
    case "swot":
    case "matriz2x2":
    default:
      return <DiagramaQuadrantes itens={componente.itens} />;
  }
}
