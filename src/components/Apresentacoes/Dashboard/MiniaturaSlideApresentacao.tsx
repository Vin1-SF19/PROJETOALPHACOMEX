"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { RenderComponente } from "@/components/Apresentacoes/Editor/RenderEngine/RenderComponente";
import { stylePosicaoAbsoluta } from "@/components/Apresentacoes/Editor/RenderEngine/posicionamento";
import type { MiniaturaSlideDados } from "@/lib/apresentacoes/miniatura-slide";

interface MiniaturaSlideApresentacaoProps {
  miniatura: MiniaturaSlideDados;
}

export function MiniaturaSlideApresentacao({ miniatura }: MiniaturaSlideApresentacaoProps) {
  const { canvas, componentes } = miniatura;
  const containerRef = useRef<HTMLDivElement>(null);
  const estaVisivel = useInView(containerRef, { margin: "240px" });

  return (
    <div
      ref={containerRef}
      className="h-full w-full transition-transform duration-500 group-hover:scale-105"
      style={{ backgroundColor: canvas.backgroundColor }}
    >
      {estaVisivel && (
        <svg
          aria-hidden="true"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        >
          <foreignObject width={canvas.width} height={canvas.height}>
            <div
              style={{
                backgroundColor: canvas.backgroundColor,
                backgroundImage: canvas.backgroundImage
                  ? `url(${JSON.stringify(canvas.backgroundImage)})`
                  : undefined,
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
                height: canvas.height,
                overflow: "hidden",
                pointerEvents: "none",
                position: "relative",
                width: canvas.width,
              }}
            >
              {componentes.map((componente) => (
                <div key={componente.id} style={stylePosicaoAbsoluta(componente)}>
                  <RenderComponente componente={componente} modo="apresentacao" pausado />
                </div>
              ))}
            </div>
          </foreignObject>
        </svg>
      )}
    </div>
  );
}
