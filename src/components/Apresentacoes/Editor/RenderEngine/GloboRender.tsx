import { Component, Suspense, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { GloboComponente } from "@/lib/validations/slide-componentes";
import { useVisibilidadeIframe } from "./useVisibilidadeIframe";

/** useTexture lança (throw) se a URL for inválida/não for uma imagem carregável — isola isso do resto do slide. */
class LimiteDeErroTextura extends Component<{ children: ReactNode; fallback: ReactNode }, { comErro: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { comErro: false };
  }
  static getDerivedStateFromError() {
    return { comErro: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[GloboRender] Falha ao carregar textura", error);
  }
  render() {
    return this.state.comErro ? this.props.fallback : this.props.children;
  }
}

/**
 * Converte lat/lng em posição 3D na superfície de uma esfera de raio `raio`.
 * phi = colatitude (ângulo a partir do polo norte), theta = longitude ajustada
 * para a orientação padrão de textura equirretangular usada em globos three.js.
 */
function latLngParaVetor3(lat: number, lng: number, raio: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [-(raio * Math.sin(phi) * Math.cos(theta)), raio * Math.cos(phi), raio * Math.sin(phi) * Math.sin(theta)];
}

function EsferaComTextura({ url }: { url: string }) {
  const textura = useTexture(url);
  return <meshStandardMaterial map={textura} />;
}

function Cena({ componente }: { componente: GloboComponente }) {
  const grupoRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (grupoRef.current) grupoRef.current.rotation.y += delta * componente.velocidadeRotacao;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 2, 5]} intensity={1.2} />
      <group ref={grupoRef}>
        <mesh>
          <sphereGeometry args={[1, 48, 48]} />
          {componente.texturaUrl ? (
            <LimiteDeErroTextura fallback={<meshStandardMaterial color={componente.corBase ?? "#4f46e5"} />}>
              <Suspense fallback={<meshStandardMaterial color={componente.corBase ?? "#4f46e5"} />}>
                <EsferaComTextura url={componente.texturaUrl} />
              </Suspense>
            </LimiteDeErroTextura>
          ) : (
            <meshStandardMaterial color={componente.corBase ?? "#4f46e5"} />
          )}
        </mesh>
        {componente.marcadores.map((m, i) => {
          const pos = latLngParaVetor3(m.lat, m.lng, 1.02);
          return (
            <mesh key={`${m.lat}-${m.lng}-${i}`} position={pos}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color={m.cor ?? "#f59e0b"} />
            </mesh>
          );
        })}
      </group>
    </>
  );
}

export function GloboRender({ componente }: { componente: GloboComponente }) {
  const { ref, visivel } = useVisibilidadeIframe<HTMLDivElement>();

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <Canvas frameloop={visivel ? "always" : "never"} camera={{ position: [0, 0, 2.5], fov: 45 }}>
        <Cena componente={componente} />
      </Canvas>
    </div>
  );
}
