import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";
import { CONTAINER_CAPA_SCALE_X } from "@/lib/apresentacoes/container-intro";
import { LOGO_A_URL } from "@/lib/apresentacoes/container-carga-assets";
import { criarGeradorSeed } from "./fundos-utils";

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

/**
 * Profundidade do túnel interior — sem geometria real aqui, a câmera não tinha por onde
 * "entrar" no zoom (só existia um plano de fundo colado logo atrás da porta). Proporção
 * próxima a de um container real (~2,2x a largura do vão), suficiente pra dar sensação de
 * deslocamento sem pesar a cena. Exportado porque ContainerCargaCameraRig.tsx precisa da
 * mesma profundidade pra saber até onde a câmera avança.
 */
export const INTERIOR_DEPTH = 5.4;
const NERVURAS_INTERIOR = 12;
const MARGEM_NERVURA = 0.3;

/** Resolução real da textura das portas — 2x a original (512×1024) para nitidez de texto/corrugação. */
const CANVAS_W = 1024;
const CANVAS_H = 2048;

/**
 * Padrão fiel a um container de carga real e desgastado pelo uso: nervuras verticais com luz
 * direcional por aresta, sujeira acumulada perto do chão/topo, escorridos de ferrugem e riscos
 * de desgaste — tudo procedural (sem imagem externa, continua 100% recolorável). Seed FIXA
 * (não `Math.random()`) — o container pode renderizar em 2 instâncias simultâneas (prévia no
 * portal do Container Alpha + slide real por baixo, ver fundos-utils.ts) e o desgaste precisa
 * ser idêntico nas duas, senão "pula" quando uma dá lugar à outra.
 */
function drawCorrugation(ctx: CanvasRenderingContext2D, width: number, height: number, base: string, seed: number) {
  const random = criarGeradorSeed(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Nervuras verticais (corrugação) — 8 no total, cada uma com luz/sombra direcional.
  const larguraNervura = width / 8;
  for (let x = 0; x < width; x += larguraNervura) {
    const nervura = ctx.createLinearGradient(x, 0, x + larguraNervura, 0);
    nervura.addColorStop(0, "rgba(255,255,255,0.05)");
    nervura.addColorStop(0.26, "rgba(255,255,255,0.15)");
    nervura.addColorStop(0.48, "rgba(0,0,0,0.06)");
    nervura.addColorStop(0.56, "rgba(0,0,0,0.34)");
    nervura.addColorStop(0.8, "rgba(0,0,0,0.16)");
    nervura.addColorStop(1, "rgba(255,255,255,0.04)");
    ctx.fillStyle = nervura;
    ctx.fillRect(x, 0, larguraNervura, height);
  }

  // Sujeira acumulada — mais escura perto do topo e sobretudo do chão (respingo de estrada).
  const desgasteBase = ctx.createLinearGradient(0, 0, 0, height);
  desgasteBase.addColorStop(0, "rgba(0,0,0,0.14)");
  desgasteBase.addColorStop(0.1, "rgba(0,0,0,0)");
  desgasteBase.addColorStop(0.82, "rgba(0,0,0,0)");
  desgasteBase.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = desgasteBase;
  ctx.fillRect(0, 0, width, height);

  // Escorridos de ferrugem — verticais, finos, concentrados perto de rebites/dobradiças.
  const quantidadeFerrugem = 10;
  for (let i = 0; i < quantidadeFerrugem; i++) {
    const x = random() * width;
    const yInicio = random() * height * 0.55;
    const comprimento = height * (0.06 + random() * 0.16);
    const larguraMancha = width * (0.003 + random() * 0.006);
    const mancha = ctx.createLinearGradient(0, yInicio, 0, yInicio + comprimento);
    mancha.addColorStop(0, "rgba(122,58,20,0.24)");
    mancha.addColorStop(0.5, "rgba(96,46,16,0.12)");
    mancha.addColorStop(1, "rgba(96,46,16,0)");
    ctx.fillStyle = mancha;
    ctx.fillRect(x, yInicio, larguraMancha, comprimento);
  }

  // Riscos de desgaste (scuffs) — claros, curtos, aleatórios.
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  const quantidadeRiscos = 16;
  for (let i = 0; i < quantidadeRiscos; i++) {
    ctx.lineWidth = width * (0.001 + random() * 0.0025);
    const x = random() * width;
    const y = random() * height;
    const comprimento = width * (0.015 + random() * 0.05);
    const angulo = (random() - 0.5) * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angulo) * comprimento, y + Math.sin(angulo) * comprimento);
    ctx.stroke();
  }

  // Grão fino — sem isso o degradê fica liso/digital demais; metal real tem microvariação em
  // toda a superfície, não só nos escorridos/riscos pontuais.
  const quantidadeGrao = 2200;
  for (let i = 0; i < quantidadeGrao; i++) {
    const tom = random() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${tom},${tom},${tom},${(0.025 + random() * 0.05).toFixed(3)})`;
    const x = random() * width;
    const y = random() * height;
    const tamanho = 1 + random() * 2;
    ctx.fillRect(x, y, tamanho, tamanho);
  }
}

/**
 * Mapa de relevo (altura) da mesma corrugação — sem isso, as nervuras são só cor pintada num
 * plano liso: parecem "coladas" em vez de metal real, porque não reagem à luz da cena (fica
 * visível sobretudo agora que a câmera se move durante o zoom). Usado como `bumpMap`, não
 * precisa casar pixel a pixel com o grão da textura difusa — só a grade de nervuras (mesmas
 * posições X) precisa alinhar, o resto é ruído independente.
 */
function drawCorrugationHeight(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number) {
  const random = criarGeradorSeed(seed);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, width, height);

  const larguraNervura = width / 8;
  for (let x = 0; x < width; x += larguraNervura) {
    const relevo = ctx.createLinearGradient(x, 0, x + larguraNervura, 0);
    relevo.addColorStop(0, "#4a4a4a");
    relevo.addColorStop(0.22, "#e6e6e6");
    relevo.addColorStop(0.5, "#9a9a9a");
    relevo.addColorStop(0.78, "#2a2a2a");
    relevo.addColorStop(1, "#4a4a4a");
    ctx.fillStyle = relevo;
    ctx.fillRect(x, 0, larguraNervura, height);
  }

  const quantidadeGrao = 1400;
  for (let i = 0; i < quantidadeGrao; i++) {
    const tom = 96 + Math.floor(random() * 64);
    ctx.fillStyle = `rgba(${tom},${tom},${tom},0.55)`;
    const x = random() * width;
    const y = random() * height;
    const tamanho = 1 + random() * 2.5;
    ctx.fillRect(x, y, tamanho, tamanho);
  }
}

/** Desenha texto com sombra+brilho levemente deslocados antes do preenchimento normal — simula
 * letra pintada/gravada em relevo em vez do visual chapado de vetor puro. */
function fillTextComRelevo(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, cor: string) {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillText(texto, x + 2, y + 3);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillText(texto, x - 1, y - 1);
  ctx.fillStyle = cor;
  ctx.fillText(texto, x, y);
}

interface LinhaTabela {
  label: string;
  metrico: string;
  imperial: string;
}

const TABELA_PESO: LinhaTabela[] = [
  { label: "MAX. GROSS", metrico: "30.480 KG", imperial: "67.200 LB" },
  { label: "TARE", metrico: "2.200 KG", imperial: "4.850 LB" },
  { label: "NET", metrico: "28.280 KG", imperial: "62.350 LB" },
  { label: "CU. CAP.", metrico: "33.2 CU.M.", imperial: "1.172 CU.FT." },
];

function makeDoorTexture(side: "left" | "right", color: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Seeds fixas e distintas por lado — desgaste diferente em cada porta, mas sempre igual a cada render.
  drawCorrugation(ctx, canvas.width, canvas.height, color, side === "left" ? 4271 : 8837);
  ctx.textBaseline = "top";

  const CLARO = "rgba(235,242,250,0.94)";
  const CLARO_SECUNDARIO = "rgba(235,242,250,0.78)";
  const CLARO_TERCIARIO = "rgba(235,242,250,0.52)";

  if (side === "left") {
    ctx.font = 'bold 88px "Arial", sans-serif';
    fillTextComRelevo(ctx, "ALPHA", 84, 176, CLARO);
    fillTextComRelevo(ctx, "COMEX", 84, 288, CLARO);

    ctx.font = 'bold 44px "Arial", sans-serif';
    ["GLOBAL", "TRADE", "SOLUTIONS"].forEach((line, index) => fillTextComRelevo(ctx, line, 84, 1690 + index * 56, CLARO_SECUNDARIO));
  } else {
    ctx.font = 'bold 80px "Arial", sans-serif';
    fillTextComRelevo(ctx, "ACXU 2025 01", 300, 176, CLARO);
    fillTextComRelevo(ctx, "22G1", 300, 276, CLARO);

    let y = 560;
    for (const linha of TABELA_PESO) {
      ctx.font = 'bold 34px "Arial", sans-serif';
      fillTextComRelevo(ctx, linha.label, 370, y, CLARO_SECUNDARIO);
      fillTextComRelevo(ctx, linha.metrico, 660, y, CLARO_SECUNDARIO);
      ctx.font = 'bold 24px "Arial", sans-serif';
      fillTextComRelevo(ctx, linha.imperial, 660, y + 40, CLARO_TERCIARIO);
      y += 112;
    }

    ctx.font = 'bold 44px "Arial", sans-serif';
    ["COMPLIANCE.", "INTELIGÊNCIA.", "RESULTADOS."].forEach((line, index) => fillTextComRelevo(ctx, line, 420, 1690 + index * 56, CLARO_SECUNDARIO));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Bump map (relevo) das portas — mesma grade de nervuras da textura difusa, seed deslocada
 * (+500) pro grão do relevo não ficar idêntico ao grão da cor, mas continua 100% determinística. */
function makeDoorBumpTexture(side: "left" | "right"): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  drawCorrugationHeight(ctx, canvas.width, canvas.height, side === "left" ? 4771 : 9337);
  return new THREE.CanvasTexture(canvas);
}

function LogoHalf({ side }: { side: "left" | "right" }) {
  const source = useTexture(LOGO_A_URL);
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

/** Posições das 4 barras de trava por porta, do batente pra fora — distribuídas por toda a largura da porta. */
const POSICOES_BARRAS: Record<"left" | "right", [number, number, number, number]> = {
  left: [0.26, 0.5, 0.74, 0.98],
  right: [-0.26, -0.5, -0.74, -0.98],
};
const POSICOES_BRACADEIRAS = [-0.95, -0.55, -0.15, 0.25, 0.65] as const;

function LockingBars({ side, material, latchRef }: LockingBarsProps) {
  const direction = side === "left" ? 1 : -1;
  const positions = POSICOES_BARRAS[side];
  return (
    <group name={side === "left" ? "Locking_Bars_Left" : "Locking_Bars_Right"}>
      {positions.map((x) => (
        <group key={x}>
          <mesh position={[x, 0, CONTAINER.doorThickness / 2 + 0.035]} material={material}>
            <cylinderGeometry args={[0.022, 0.022, DOOR_H - 0.12, 10]} />
          </mesh>
          {POSICOES_BRACADEIRAS.map((y) => (
            <mesh key={y} position={[x, y, CONTAINER.doorThickness / 2 + 0.03]} material={material}>
              <boxGeometry args={[0.075, 0.06, 0.05]} />
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

/** Casting de canto (abertura padrão ISO) — detalhe visual nos 4 cantos do container. */
function CornerCasting({ x, y }: { x: number; y: number }) {
  return (
    <mesh position={[x, y, 0.061]} scale={[1, 0.52, 1]}>
      <circleGeometry args={[0.05, 20]} />
      <meshStandardMaterial color="#04060a" roughness={0.9} metalness={0.1} />
    </mesh>
  );
}

interface InteriorTunnelProps {
  parede: THREE.MeshStandardMaterial;
  nervura: THREE.MeshStandardMaterial;
}

/**
 * Corredor interior real (paredes, chão, teto e nervuras) por trás da porta — antes só existia
 * um plano de fundo a 0,12 da porta, sem profundidade nenhuma pra câmera "entrar". Sempre
 * renderizado (não depende de mostrarFundoInterior): quando o portal do próximo slide está
 * ativo, o fim do túnel fica aberto de propósito (sem parede de fundo) — o Canvas é
 * transparente ali, e quem aparece por trás é o próprio slide revelado, não uma textura 3D.
 */
function InteriorTunnel({ parede, nervura }: InteriorTunnelProps) {
  const { openingW, openingH, centerY } = CONTAINER;
  const meioZ = -INTERIOR_DEPTH / 2;
  const alcanceNervuras = INTERIOR_DEPTH - MARGEM_NERVURA * 2;
  const nervuraZ = Array.from(
    { length: NERVURAS_INTERIOR },
    (_, indice) => -MARGEM_NERVURA - (indice * alcanceNervuras) / (NERVURAS_INTERIOR - 1),
  );

  return (
    <group name="Container_Interior_Tunnel">
      <mesh position={[-openingW / 2 + 0.015, centerY, meioZ]} material={parede}>
        <boxGeometry args={[0.03, openingH, INTERIOR_DEPTH]} />
      </mesh>
      <mesh position={[openingW / 2 - 0.015, centerY, meioZ]} material={parede}>
        <boxGeometry args={[0.03, openingH, INTERIOR_DEPTH]} />
      </mesh>
      <mesh position={[0, openingH - 0.015, meioZ]} material={parede}>
        <boxGeometry args={[openingW - 0.03, 0.03, INTERIOR_DEPTH]} />
      </mesh>
      <mesh position={[0, 0.015, meioZ]} material={parede}>
        <boxGeometry args={[openingW - 0.03, 0.03, INTERIOR_DEPTH]} />
      </mesh>
      {nervuraZ.map((z) => (
        <group key={z}>
          <mesh position={[-openingW / 2 + 0.045, centerY, z]} material={nervura}>
            <boxGeometry args={[0.025, openingH - 0.1, 0.05]} />
          </mesh>
          <mesh position={[openingW / 2 - 0.045, centerY, z]} material={nervura}>
            <boxGeometry args={[0.025, openingH - 0.1, 0.05]} />
          </mesh>
        </group>
      ))}
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
    const leftBump = makeDoorBumpTexture("left");
    const rightBump = makeDoorBumpTexture("right");
    const pbr = { roughness: 0.62, metalness: 0.38 };
    // bumpScale pequeno de propósito: a porta tem ~1,2×3,3 unidades, nervura real de container
    // é rasa (poucos cm) perto da largura toda — um valor alto deformaria a luz de forma exagerada/irreal.
    const BUMP_SCALE = 0.018;
    // Frame/reforço central usam roughness mais alto e metalness mais baixo que as portas —
    // são superfícies lisas, SEM textura/bump quebrando o reflexo. Com o mesmo metalness das
    // portas (0,38) elas pegavam um reflexo especular forte e uniforme da directional light
    // azulada da cena (#b8c9e6), lendo como um risco azul saturado em vez de metal escuro real.
    const pbrFrame = { roughness: 0.82, metalness: 0.18 };
    return {
      leftTexture,
      rightTexture,
      leftBump,
      rightBump,
      frame: new THREE.MeshStandardMaterial({ ...pbrFrame, color: componente.corPrincipal }),
      metal: new THREE.MeshStandardMaterial({ color: componente.corMetal, roughness: 0.35, metalness: 0.85 }),
      leftDoor: new THREE.MeshStandardMaterial({ ...pbr, color: componente.corPrincipal, map: leftTexture, bumpMap: leftBump, bumpScale: BUMP_SCALE }),
      rightDoor: new THREE.MeshStandardMaterial({ ...pbr, color: componente.corPrincipal, map: rightTexture, bumpMap: rightBump, bumpScale: BUMP_SCALE }),
      interior: new THREE.MeshBasicMaterial({ color: componente.corInterior, toneMapped: false, side: THREE.DoubleSide }),
      tunelParede: new THREE.MeshStandardMaterial({ color: componente.corInterior, roughness: 0.88, metalness: 0.22 }),
      tunelNervura: new THREE.MeshStandardMaterial({ color: componente.corMetal, roughness: 0.55, metalness: 0.6 }),
    };
  }, [componente.corInterior, componente.corMetal, componente.corPrincipal]);

  useEffect(() => () => {
    assets.leftTexture?.dispose();
    assets.rightTexture?.dispose();
    assets.leftBump?.dispose();
    assets.rightBump?.dispose();
    assets.frame.dispose();
    assets.metal.dispose();
    assets.leftDoor.dispose();
    assets.rightDoor.dispose();
    assets.interior.dispose();
    assets.tunelParede.dispose();
    assets.tunelNervura.dispose();
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
  const cantos = [
    [-(outerW / 2 - 0.02), openingH + 0.02],
    [outerW / 2 - 0.02, openingH + 0.02],
    [-(outerW / 2 - 0.02), 0.02],
    [outerW / 2 - 0.02, 0.02],
  ] as const;

  return (
    <group
      ref={rootRef}
      name="Container_Body"
      scale={modoCapa ? [MODEL_SCALE * CONTAINER_CAPA_SCALE_X, MODEL_SCALE, MODEL_SCALE] : MODEL_SCALE}
    >
      <InteriorTunnel parede={assets.tunelParede} nervura={assets.tunelNervura} />
      {mostrarFundoInterior && (
        <mesh name="Transition_Backdrop" position={[0, centerY, -(INTERIOR_DEPTH - 0.1)]} material={assets.interior}>
          <planeGeometry args={[openingW, openingH]} />
        </mesh>
      )}
      <group name="Container_Frame">
        <mesh position={[0, openingH + 0.02, -0.02]} material={assets.frame}><boxGeometry args={[outerW, 0.1, 0.12]} /></mesh>
        <mesh position={[-(openingW / 2 + 0.02), centerY, -0.02]} material={assets.frame}><boxGeometry args={[0.1, outerH, 0.12]} /></mesh>
        <mesh position={[openingW / 2 + 0.02, centerY, -0.02]} material={assets.frame}><boxGeometry args={[0.1, outerH, 0.12]} /></mesh>
        {cantos.map(([x, y]) => <CornerCasting key={`${x}-${y}`} x={x} y={y} />)}
      </group>

      {/* Reforço central (astragal) — fixo, não gira com nenhuma porta. Tapa a folga de ~0,03
          entre as duas portas quando fechadas (sem ele, dava pra ver um fiapo do que está atrás
          pela fresta — inclusive a prévia do próximo slide, já ativa mesmo com a porta fechada).
          Bate com a referência real: containers de carga têm esse reforço visível na junção. */}
      <mesh name="Reforco_Central" position={[0, centerY, 0]} material={assets.frame}>
        <boxGeometry args={[0.05, openingH - 0.02, 0.05]} />
      </mesh>

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
