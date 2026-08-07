"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type AnimatedShaderBackgroundProps = {
  className?: string;
  /** Multiplicador final de brilho do shader. Default 0.9 (presença real, não decorativa). */
  intensidade?: number;
  /**
   * "hero": tela cheia (fixed inset-0), usado como elemento visual principal da página.
   * "sutil": relativo ao container pai (absolute inset-0), comportamento discreto original.
   * Default "sutil" para não quebrar usos existentes que não passem a prop.
   */
  variant?: "hero" | "sutil";
  /**
   * Pausa o loop de renderização (sem desmontar o WebGLRenderer) enquanto
   * `true`. O IntersectionObserver já pausa quando o elemento sai da
   * viewport, mas não detecta ser coberto por um modal `fixed` por cima —
   * um shader Three.js rodando a 60fps por trás de um modal com `<video>`
   * compete pelo mesmo pipeline de GPU/compositor e causa stuttering real de
   * decode de vídeo (frame congelado). Passe `true` enquanto qualquer modal
   * com player de vídeo estiver aberto na mesma página.
   */
  pausado?: boolean;
  /**
   * Cor 1 do gradiente animado (hex). Default reproduz o tom "indigo profundo"
   * original. Editável em tempo real (Alpha Presentation Studio, fundo "Aurora
   * dos Módulos") sem remontar a cena — lida a cada frame via ref.
   */
  corPrimaria?: string;
  /** Cor 2 do gradiente animado (hex). Default reproduz o tom "indigo claro" original. */
  corSecundaria?: string;
  /** Multiplicador de velocidade do shader (1 = ritmo original). Editável em tempo real. */
  velocidade?: number;
};

export default function AnimatedShaderBackground({
  className,
  intensidade = 0.9,
  variant = "sutil",
  pausado = false,
  corPrimaria = "#1e1b4b",
  corSecundaria = "#6366f1",
  velocidade = 1,
}: AnimatedShaderBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pausadoRef = useRef(pausado);
  const velocidadeRef = useRef(velocidade);
  const corPrimariaRef = useRef(corPrimaria);
  const corSecundariaRef = useRef(corSecundaria);

  // Padrão "latest ref": mutar ref.current direto no corpo do render é bloqueado pelo
  // React Compiler (react-hooks/refs) — os valores mais novos são sincronizados aqui e
  // lidos dentro de animate() a cada frame, sem precisar remontar a cena inteira.
  useEffect(() => {
    pausadoRef.current = pausado;
    velocidadeRef.current = velocidade;
    corPrimariaRef.current = corPrimaria;
    corSecundariaRef.current = corSecundaria;
  }, [pausado, velocidade, corPrimaria, corSecundaria]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // O container (position: absolute) pode reportar clientWidth 0 no instante
    // exato do mount, antes do browser computar o layout do elemento pai —
    // usar as dimensões reais só ficam confiáveis a partir do primeiro
    // ResizeObserver (que dispara uma vez, garantido, ao chamar observe()),
    // então o setSize inicial aqui é só um placeholder até esse callback rodar.
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    container.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
        iIntensidade: { value: intensidade },
        uCorPrimaria: { value: new THREE.Color(corPrimariaRef.current) },
        uCorSecundaria: { value: new THREE.Color(corSecundariaRef.current) },
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;
        uniform float iIntensidade;
        uniform vec3 uCorPrimaria;
        uniform vec3 uCorSecundaria;

        #define NUM_OCTAVES 3

        float rand(vec2 n) {
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 u = fract(p);
          u = u*u*(3.0-2.0*u);

          float res = mix(
            mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
            mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
          return res * res;
        }

        float fbm(vec2 x) {
          float v = 0.0;
          float a = 0.3;
          vec2 shift = vec2(100);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int i = 0; i < NUM_OCTAVES; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.4;
          }
          return v;
        }

        void main() {
          vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
          vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
          vec2 v;
          vec4 o = vec4(0.0);

          float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

          for (float i = 0.0; i < 35.0; i++) {
            v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
            float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 35.0));

            /* Mistura animada entre as 2 cores configuráveis (default reproduz a
               paleta indigo/slate original) — shimmer combina as 3 fases que antes
               moviam R/G/B de forma independente, agora aplicadas como 1 fator de mix. */
            float shimmer = (sin(i * 0.2 + iTime * 0.4) + cos(i * 0.3 + iTime * 0.5) + sin(i * 0.4 + iTime * 0.3)) / 3.0;
            vec4 auroraColors = vec4(mix(uCorPrimaria, uCorSecundaria, 0.5 + 0.5 * shimmer), 1.0);
            vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
            float thinnessFactor = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
            o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
          }

          o = tanh(pow(o / 100.0, vec4(1.6)));
          gl_FragColor = o * iIntensidade;
        }
      `,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId = 0;
    // O módulo roda dentro de um <iframe> que o painel mantém SEMPRE montado,
    // alternando só `display: none`/`block` entre abas (ver
    // PainelLayoutClient.tsx). `document.hidden`/`visibilityState` dentro de um
    // iframe reflete a aba do NAVEGADOR (documento top-level), não a
    // visibilidade do próprio iframe — em alguns navegadores/contextos ele
    // fica preso em "hidden" mesmo com o iframe visivelmente ativo na tela,
    // travando a animação para sempre. IntersectionObserver é o único sinal
    // confiável aqui: reage tanto a display:none/block quanto a scroll real.
    let elementoVisivel = false;

    const animate = () => {
      if (elementoVisivel && !pausadoRef.current) {
        material.uniforms.iTime.value += 0.016 * velocidadeRef.current;
        (material.uniforms.uCorPrimaria.value as THREE.Color).set(corPrimariaRef.current);
        (material.uniforms.uCorSecundaria.value as THREE.Color).set(corSecundariaRef.current);
        renderer.render(scene, camera);
      }
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const ajustarTamanho = () => {
      if (!container || container.clientWidth === 0) return;
      renderer.setSize(container.clientWidth, container.clientHeight);
      material.uniforms.iResolution.value.set(container.clientWidth, container.clientHeight);
    };

    const resizeObserver = new ResizeObserver(ajustarTamanho);
    resizeObserver.observe(container);
    // Garantia extra: se o container já nasceu com o tamanho final (comum
    // dentro de iframes), o ResizeObserver pode não disparar de novo depois
    // do reflow inicial — força uma segunda leitura no próximo frame.
    const rafId = requestAnimationFrame(ajustarTamanho);

    // Detecta quando a aba do módulo (o iframe) volta a ficar visível de
    // fato — dispara também o ajuste de tamanho, já que um elemento que
    // estava com display:none pode ter mudado de dimensão enquanto oculto.
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        elementoVisivel = entries[0]?.isIntersecting ?? false;
        if (elementoVisivel) ajustarTamanho();
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      container.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
    // intensidade só é lida na criação do material (uniform) — nenhum caller troca
    // intensidade dinamicamente hoje. velocidade/corPrimaria/corSecundaria SÃO
    // dinâmicas (editáveis ao vivo pelo Alpha Presentation Studio), mas são lidas
    // via ref dentro de animate() a cada frame — não precisam entrar nas deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "hero" usava `fixed` (relativo ao viewport) — mas o módulo roda dentro de
  // um <iframe> (PainelLayoutClient.tsx), e o viewport do documento do iframe
  // pode reportar 0x0 de forma persistente em certas condições de layout
  // (iframe absolute dentro de containers flex com overflow-hidden). `absolute
  // inset-0` ancorado no container relative da própria página é mais robusto.
  const posicionamentoPadrao = "absolute inset-0 -z-10 overflow-hidden pointer-events-none";
  void variant;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={className ?? posicionamentoPadrao}
    />
  );
}
