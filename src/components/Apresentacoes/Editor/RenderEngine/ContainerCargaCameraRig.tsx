import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { DimensoesComponente } from "@/lib/apresentacoes/container-intro";
import { CONTAINER, INTERIOR_DEPTH, type ContainerCargaMotion } from "./ContainerCargaModel";

const FRAME_FILL_EDITOR = 0.88;
const FRAME_FILL_CAPA = 0.985;
/**
 * Fração de INTERIOR_DEPTH que a câmera percorre pra dentro do túnel ao "entrar" no container
 * — dá sensação real de deslocamento (antes a câmera só avançava ~0,08 unidade, quase nada,
 * porque não havia túnel: só um plano de fundo colado logo atrás da porta).
 */
const CAMERA_PROFUNDIDADE_FRACAO = 0.65;
/**
 * A mira sempre vai um pouco além de onde a câmera chega, pra ela continuar "olhando pra
 * frente" (rumo ao slide revelado no fim do túnel) em vez de encarar o próprio ponto de
 * chegada no fim do avanço.
 */
const TARGET_PROFUNDIDADE_FRACAO = 1.05;

const box = new THREE.Box3();
const size = new THREE.Vector3();
const pontoLocal = new THREE.Vector3();
const frenteWorld = new THREE.Vector3();
const interiorWorld = new THREE.Vector3();
const alvoInteriorWorld = new THREE.Vector3();
const portalBottomLeft = new THREE.Vector3();
const portalTopRight = new THREE.Vector3();

interface ContainerCargaCameraRigProps {
  containerRef: RefObject<THREE.Group | null>;
  motionRef: RefObject<ContainerCargaMotion>;
  onPortalBounds?: (bounds: DimensoesComponente) => void;
  modoCapa?: boolean;
}

/** Mantém o modelo enquadrado pela bounding box real em qualquer largura/altura do componente. */
export function ContainerCargaCameraRig({
  containerRef,
  motionRef,
  onPortalBounds,
  modoCapa = false,
}: ContainerCargaCameraRigProps) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const cameraRef = useRef(camera);
  const viewportSize = useThree((state) => state.size);
  const targetInicial = useRef(new THREE.Vector3());
  const targetInterior = useRef(new THREE.Vector3());
  const targetAtual = useRef(new THREE.Vector3());
  const cameraInicial = useRef(new THREE.Vector3());
  const cameraInterior = useRef(new THREE.Vector3());
  const enquadradoRef = useRef(false);
  const boundsIniciais = useRef<DimensoesComponente>({ x: 0, y: 0, w: 0, h: 0 });

  const enquadrar = useCallback((): boolean => {
    const model = containerRef.current;
    if (!model || viewportSize.width <= 0 || viewportSize.height <= 0) return false;

    box.setFromObject(model);
    if (box.isEmpty()) return false;
    box.getSize(size);

    const aspect = viewportSize.width / viewportSize.height;
    if (modoCapa) {
      const aspectContainer = (CONTAINER.openingW + CONTAINER.wall * 2) / (CONTAINER.openingH + CONTAINER.wall * 2);
      model.scale.x = model.scale.y * (aspect / aspectContainer);
      model.updateWorldMatrix(true, true);
      box.setFromObject(model);
      box.getSize(size);
    }
    model.updateWorldMatrix(true, true);

    // Profundidade (Z) ancorada no plano da porta, não no centro da bounding box: o túnel
    // interior estende a bounding box várias unidades pra trás e enviesaria esse centro.
    pontoLocal.set(0, CONTAINER.centerY, 0);
    frenteWorld.copy(pontoLocal);
    model.localToWorld(frenteWorld);

    const frameFill = modoCapa ? FRAME_FILL_CAPA : FRAME_FILL_EDITOR;
    const verticalFov = THREE.MathUtils.degToRad(cameraRef.current.fov);
    const distanceForHeight = size.y / frameFill / (2 * Math.tan(verticalFov / 2));
    const horizontalFovTan = Math.tan(verticalFov / 2) * aspect;
    const distanceForWidth = size.x / frameFill / (2 * horizontalFovTan);
    const distance = Math.max(distanceForHeight, distanceForWidth);

    const activeCamera = cameraRef.current;
    targetInicial.current.copy(frenteWorld);
    activeCamera.position.set(frenteWorld.x, frenteWorld.y, frenteWorld.z + distance);
    cameraInicial.current.copy(activeCamera.position);

    pontoLocal.set(0, CONTAINER.centerY, -INTERIOR_DEPTH * CAMERA_PROFUNDIDADE_FRACAO);
    interiorWorld.copy(pontoLocal);
    model.localToWorld(interiorWorld);
    cameraInterior.current.copy(interiorWorld);

    pontoLocal.set(0, CONTAINER.centerY, -INTERIOR_DEPTH * TARGET_PROFUNDIDADE_FRACAO);
    alvoInteriorWorld.copy(pontoLocal);
    model.localToWorld(alvoInteriorWorld);
    targetInterior.current.copy(alvoInteriorWorld);

    enquadradoRef.current = true;
    activeCamera.near = Math.max(0.05, distance / 200);
    activeCamera.far = distance + Math.max(size.z, 1) * 8;
    activeCamera.updateProjectionMatrix();
    activeCamera.lookAt(targetInicial.current);
    activeCamera.updateMatrixWorld(true);
    model.updateWorldMatrix(true, true);

    // Projeção real do vão da porta — válida aqui porque a câmera ainda está parada na posição
    // externa. Vira o ponto de partida do crescimento da prévia durante o zoom (ver useFrame):
    // assim que a câmera começa a avançar pro túnel, ela ultrapassa esse plano de referência, e
    // reprojetá-lo frame a frame devolveria coordenada sem sentido (ponto atrás da câmera). Por
    // isso o crescimento é interpolado até tela cheia, não reprojetado.
    portalBottomLeft.set(-CONTAINER.openingW / 2, 0, -0.13);
    portalTopRight.set(CONTAINER.openingW / 2, CONTAINER.openingH, -0.13);
    model.localToWorld(portalBottomLeft).project(activeCamera);
    model.localToWorld(portalTopRight).project(activeCamera);

    const left = ((portalBottomLeft.x + 1) / 2) * viewportSize.width;
    const right = ((portalTopRight.x + 1) / 2) * viewportSize.width;
    const top = ((1 - portalTopRight.y) / 2) * viewportSize.height;
    const bottom = ((1 - portalBottomLeft.y) / 2) * viewportSize.height;
    boundsIniciais.current = { x: left, y: top, w: right - left, h: bottom - top };
    onPortalBounds?.(boundsIniciais.current);
    return true;
  }, [containerRef, modoCapa, onPortalBounds, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    let frameId = 0;
    let attempts = 0;

    // NÃO reconferir o enquadramento depois do 1º sucesso (já foi tentado numa rodada anterior
    // e revertido): `enquadrar()` seta `camera.position` diretamente, sem transição — reconferir
    // de novo enquanto a porta já está visivelmente abrindo criaria um salto de câmera no meio
    // da animação, pior do que o problema que tentava resolver.
    function tentarEnquadrar() {
      attempts += 1;
      if (!enquadrar() && attempts < 120) frameId = requestAnimationFrame(tentarEnquadrar);
    }

    tentarEnquadrar();
    return () => cancelAnimationFrame(frameId);
  }, [enquadrar]);

  useFrame(() => {
    if (!enquadradoRef.current) return;
    const zoom = motionRef.current.zoom;
    const activeCamera = cameraRef.current;
    activeCamera.position.lerpVectors(cameraInicial.current, cameraInterior.current, zoom);
    targetAtual.current.lerpVectors(targetInicial.current, targetInterior.current, zoom);
    activeCamera.lookAt(targetAtual.current);

    // A prévia do próximo slide cresce até tela cheia bem no INÍCIO do zoom (não ao longo dele
    // inteiro) — assim que a câmera começa a avançar de verdade pro túnel, o slide já está no
    // tamanho final, e o resto da animação é só o "voo" pelo túnel por cima de um slide que já
    // não muda mais de tamanho. Sem isso, o retângulo ficava crescendo aos poucos ao mesmo tempo
    // em que a câmera atravessava o túnel — lido como "pequeno, depois grande, sem fluidez".
    if (onPortalBounds) {
      const CRESCE_ATE_ZOOM = 0.4;
      const progresso = Math.min(1, zoom / CRESCE_ATE_ZOOM);
      if (progresso > 0) {
        const inicial = boundsIniciais.current;
        onPortalBounds({
          x: inicial.x * (1 - progresso),
          y: inicial.y * (1 - progresso),
          w: inicial.w + (viewportSize.width - inicial.w) * progresso,
          h: inicial.h + (viewportSize.height - inicial.h) * progresso,
        });
      }
    }
  });

  return null;
}
