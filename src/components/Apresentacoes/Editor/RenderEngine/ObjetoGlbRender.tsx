import { Component, Suspense, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Objeto3dComponente } from "@/lib/validations/slide-componentes";
import { useVisibilidadeIframe } from "./useVisibilidadeIframe";

/** useGLTF lança (throw) se a URL for inválida/o fetch falhar — isola isso do resto do slide. */
class LimiteDeErroGlb extends Component<{ children: ReactNode; fallback: ReactNode }, { comErro: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { comErro: false };
  }
  static getDerivedStateFromError() {
    return { comErro: true };
  }
  render() {
    return this.state.comErro ? this.props.fallback : this.props.children;
  }
}

/** Placeholder visual quando não há URL ou o carregamento do .glb falha — cubo wireframe discreto. */
function PlaceholderSemModelo() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <mesh rotation={[0.4, 0.4, 0]}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshBasicMaterial color="#475569" wireframe />
      </mesh>
    </>
  );
}

function ModeloGlb({ url, autoRotacao, escala }: { url: string; autoRotacao: boolean; escala: number }) {
  const { scene } = useGLTF(url);
  const grupoRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotacao && grupoRef.current) grupoRef.current.rotation.y += delta * 0.5;
  });

  return (
    <group ref={grupoRef}>
      <primitive object={scene} scale={escala} />
    </group>
  );
}

function Cena({ componente }: { componente: Objeto3dComponente }) {
  if (!componente.url) {
    return <PlaceholderSemModelo />;
  }
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 2, 5]} intensity={1.2} />
      <LimiteDeErroGlb fallback={<PlaceholderSemModelo />}>
        <Suspense fallback={null}>
          <ModeloGlb url={componente.url} autoRotacao={componente.autoRotacao} escala={componente.escala} />
        </Suspense>
      </LimiteDeErroGlb>
      <OrbitControls enableZoom={false} enablePan={false} />
    </>
  );
}

export function ObjetoGlbRender({ componente }: { componente: Objeto3dComponente }) {
  const { ref, visivel } = useVisibilidadeIframe<HTMLDivElement>();

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <Canvas frameloop={visivel ? "always" : "never"} camera={{ position: [0, 0, 2.5], fov: 45 }}>
        <Cena componente={componente} />
      </Canvas>
    </div>
  );
}
