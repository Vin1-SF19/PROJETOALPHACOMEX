# CodeRabbit Review — Container Alpha como introdução

## Execução

- Escopo: alterações não commitadas da story.
- CodeRabbit CLI: indisponível porque o Windows Subsystem for Linux não está instalado.
- Fallback aplicado: revisão manual focada + ESLint focado + testes + build do Next.js.

## Resultado

| Severidade | Quantidade | Status |
|---|---:|---|
| CRITICAL | 0 | Aprovado |
| HIGH | 0 | Aprovado |
| MEDIUM | 0 | Aprovado |
| LOW | 1 | Corrigido |

## Finding corrigido

- **LOW — primeiro frame da câmera antes do enquadramento:** o `useFrame` poderia interpolar com vetores ainda não calculados. Foi adicionado `enquadradoRef`, impedindo atualização até a bounding box estar pronta.

## Verificações manuais

- O container apenas emite o evento; a navegação permanece no apresentador.
- A camada do próximo slide mantém `key={slide.id}` durante e depois da revelação.
- Timers, controles Framer Motion e fontes Web Audio são interrompidos no cleanup.
- Clique e teclado não avançam enquanto a introdução está ativa.
- Sem próximo slide, o callback não promove índice inexistente.
- `prefers-reduced-motion` elimina a animação prolongada.
- Defaults Zod mantêm JSONs antigos compatíveis.

## Evidências

- ESLint focado: aprovado, sem warnings.
- Vitest focado: 15/15 testes aprovados após a correção do portal interior.
- Teste intermitente do Google Calendar + container, isolados: 16/16 aprovados.
- `npx next build`: aprovado, 68 páginas geradas.
- `git diff --check`: aprovado.

## Decisão

**PASS** — nenhum finding CRITICAL ou HIGH na story. Os bloqueios globais restantes são baselines externos documentados na story.

## Correção visual posterior

- O `Transition_Backdrop` branco deixa de ser renderizado quando há próximo slide.
- A câmera projeta os quatro limites úteis da abertura para coordenadas CSS.
- O próximo slide é renderizado atrás do Canvas transparente, com escala `cover`, enquanto portas e moldura permanecem no WebGL acima.
- O mesmo retângulo projetado inicia o `clip-path` da expansão, eliminando desalinhamento entre prévia e zoom.

## Prévia no editor

- O estado do editor agora mantém os componentes de todos os slides e resolve o próximo slide pela ordem vigente.
- O portal do container é compartilhado entre editor e apresentação, evitando dois renderizadores divergentes.
- Quando não há slide seguinte, o interior mostra “Adicione um slide para ver a prévia” e nenhum zoom sem destino é disparado.
- Um novo Container Alpha é criado aberto apenas no editor, deixando a prévia visível assim que o componente é inserido.
- Evidências atualizadas: ESLint focado aprovado, Vitest 17/17 e `npx next build` aprovado com 68 páginas.

## Enquadramento de capa

- No modo apresentação, a caixa editável do componente é substituída pela caixa canônica completa de 1280×720.
- O Canvas 3D passa a recalcular a câmera sobre essa área inteira, mantendo o modelo centralizado e responsivo.
- A abertura projetada e o fallback do `clip-path` usam a mesma origem de tela inteira, evitando cortes e deslocamento no zoom.
- As coordenadas e dimensões escolhidas pelo usuário continuam intactas no editor e no JSON persistido.

## Player modal controlável

- O botão “Apresentar” salva o slide ativo antes de abrir a reprodução, evitando conteúdo desatualizado no iframe.
- A rota embutida não solicita fullscreen e calcula a escala do palco apenas na área útil acima da barra de controles.
- O modal oferece reiniciar, anterior, pausar/reproduzir, próximo e fechar, com atalhos de setas, espaço e Escape.
- A pausa interrompe animações DOM/Framer Motion, controles numéricos da abertura e do zoom, áudio em curso e o frameloop R3F; ao reproduzir, a sequência continua do mesmo progresso.
- `postMessage` de fechamento é aceito somente quando `event.origin` corresponde à origem atual.
- Evidências: ESLint focado aprovado, Vitest 17/17, `git diff --check` aprovado e `npx next build` concluído com 68 páginas.

## Promoção definitiva para capa

- `SlideApresentacaoLayer` mantém uma camada exclusiva, absoluta e do tamanho integral do palco para o Container Alpha.
- `portalContainerCapa` é propagado recursivamente por `RenderComponente`, alcançando containers aninhados em card, grid ou container genérico.
- No modo apresentação, `ContainerCargaRender` usa `createPortal`; portanto dimensões, posição e `overflow` dos ancestrais não recortam nem deslocam a capa.
- Editor e prévias continuam no fluxo inline normal; a promoção ocorre apenas no player.
- O modal passou a ocupar 98% do viewport e a barra de controles foi reduzida para ampliar a área útil.
- Evidências após a correção: ESLint focado aprovado, Vitest 17/17 e `npx next build` aprovado com 68 páginas.

## Escala visual da capa e navegação direta

- O problema remanescente estava na proporção quase vertical do modelo 3D e no `FRAME_FILL = 0.88`, não no tamanho do modal.
- Em modo capa, `ContainerCargaModel` aplica escala horizontal 2,3× e `ContainerCargaCameraRig` usa preenchimento de 94%; o editor mantém a escala original.
- A bounding box e a projeção da abertura são recalculadas depois da escala, preservando o alinhamento da prévia e do zoom.
- O player recebeu um `input[type=range]` acessível que salta diretamente ao slide selecionado e cancela com segurança qualquer introdução em curso.
- Evidências: ESLint focado aprovado, Vitest 17/17, `git diff --check` aprovado e build com 68 páginas.
