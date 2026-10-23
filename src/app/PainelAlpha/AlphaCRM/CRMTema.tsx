'use client';

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cookieCrmTema, type CrmTema } from './crm-tema';

const DURACAO_REVELACAO_MS = 900;
const EASING_REVELACAO = 'cubic-bezier(0.65, 0, 0.35, 1)';

interface OndaTema {
  id: number;
  x: number;
  y: number;
  raio: number;
  destino: CrmTema;
}

function raioAteCantoMaisDistante(x: number, y: number) {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
}

/**
 * Estado do tema do CRM. O atributo `data-crm-tema` vai para o <html> enquanto o CRM
 * está montado (modais e sheets abrem em portal, fora do .crm-scope) e sai ao desmontar,
 * para não vazar para os outros módulos do painel.
 *
 * Transição: revelação circular a partir do botão (View Transitions API) com uma onda
 * luminosa acompanhando a borda. Sem suporte à API, as cores fazem crossfade suave;
 * com prefers-reduced-motion, a troca é imediata.
 */
export function useCrmTema(temaInicial: CrmTema) {
  const [tema, setTema] = useState<CrmTema>(temaInicial);
  const [onda, setOnda] = useState<OndaTema | null>(null);
  const transicionando = useRef(false);

  useLayoutEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.crmTema = tema;
    return () => {
      delete raiz.dataset.crmTema;
    };
  }, [tema]);

  const alternar = useCallback((origem: { x: number; y: number }) => {
    if (transicionando.current) return;
    const destino: CrmTema = tema === 'escuro' ? 'claro' : 'escuro';
    document.cookie = cookieCrmTema(destino);

    const raiz = document.documentElement;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTema(destino);
      return;
    }

    transicionando.current = true;
    const novaOnda: OndaTema = { id: Date.now(), ...origem, raio: raioAteCantoMaisDistante(origem.x, origem.y), destino };

    if (typeof document.startViewTransition !== 'function') {
      raiz.classList.add('crm-tema-animando');
      setTema(destino);
      setOnda(novaOnda);
      window.setTimeout(() => {
        raiz.classList.remove('crm-tema-animando');
        transicionando.current = false;
      }, DURACAO_REVELACAO_MS);
      return;
    }

    raiz.classList.add('crm-tema-vt');
    const transicao = document.startViewTransition(() => {
      flushSync(() => setTema(destino));
    });
    transicao.ready
      .then(() => {
        // A nova visão é "ao vivo": a onda entra agora para começar junto com o recorte.
        setOnda(novaOnda);
        const { x, y, raio } = novaOnda;
        raiz.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
          { duration: DURACAO_REVELACAO_MS, easing: EASING_REVELACAO, pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => undefined);
    transicao.finished.finally(() => {
      raiz.classList.remove('crm-tema-vt');
      transicionando.current = false;
    });
  }, [tema]);

  const encerrarOnda = useCallback(() => setOnda(null), []);

  return { tema, alternar, onda, encerrarOnda };
}

/** Onda luminosa que acompanha a borda da revelação do novo tema. */
export function CRMTemaOnda({ onda, onFim }: { onda: OndaTema | null; onFim: () => void }) {
  if (!onda) return null;
  const estilo = {
    left: onda.x,
    top: onda.y,
    width: onda.raio * 2,
    height: onda.raio * 2,
    '--crm-onda-duracao': `${DURACAO_REVELACAO_MS}ms`,
    '--crm-onda-easing': EASING_REVELACAO,
  } as CSSProperties;
  return (
    <span
      key={onda.id}
      aria-hidden="true"
      className={cn('crm-tema-onda', onda.destino === 'claro' ? 'crm-tema-onda--claro' : 'crm-tema-onda--escuro')}
      style={estilo}
      onAnimationEnd={onFim}
    />
  );
}

export function CRMTemaToggle({ tema, onAlternar }: { tema: CrmTema; onAlternar: (origem: { x: number; y: number }) => void }) {
  const claro = tema === 'claro';
  const rotulo = claro ? 'Ativar tema escuro' : 'Ativar tema claro';

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const caixa = event.currentTarget.getBoundingClientRect();
    // Teclado não tem coordenada de clique: a onda nasce do centro do botão.
    const doMouse = event.clientX !== 0 || event.clientY !== 0;
    onAlternar({
      x: doMouse ? event.clientX : caixa.left + caixa.width / 2,
      y: doMouse ? event.clientY : caixa.top + caixa.height / 2,
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={claro}
      aria-label="Tema claro"
      title={rotulo}
      onClick={handleClick}
      className="crm-tema-toggle"
      data-tema={tema}
    >
      <Moon size={13} aria-hidden="true" className="crm-tema-toggle__icone crm-tema-toggle__icone--lua" />
      <Sun size={13} aria-hidden="true" className="crm-tema-toggle__icone crm-tema-toggle__icone--sol" />
      <span className="crm-tema-toggle__knob" aria-hidden="true">
        {claro ? <Sun size={14} /> : <Moon size={14} />}
      </span>
    </button>
  );
}
