# Story: Background sideral do IAlpha

**ID:** STORY-IALPHA-001  
**Epic:** IAlpha  
**Status:** Ready for Review  
**Prioridade:** Media  
**Data criacao:** 2026-07-15  

---

## Narrativa

**Como** usuario da pagina principal do IAlpha,  
**quero** um fundo com clima de espaco sideral,  
**para** deixar a tela mais viva sem atrapalhar o uso do chat.

## Criterios de Aceitacao

- [x] A pagina principal `/PainelAlpha` usa um background escuro com estrelas em camadas.
- [x] O fundo possui sol, lua e planetas posicionados de forma sutil e bem atras do conteudo.
- [x] O efeito usa a cor do tema ativo como brilho secundario.
- [x] O background nao intercepta cliques e preserva a legibilidade do chat.
- [x] Animacoes sao reduzidas quando o navegador informa preferencia por menos movimento.
- [x] A alteracao fica limitada ao layout principal do IAlpha, sem afetar submodulos.
- [x] O visual muda por periodo do dia e os movimentos/posicoes dos astros usam a hora inicial da pagina.
- [x] A cena ganhou camadas extras de nebulosa, drift orbital e cometa sutil sem competir com o conteudo.

### Iteracao 2 — Sistema solar com posicoes astronomicas reais (2026-07-15)

- [x] Os 8 planetas ficam nas longitudes heliocentricas reais do momento atual (elementos keplerianos J2000 do JPL, sem API externa), recalculadas a cada minuto.
- [x] Validacao astronomica: Terra calculada em 292.9° para 15/jul — bate com o valor esperado (~293° = Sol geocentrico ~113° + 180°).
- [x] Sol fora do centro, sem linhas de orbita, plano orbital em perspectiva (elipse inclinada) e profundidade por escala/opacidade/blur conforme a metade da elipse.
- [x] Lua da Terra no angulo orbital real (13.176°/dia desde J2000).

### Iteracao 3 — Realismo visual dos planetas (2026-07-15)

- [x] Iluminacao direcional coerente: highlight e terminador de cada planeta apontam para o sol da cena (atan2 da posicao relativa); lado escuro definido.
- [x] Texturas procedurais SVG feTurbulence inline (sem requests externos, sem costura, tileaveis) com rotacao propria animada, inclinacao axial e direcoes distintas (Venus retrogrado).
- [x] Gigantes gasosos com faixas atmosfericas + noise anisotropico; Grande Mancha em Jupiter; mancha escura em Netuno; calotas/continentes/crateras nos rochosos.
- [x] Aneis de Saturno em gradiente translucido com divisao de Cassini (substituiu o border de 1px).
- [x] Nuvens da Terra em camada propria (mix-blend-screen) girando em velocidade diferente da superficie.
- [x] Atmosfera sutil por inset box-shadow no limbo iluminado — sem efeito neon.
- [x] Profundidade: planetas distantes com blur, menor saturacao e menor contraste.
- [x] Estrelas com variacao de temperatura de cor (brancas/azuladas, raras quentes) + camada de estrelas brilhantes com glow.
- [x] Centro preservado limpo para logo, saudacao e campo de mensagem (vinheta mantida).

### Iteracao 4 — Rotacao propria ancorada no relogio (2026-07-15)

- [x] Cada planeta gira com seu periodo de rotacao sideral real (Mercurio 1407.6h ... Jupiter 9.93h), acelerado por fator fixo (1s = 15min simulados) para ser perceptivel.
- [x] Fase do giro deterministica derivada de Date.now(): mesma data/hora → mesma face visivel, via animation-delay negativo em keyframes CSS (timeline do documento mantem sincronia com o relogio mesmo com aba em background).
- [x] Venus e Urano giram em sentido retrogrado (animation-direction: reverse), como na realidade.
- [x] Nuvens da Terra com fase propria (periodo 0.68x) tambem ancorada no relogio.
- [x] Prova no browser: os 8 planetas com duracao exata do periodo esperado, delays de fase nao-nulos e direcoes corretas (verificado via getComputedStyle).

### Iteracao 5 — Orbitas visiveis com tempo acelerado (2026-07-15)

- [x] Problema: com tempo 100% real, planetas parecem fixos (Mercurio anda ~4°/DIA). Solucao padrao planetario: cena abre no ceu real de agora e o tempo avanca acelerado (ORBIT_TIME_LAPSE = 80000).
- [x] Movimento medido (viewport 1280x800): Mercurio 7.3px/s (volta em ~1.6min), Venus 4.6px/s, Terra 3.6px/s, Marte 1.9px/s, Jupiter 0.5px/s (~1.3h), Netuno quase estatico (~18h) — hierarquia real preservada.
- [x] Lua orbita a Terra em ~29s.
- [x] Tick de cena a cada 2s + transition CSS linear em left/top = movimento continuo sem saltos; iluminacao/terminador recalculados por tick.
- [x] SPIN_TIME_LAPSE 900 → 3600: rotacao das texturas perceptivel (Terra gira em ~24s, Jupiter ~10s).
- [x] Recarregar a pagina ressincroniza com o ceu real do momento; prefers-reduced-motion desliga a aceleracao (tempo real, estatico).
- [ ] Verificacao visual in-app pendente: a sessao de login do preview expirou durante os testes (heartbeat/pusher 401 → app cai em "Application error", bug preexistente registrado). Mecanica provada por script com a matematica exata do componente.

## Verificacao (iteracoes 2 e 3)

- [x] `npx eslint src/components/BibbleChatHome/IAlphaCosmicBackground.tsx` sem erros.
- [x] `npx tsc --noEmit` sem NENHUM erro novo (persistem apenas os 4 preexistentes em ExclusaoFiscal/HabilitacaoRadar/ModalPerfilColaborador).
- [x] Script de validacao das efemerides executado: longitudes heliocentricas corretas para a data atual.
- [x] Verificacao visual no dev server (desktop 1280, viewport padrao e mobile 375x812): cena renderiza, centro legivel, sem erros novos no console (persiste hydration mismatch preexistente de Radix DropdownMenu, fora do escopo).

## Arquivos Modificados

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/components/BibbleChatHome/IAlphaCosmicBackground.tsx` | criado | Fundo sideral com estrelas deterministicas, sol, lua, planetas e nebulosa por tema. |
| `src/components/BibbleChatHome/BibbleChatWindow.tsx` | modificado | Aplica o background sideral atras do conteudo principal do IAlpha. |
| `src/components/BibbleChatHome/BibbleChatLayout.tsx` | modificado | Propaga a hora inicial para o fundo sideral. |
| `src/app/PainelAlpha/page.tsx` | modificado | Calcula a hora atual em `America/Sao_Paulo` no Server Component. |
| `.bibble/memory/components.md` | modificado | Registra o novo componente visual `IAlphaCosmicBackground`. |

## Verificacao

- [ ] `npm run lint` bloqueado por erros preexistentes fora do escopo (`.agents/`, `.aiox-core/`, componentes legados e regras React Compiler).
- [x] `npx eslint src/components/BibbleChatHome/IAlphaCosmicBackground.tsx src/components/BibbleChatHome/BibbleChatWindow.tsx src/components/BibbleChatHome/BibbleChatLayout.tsx src/app/PainelAlpha/page.tsx` concluido sem erros.
- [ ] `npm run typecheck` bloqueado por erros preexistentes em `api/ExclusaoFiscal`, `HabilitacaoRadar` e `ModalPerfilColaborador`.
- [x] `npm test` concluido sem erros: 3 arquivos, 19 testes.
- [ ] `npx tsc --noEmit --pretty false` bloqueado pelos mesmos erros preexistentes em `api/ExclusaoFiscal`, `HabilitacaoRadar` e `ModalPerfilColaborador`.
- [x] `git diff --check` concluido sem erros.
