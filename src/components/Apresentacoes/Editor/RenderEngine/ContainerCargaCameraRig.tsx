import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { DimensoesComponente } from "@/lib/apresentacoes/container-intro";
import { CONTAINER, type ContainerCargaMotion } from "./ContainerCargaModel";

const FRAME_FILL_EDITOR = 0.88;
const FRAME_FILL_CAPA = 0.985;
const box = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();

interface ContainerCargaCameraRigProps {
  containerRef: RefObject<THREE.Group | null>;
  motionRef: RefObject<ContainerCargaMotion>;
  onPortalBounds?: (bounds: DimensoesComponente) => void;
  modoCapa?: boolean;
}

const portalBottomLeft = new THREE.Vector3();
const portalTopRight = new THREE.Vector3();

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
  const target = useRef(new THREE.Vector3());
  const cameraInicial = useRef(new THREE.Vector3());
  const cameraInterior = useRef(new THREE.Vector3());
  const enquadradoRef = useRef(false);

  const enquadrar = useCallback((): boolean => {
    const model = containerRef.current;
    if (!model || viewportSize.width <= 0 || viewportSize.height <= 0) return false;

    box.setFromObject(model);
    if (box.isEmpty()) return false;
    box.getSize(size);
    box.getCenter(center);

    const aspect = viewportSize.width / viewportSize.height;
    if (modoCapa) {
      const aspectContainer = (CONTAINER.openingW + CONTAINER.wall * 2) / (CONTAINER.openingH + CONTAINER.wall * 2);
      model.scale.x = model.scale.y * (aspect / aspectContainer);
      model.updateWorldMatrix(true, true);
      box.setFromObject(model);
      box.getSize(size);
      box.getCenter(center);
    }
    const frameFill = modoCapa ? FRAME_FILL_CAPA : FRAME_FILL_EDITOR;
    const verticalFov = THREE.MathUtils.degToRad(cameraRef.current.fov);
    const distanceForHeight = size.y / frameFill / (2 * Math.tan(verticalFov / 2));
    const horizontalFovTan = Math.tan(verticalFov / 2) * aspect;
    const distanceForWidth = size.x / frameFill / (2 * horizontalFovTan);
    const distance = Math.max(distanceForHeight, distanceForWidth);

    const activeCamera = cameraRef.current;
    target.current.copy(center);
    activeCamera.position.set(center.x, center.y, center.z + distance);
    cameraInicial.current.copy(activeCamera.position);
    cameraInterior.current.set(center.x, center.y, center.z + Math.max(0.08, size.z * 0.08));
    enquadradoRef.current = true;
    activeCamera.near = Math.max(0.05, distance / 200);
    activeCamera.far = distance + Math.max(size.z, 1) * 8;
    activeCamera.updateProjectionMatrix();
    activeCamera.lookAt(target.current);
    activeCamera.updateMatrixWorld(true);
    model.updateWorldMatrix(true, true);

    portalBottomLeft.set(-CONTAINER.openingW / 2, 0, -0.13);
    portalTopRight.set(CONTAINER.openingW / 2, CONTAINER.openingH, -0.13);
    model.localToWorld(portalBottomLeft).project(activeCamera);
    model.localToWorld(portalTopRight).project(activeCamera);

    const left = ((portalBottomLeft.x + 1) / 2) * viewportSize.width;
    const right = ((portalTopRight.x + 1) / 2) * viewportSize.width;
    const top = ((1 - portalTopRight.y) / 2) * viewportSize.height;
    const bottom = ((1 - portalBottomLeft.y) / 2) * viewportSize.height;
    onPortalBounds?.({ x: left, y: top, w: right - left, h: bottom - top });
    return true;
  }, [containerRef, modoCapa, onPortalBounds, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    let frameId = 0;
    let attempts = 0;

    function tentarEnquadrar() {
      attempts += 1;
      if (!enquadrar() && attempts < 120) frameId = requestAnimationFrame(tentarEnquadrar);
    }

    tentarEnquadrar();
    return () => cancelAnimationFrame(frameId);
  }, [enquadrar]);

  useFrame(() => {
    if (!enquadradoRef.current) return;
    cameraRef.current.position.lerpVectors(cameraInicial.current, cameraInterior.current, motionRef.current.zoom);
    cameraRef.current.lookAt(target.current);
  });

  return null;
}
