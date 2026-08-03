import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";
import { CONTAINER_CAPA_SCALE_X } from "@/lib/apresentacoes/container-intro";

export interface ContainerCargaMotion {
  doorL: number;
  doorR: number;
  latch: number;
  zoom: number;
}

export const CONTAINER = {
  openingW: 2.44,
  openingH: 3.35,
  wall: 0.08,
  doorThickness: 0.06,
  centerY: 1.675,
} as const;

const DOOR_W = CONTAINER.openingW / 2 - 0.015;
const DOOR_H = CONTAINER.openingH - 0.05;
const MODEL_SCALE = 1.65;
const LOGO_SCALE = 0.78;
const LOGO_Y = 0;
const LOGO_H = (DOOR_W * 2) / (338 / 148);

function drawCorrugation(ctx: CanvasRenderingContext2D, width: number, height: number, base: string) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);
  for (let x = 0; x < width; x += 64) {
    const ridge = ctx.createLinearGradient(x, 0, x + 64, 0);
    ridge.addColorStop(0, "rgba(255,255,255,0.04)");
    ridge.addColorStop(0.32, "rgba(255,255,255,0.10)");
    ridge.addColorStop(0.54, "rgba(0,0,0,0.13)");
    ridge.addColorStop(0.76, "rgba(0,0,0,0.28)");
    ridge.addColorStop(1, "rgba(255,255,255,0.035)");
    ctx.fillStyle = ridge;
    ctx.fillRect(x, 0, 64, height);
  }
}

function makeDoorTexture(side: "left" | "right", color: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  drawCorrugation(ctx, canvas.width, canvas.height, color);
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(235,242,250,0.92)";
  if (side === "left") {
    ctx.font = 'bold 44px "Arial", sans-serif';
    ctx.fillText("ALPHA", 42, 96);
    ctx.fillText("COMEX", 42, 148);
    ctx.font = 'bold 22px "Arial", sans-serif';
    ctx.fillStyle = "rgba(235,242,250,0.76)";
    ["GLOBAL", "TRADE", "SOLUTIONS"].forEach((line, index) => ctx.fillText(line, 42, 856 + index * 28));
  } else {
    ctx.font = 'bold 40px "Arial", sans-serif';
    ctx.fillText("ACXU 2025 01", 150, 96);
    ctx.fillText("22G1", 150, 146);
    ctx.font = 'bold 17px "Arial", sans-serif';
    ctx.fillStyle = "rgba(235,242,250,0.72)";
    [["MAX. GROSS", "30.480 KG"], ["TARE", "2.200 KG"], ["NET", "28.280 KG"], ["CU. CAP.", "33.2 CU.M."]]
      .forEach(([label, value], index) => {
        ctx.fillText(label, 190, 300 + index * 46);
        ctx.fillText(value, 330, 300 + index * 46);
      });
    ctx.font = 'bold 22px "Arial", sans-serif';
    ["COMPLIANCE.", "INTELIGÊNCIA.", "RESULTADOS."].forEach((line, index) => ctx.fillText(line, 210, 856 + index * 28));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function LogoHalf({ side }: { side: "left" | "right" }) {
  const source = useTexture("/A.PNG");
  const texture = useMemo(() => {
    const half = source.clone();
    half.colorSpace = THREE.SRGBColorSpace;
    half.wrapS = THREE.ClampToEdgeWrapping;
    half.wrapT = THREE.ClampToEdgeWrapping;
    half.repeat.set(0.5, 1);
    half.offset.set(side === "left" ? 0 : 0.5, 0);
    half.needsUpdate = true;
    return half;
  }, [side, source]);

  useEffect(() => () => texture.dispose(), [texture]);
  const seamOffset = ((1 - LOGO_SCALE) * DOOR_W) / 2;

  return (
    <mesh
      name={side === "left" ? "Alpha_Logo_Left" : "Alpha_Logo_Right"}
      position={[side === "left" ? seamOffset : -seamOffset, LOGO_Y, CONTAINER.doorThickness / 2 + 0.006]}
      renderOrder={1}
    >
      <planeGeometry args={[DOOR_W * LOGO_SCALE, LOGO_H * LOGO_SCALE]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.02} toneMapped={false} />
    </mesh>
  );
}

interface LockingBarsProps {
  side: "left" | "right";
  material: THREE.MeshStandardMaterial;
  latchRef: RefObject<THREE.Group | null>;
}

function LockingBars({ side, material, latchRef }: LockingBarsProps) {
  const direction = side === "left" ? 1 : -1;
  const positions = side === "left" ? [0.34, 0.62, 0.9] : [-0.34, -0.62, -0.9];
  return (
    <group name={side === "left" ? "Locking_Bars_Left" : "Locking_Bars_Right"}>
      {positions.map((x) => (
        <group key={x}>
          <mesh position={[x, 0, CONTAINER.doorThickness / 2 + 0.035]} material={material}>
            <cylinderGeometry args={[0.024, 0.024, DOOR_H - 0.12, 10]} />
          </mesh>
          {[-0.9, 0, 0.9].map((y) => (
            <mesh key={y} position={[x, y, CONTAINER.doorThickness / 2 + 0.03]} material={material}>
              <boxGeometry args={[0.08, 0.07, 0.05]} />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={latchRef} position={[positions[1], -0.28, CONTAINER.doorThickness / 2 + 0.05]}>
        <mesh rotation={[0, 0, direction * 0.5]} material={material}>
          <boxGeometry args={[0.05, 0.34, 0.035]} />
        </mesh>
      </group>
    </group>
  );
}

interface ContainerCargaModelProps {
  componente: ContainerCargaComponente;
  motionRef: RefObject<ContainerCargaMotion>;
  rootRef: RefObject<THREE.Group | null>;
  mostrarFundoInterior?: boolean;
  modoCapa?: boolean;
}

export function ContainerCargaModel({
  componente,
  motionRef,
  rootRef,
  mostrarFundoInterior = true,
  modoCapa = false,
}: ContainerCargaModelProps) {
  const leftPivot = useRef<THREE.Group>(null);
  const rightPivot = useRef<THREE.Group>(null);
  const leftLatch = useRef<THREE.Group>(null);
  const rightLatch = useRef<THREE.Group>(null);

  const assets = useMemo(() => {
    const leftTexture = makeDoorTexture("left", componente.corPrincipal);
    const rightTexture = makeDoorTexture("right", componente.corPrincipal);
    const pbr = { roughness: 0.62, metalness: 0.38 };
    return {
      leftTexture,
      rightTexture,
      frame: new THREE.MeshStandardMaterial({ ...pbr, color: componente.corPrincipal }),
      metal: new THREE.MeshStandardMaterial({ color: componente.corMetal, roughness: 0.35, metalness: 0.85 }),
      leftDoor: new THREE.MeshStandardMaterial({ ...pbr, color: componente.corPrincipal, map: leftTexture }),
      rightDoor: new THREE.MeshStandardMaterial({ ...pbr, color: componente.corPrincipal, map: rightTexture }),
      interior: new THREE.MeshBasicMaterial({ color: componente.corInterior, toneMapped: false, side: THREE.DoubleSide }),
    };
  }, [componente.corInterior, componente.corMetal, componente.corPrincipal]);

  useEffect(() => () => {
    assets.leftTexture?.dispose();
    assets.rightTexture?.dispose();
    assets.frame.dispose();
    assets.metal.dispose();
    assets.leftDoor.dispose();
    assets.rightDoor.dispose();
    assets.interior.dispose();
  }, [assets]);

  useFrame(() => {
    const motion = motionRef.current;
    const angle = THREE.MathUtils.degToRad(componente.anguloAbertura);
    if (leftPivot.current) leftPivot.current.rotation.y = -angle * motion.doorL;
    if (rightPivot.current) rightPivot.current.rotation.y = angle * motion.doorR;
    const wiggle = Math.sin(motion.latch * Math.PI) * 0.12;
    if (leftLatch.current) leftLatch.current.rotation.z = wiggle;
    if (rightLatch.current) rightLatch.current.rotation.z = -wiggle;
  });

  const { openingW, openingH, wall, centerY, doorThickness } = CONTAINER;
  const outerW = openingW + wall * 2;
  const outerH = openingH + wall * 2;
  const hingePositions = [-0.95, -0.3, 0.35, 1];

  return (
    <group
      ref={rootRef}
      name="Container_Body"
      scale={modoCapa ? [MODEL_SCALE * CONTAINER_CAPA_SCALE_X, MODEL_SCALE, MODEL_SCALE] : MODEL_SCALE}
    >
      {mostrarFundoInterior && (
        <mesh name="Transition_Backdrop" position={[0, centerY, -0.12]} material={assets.interior}>
          <planeGeometry args={[openingW, openingH]} />
        </mesh>
      )}
      <group name="Container_Frame">
        <mesh position={[0, openingH + 0.02, -0.02]} material={assets.frame}><boxGeometry args={[outerW, 0.1, 0.12]} /></mesh>
        <mesh position={[-(openingW / 2 + 0.02), centerY, -0.02]} material={assets.frame}><boxGeometry args={[0.1, outerH, 0.12]} /></mesh>
        <mesh position={[openingW / 2 + 0.02, centerY, -0.02]} material={assets.frame}><boxGeometry args={[0.1, outerH, 0.12]} /></mesh>
      </group>

      <group name="Door_Left_Pivot" ref={leftPivot} position={[-openingW / 2, centerY, 0]}>
        <mesh name="Door_Left" position={[DOOR_W / 2, 0, 0]} material={assets.leftDoor}>
          <boxGeometry args={[DOOR_W, DOOR_H, doorThickness]} />
        </mesh>
        <group position={[DOOR_W / 2, 0, 0]}>
          {componente.mostrarLogo && <LogoHalf side="left" />}
          <LockingBars side="left" material={assets.metal} latchRef={leftLatch} />
        </group>
        {hingePositions.map((y) => (
          <mesh key={y} position={[0.015, y, doorThickness / 2 + 0.01]} material={assets.metal}><boxGeometry args={[0.05, 0.12, 0.06]} /></mesh>
        ))}
      </group>

      <group name="Door_Right_Pivot" ref={rightPivot} position={[openingW / 2, centerY, 0]}>
        <mesh name="Door_Right" position={[-DOOR_W / 2, 0, 0]} material={assets.rightDoor}>
          <boxGeometry args={[DOOR_W, DOOR_H, doorThickness]} />
        </mesh>
        <group position={[-DOOR_W / 2, 0, 0]}>
          {componente.mostrarLogo && <LogoHalf side="right" />}
          <LockingBars side="right" material={assets.metal} latchRef={rightLatch} />
        </group>
        {hingePositions.map((y) => (
          <mesh key={y} position={[-0.015, y, doorThickness / 2 + 0.01]} material={assets.metal}><boxGeometry args={[0.05, 0.12, 0.06]} /></mesh>
        ))}
      </group>
    </group>
  );
}
