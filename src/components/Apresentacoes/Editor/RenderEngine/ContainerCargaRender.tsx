import { Canvas } from "@react-three/fiber";
import { createPortal } from "react-dom";
import { animate, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";
import {
  DIMENSOES_CONTAINER_CAPA,
  type ContainerIntroEvent,
  type DimensoesComponente,
} from "@/lib/apresentacoes/container-intro";
import { APRESENTACAO_SLIDE_H, APRESENTACAO_SLIDE_W } from "@/lib/apresentacoes/viewport";
import { tocarSomAberturaContainer } from "@/lib/apresentacoes/container-carga-audio";
import { ContainerCargaCameraRig } from "./ContainerCargaCameraRig";
import { ContainerCargaModel, type ContainerCargaMotion } from "./ContainerCargaModel";
import type { ModoRenderComponente } from "./RenderComponente";
import { useVisibilidadeIframe } from "./useVisibilidadeIframe";

interface ContainerCargaRenderProps {
  componente: ContainerCargaComponente;
  modo: ModoRenderComponente;
  onIntroStart?: (evento: ContainerIntroEvent) => void;
  onIntroComplete?: () => void;
  portalProximoSlide?: ReactNode;
  pausado?: boolean;
  portalContainerCapa?: Element | null;
}

function createMotion(): ContainerCargaMotion {
  return { doorL: 0, doorR: 0, latch: 0, zoom: 0 };
}

function ContainerCargaScene({
  componente,
  motionRef,
  mostrarFundoInterior,
  onPortalBounds,
  modoCapa,
}: {
  componente: ContainerCargaComponente;
  motionRef: RefObject<ContainerCargaMotion>;
  mostrarFundoInterior: boolean;
  onPortalBounds: (bounds: DimensoesComponente) => void;
  modoCapa: boolean;
}) {
  const containerRef = useRef<THREE.Group>(null);
  return (
    <Suspense fallback={null}>
      <ContainerCargaCameraRig
        containerRef={containerRef}
        motionRef={motionRef}
        onPortalBounds={onPortalBounds}
        modoCapa={modoCapa}
      />
      <ambientLight color="#1a2438" intensity={0.55} />
      <hemisphereLight color="#2c3f61" groundColor="#04070e" intensity={0.6} />
      <directionalLight color="#b8c9e6" position={[3.6, 5.2, 6.5]} intensity={2.1} />
      <directionalLight color="#31487a" position={[-4.5, 2.4, 3]} intensity={0.55} />
      <pointLight color="#ff9a5c" position={[-3.2, 0.9, 2.2]} intensity={5} distance={9} decay={2} />
      <ContainerCargaModel
        componente={componente}
        motionRef={motionRef}
        rootRef={containerRef}
        mostrarFundoInterior={mostrarFundoInterior}
        modoCapa={modoCapa}
      />
    </Suspense>
  );
}

/**
 * Componente responsivo: o Canvas segue 100% da caixa editável, enquanto a
 * câmera recalcula o enquadramento pelo tamanho que o R3F observa internamente.
 */
function PortalProximoSlide({ bounds, children }: { bounds: DimensoesComponente; children: ReactNode }) {
  const escala = Math.max(bounds.w / APRESENTACAO_SLIDE_W, bounds.h / APRESENTACAO_SLIDE_H);

  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none absolute overflow-hidden bg-slate-900"
      style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h, zIndex: 1 }}
    >
      <div
        className="absolute left-1/2 top-1/2 bg-slate-900"
        style={{
          width: APRESENTACAO_SLIDE_W,
          height: APRESENTACAO_SLIDE_H,
          transform: `translate(-50%, -50%) scale(${escala})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ContainerCargaRender({
  componente,
  modo,
  onIntroStart,
  onIntroComplete,
  portalProximoSlide,
  pausado = false,
  portalContainerCapa,
}: ContainerCargaRenderProps) {
  const { ref, visivel } = useVisibilidadeIframe<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const motionRef = useRef<ContainerCargaMotion>(createMotion());
  const controlsRef = useRef<AnimationPlaybackControls[]>([]);
  const pararSomRef = useRef<(() => void) | undefined>(undefined);
  const pausadoRef = useRef(pausado);
  const portalBoundsRef = useRef<DimensoesComponente | null>(null);
  const [portalBounds, setPortalBounds] = useState<DimensoesComponente | null>(null);
  const portalAtivo = portalProximoSlide !== undefined;

  const atualizarPortalBounds = useCallback((bounds: DimensoesComponente) => {
    portalBoundsRef.current = bounds;
    setPortalBounds((atual) => {
      if (
        atual
        && Math.abs(atual.x - bounds.x) < 0.5
        && Math.abs(atual.y - bounds.y) < 0.5
        && Math.abs(atual.w - bounds.w) < 0.5
        && Math.abs(atual.h - bounds.h) < 0.5
      ) return atual;
      return bounds;
    });
  }, []);

  useEffect(() => {
    const controls: AnimationPlaybackControls[] = [];
    let somIniciado = false;
    let introEmitida = false;
    const abertoNoEditor = modo === "editor" && componente.estadoEditor === "aberto";
    const deveAnimar = modo === "apresentacao" && !reducedMotion;
    const estadoFinal = modo === "apresentacao" || abertoNoEditor ? 1 : 0;
    const emitirIntro = (duracao: number) => {
      const aberturaLocal = portalBoundsRef.current;
      const palcoPortal = ref.current
        ? { w: ref.current.clientWidth, h: ref.current.clientHeight }
        : undefined;
      const componenteRenderizado = modo === "apresentacao" && palcoPortal
        ? { ...componente, x: 0, y: 0, w: palcoPortal.w, h: palcoPortal.h }
        : modo === "apresentacao"
          ? { ...componente, ...DIMENSOES_CONTAINER_CAPA }
        : componente;
      onIntroStart?.({
        componente: componenteRenderizado,
        duracao,
        palco: palcoPortal,
        abertura: aberturaLocal ? {
          x: componenteRenderizado.x + aberturaLocal.x,
          y: componenteRenderizado.y + aberturaLocal.y,
          w: aberturaLocal.w,
          h: aberturaLocal.h,
        } : undefined,
      });
    };
    const iniciarSom = () => {
      if (somIniciado || !componente.somHabilitado) return;
      somIniciado = true;
      pararSomRef.current = tocarSomAberturaContainer(componente.somAbertura, componente.volumeSom);
    };
    const registrarControle = (control: AnimationPlaybackControls) => {
      controls.push(control);
      if (pausadoRef.current) control.pause();
      return control;
    };

    motionRef.current.doorL = deveAnimar ? 0 : estadoFinal;
    motionRef.current.doorR = deveAnimar ? 0 : estadoFinal;
    motionRef.current.latch = 0;
    motionRef.current.zoom = 0;

    if (deveAnimar) {
      registrarControle(animate(0, 1, {
        duration: 0.35,
        delay: componente.atrasoAbertura,
        ease: "easeInOut",
        onUpdate: (value) => {
          if (value > 0) iniciarSom();
          motionRef.current.latch = value;
        },
      }));
      registrarControle(animate(0, 1, {
        duration: componente.duracaoAbertura,
        delay: componente.atrasoAbertura + 0.22,
        ease: [0.4, 0, 0.2, 1],
        onUpdate: (value) => {
          motionRef.current.doorL = value;
          motionRef.current.doorR = value;
        },
      }));

      if (componente.transicaoProximoSlide && onIntroStart) {
        registrarControle(animate(0, 1, {
          duration: componente.duracaoZoom,
          delay: componente.atrasoAbertura + componente.duracaoAbertura,
          ease: [0.45, 0, 0.2, 1],
          onUpdate: (value) => {
            if (!introEmitida && value > 0) {
              introEmitida = true;
              emitirIntro(componente.duracaoZoom);
            }
            motionRef.current.zoom = value;
          },
          onComplete: () => {
            motionRef.current.zoom = 1;
            onIntroComplete?.();
          },
        }));
      }
    } else if (modo === "apresentacao" && componente.transicaoProximoSlide && onIntroStart) {
      iniciarSom();
      registrarControle(animate(0, 1, {
        duration: 0.01,
        onUpdate: (value) => {
          if (!introEmitida && value > 0) {
            introEmitida = true;
            emitirIntro(0.01);
          }
          motionRef.current.zoom = value;
        },
        onComplete: () => {
          motionRef.current.zoom = 1;
          onIntroComplete?.();
        },
      }));
    } else if (modo === "apresentacao" && componente.somHabilitado) {
      iniciarSom();
    }
    controlsRef.current = controls;

    return () => {
      pararSomRef.current?.();
      pararSomRef.current = undefined;
      controls.forEach((control) => control.stop());
      controlsRef.current = [];
    };
  }, [componente, modo, onIntroComplete, onIntroStart, reducedMotion, ref]);

  useEffect(() => {
    pausadoRef.current = pausado;
    for (const control of controlsRef.current) {
      if (pausado) control.pause();
      else control.play();
    }
    if (pausado) {
      pararSomRef.current?.();
      pararSomRef.current = undefined;
    }
  }, [pausado]);

  const conteudo = (
    <div
      ref={ref}
      role="img"
      aria-label="Container Alpha Comex com portas animadas"
      className="bg-transparent"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 1,
        minHeight: 1,
        overflow: "hidden",
      }}
    >
      {portalAtivo && portalBounds && (
        <PortalProximoSlide bounds={portalBounds}>{portalProximoSlide}</PortalProximoSlide>
      )}
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visivel && !pausado ? "always" : "never"}
        camera={{ fov: 34, near: 0.05, far: 60 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, zIndex: 2 }}
      >
        <ContainerCargaScene
          componente={componente}
          motionRef={motionRef}
          mostrarFundoInterior={!portalAtivo}
          onPortalBounds={atualizarPortalBounds}
          modoCapa={modo === "apresentacao"}
        />
      </Canvas>
    </div>
  );

  if (modo === "apresentacao" && portalContainerCapa !== undefined) {
    return portalContainerCapa ? createPortal(conteudo, portalContainerCapa) : null;
  }

  return conteudo;
}
