import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import type { ParticulasComponente } from "@/lib/validations/slide-componentes";
import { useVisibilidadeIframe } from "./useVisibilidadeIframe";

function gerarPosicoes(quantidade: number): Float32Array {
  const posicoes = new Float32Array(quantidade * 3);
  for (let i = 0; i < quantidade; i++) {
    posicoes[i * 3] = (Math.random() - 0.5) * 2;
    posicoes[i * 3 + 1] = (Math.random() - 0.5) * 2;
    posicoes[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }
  return posicoes;
}

function CampoDeParticulas({ componente }: { componente: ParticulasComponente }) {
  const pontosRef = useRef<THREE.Points>(null);
  const posicoes = useMemo(() => gerarPosicoes(componente.quantidade), [componente.quantidade]);

  useFrame((_, delta) => {
    if (pontosRef.current) {
      pontosRef.current.rotation.y += delta * 0.05 * componente.velocidade;
      pontosRef.current.rotation.x += delta * 0.02 * componente.velocidade;
    }
  });

  return (
    <Points ref={pontosRef} positions={posicoes} stride={3} frustumCulled>
      <PointMaterial
        transparent
        color={componente.cor ?? "#818cf8"}
        size={componente.tamanho * 0.01}
        sizeAttenuation
        depthWrite={false}
      />
    </Points>
  );
}

export function ParticulasRender({ componente }: { componente: ParticulasComponente }) {
  const { ref, visivel } = useVisibilidadeIframe<HTMLDivElement>();

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <Canvas frameloop={visivel ? "always" : "never"} camera={{ position: [0, 0, 2.5], fov: 45 }}>
        <CampoDeParticulas componente={componente} />
      </Canvas>
    </div>
  );
}
