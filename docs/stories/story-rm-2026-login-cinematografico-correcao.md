# Story RM-2026 — Correção do login cinematográfico

## Status

Ready for Review

## Objetivo

Restabelecer a autenticação correta da tela de login e executar a transição cinematográfica somente depois de um login bem-sucedido, fazendo o navio e o mar atravessarem a viewport enquanto o Painel Alpha autenticado é revelado atrás do overlay.

## Story

Como usuário do Painel Alpha,
quero que minhas credenciais sejam validadas antes de qualquer transição visual,
para receber o erro conhecido quando o login for inválido e entrar no painel por uma transição contínua quando o login for válido.

## Acceptance Criteria

1. Ao submeter o formulário, as credenciais são enviadas à autenticação antes que qualquer animação de sucesso, navio, mar ou navegação seja iniciada.
2. Quando as credenciais forem inválidas, a tela permanece no login, não inicia nenhuma parte da transição cinematográfica e exibe a mensagem antiga `Dados de Login Incorretos`.
3. Quando a autenticação for bem-sucedida e a sessão estiver estabelecida, a transição de sucesso é iniciada exatamente uma vez.
4. O navio e o mar aparecem somente no fluxo de sucesso e atravessam a viewport como uma composição visual coordenada.
5. Durante a troca para `/PainelAlpha`, o overlay da transição permanece montado acima da navegação, sem piscar, reiniciar ou desaparecer prematuramente.
6. A rota autenticada é carregada atrás do overlay e revelada progressivamente pela passagem do navio e do mar; ao final, o overlay é removido e o Painel Alpha permanece utilizável.
7. O fluxo não permite nova submissão enquanto a autenticação ou a transição estiver em andamento.
8. Com `prefers-reduced-motion: reduce`, o login continua autenticando antes da navegação, usa uma confirmação visual curta sem travessia prolongada e conclui no Painel Alpha.
9. Quando WebGL estiver indisponível ou falhar ao inicializar, a transição de sucesso utiliza o fallback visual do oceano e conclui normalmente.
10. Os contratos atuais de proteção de `/PainelAlpha`, status de acesso do usuário e mensagem de credencial inválida permanecem preservados.
11. Testes automatizados cobrem os caminhos de sucesso, credencial inválida, ordem autenticação-transição-navegação, persistência do overlay, reduced motion e fallback; os gates obrigatórios do projeto são executados antes da conclusão.
12. Após o sucesso, `Acesso autorizado` aparece por 250–400 ms e o card real do formulário é reduzido e ocultado fisicamente dentro de `containernavio.png`.
13. O container entra com profundidade, abre duas portas para fora, recebe o card, fecha e exibe um pulso curto de selamento antes de seguir ao navio.
14. Mar e navio entram durante o transporte; a buzina toca somente após o embarque, no início da partida, e a rota real é revelada durante a travessia.
15. Os assets do container, navio e buzina são pré-carregados; a composição usa unidades responsivas e não executa container, oceano ou navio em reduced motion.
16. Em desenvolvimento, uma rota de preview permite observar o mar continuamente ou repetir a transição completa sem autenticar; a mesma rota responde 404 fora de `NODE_ENV=development`.
17. O material do mar noturno apresenta microtextura, cristas frias, espuma fina e reflexos fragmentados, com detalhe atenuado à distância, preservando a geometria, o movimento e os tempos atuais.
18. Uma camada de água em primeiro plano cobre apenas a base do casco e acompanha o navio com espuma discreta na proa e na lateral, mantendo o asset e sua trajetória.
19. O empacotamento aprovado é preservado; o navio chega ao container mantido no centro, para para receber a carga e só parte após o embarque visual.
20. Na partida, o asset local `Corda Náutica com Laços Simétricos.png` conecta a popa à borda da página real de `/PainelAlpha`, que é puxada de forma sincronizada, sem screenshot ou mudança de autenticação.

## Tasks / Subtasks

- [x] Task 1 — Corrigir o contrato de autenticação do formulário (AC: 1, 2, 3, 7, 10)
  - [x] Remover o bloqueio que impede a submissão real da Server Action.
  - [x] Fazer a action retornar um resultado discriminado de sucesso ou falha sem navegar antes da orquestração visual.
  - [x] Preservar exatamente a mensagem `Dados de Login Incorretos` para credenciais inválidas.
  - [x] Manter o botão bloqueado enquanto a autenticação estiver pendente.
  - [x] Disparar o estado visual de erro somente após uma resposta inválida.

- [x] Task 2 — Centralizar a sequência de estados do login (AC: 1–7)
  - [x] Modelar a sequência `idle -> validating -> auth_error | authorized -> covering -> navigation -> traversing -> revealed`.
  - [x] Substituir o callback global em `window` por um contrato explícito entre formulário, cena e orquestrador.
  - [x] Garantir que falha de autenticação nunca alcance estados de sucesso.
  - [x] Garantir idempotência contra clique duplo, Enter repetido ou callback duplicado.

- [x] Task 3 — Tornar o overlay persistente entre as rotas (AC: 3, 5, 6, 10)
  - [x] Montar a orquestração da transição em um nível compartilhado que sobreviva à saída de `/` e à entrada em `/PainelAlpha`.
  - [x] Navegar somente depois de a sessão estar disponível para o middleware e para os layouts autenticados.
  - [x] Manter o overlay cobrindo a troca de rota até o Painel Alpha estar renderizado atrás dele.
  - [x] Remover o overlay somente após o checkpoint final da animação.

- [x] Task 4 — Ajustar navio, mar e revelação (AC: 4, 5, 6)
  - [x] Usar um único progresso coordenado para deslocamento do navio, mar e máscara de revelação.
  - [x] Fazer a passagem revelar a tela autenticada real atrás do overlay.
  - [x] Evitar fundo opaco residual, salto de posição, remontagem e flash da tela de login.
  - [x] Evitar atualizações de estado React desnecessárias a cada frame quando transformações por ref/CSS forem suficientes.

- [x] Task 5 — Implementar caminhos acessíveis de degradação (AC: 8, 9)
  - [x] Preservar autenticação e navegação no modo de movimento reduzido.
  - [x] Ativar o fallback CSS quando WebGL não existir ou quando o renderer falhar durante a inicialização.
  - [x] Tratar a reprodução da buzina como efeito opcional que nunca bloqueia a entrada.

- [x] Task 6 — Adicionar cobertura de regressão (AC: 1–11)
  - [x] Testar que credenciais inválidas exibem o erro antigo e não montam a transição.
  - [x] Testar que credenciais válidas estabelecem a sessão antes de iniciar a transição.
  - [x] Testar a ordem dos estados e a execução única da navegação.
  - [x] Testar que o overlay permanece durante a mudança de rota e revela o Painel Alpha ao final.
  - [x] Testar submissão por clique e Enter, inclusive proteção contra repetição.
  - [x] Testar `prefers-reduced-motion` e indisponibilidade/falha de WebGL.

- [ ] Task 7 — Executar os quality gates (AC: 11)
  - [x] Executar testes direcionados do login, autenticação e preview — PASS, 29/29.
  - [x] Executar `npm run lint` — executado; FAIL global com 21.198 problemas do baseline externo, sem regressão atribuída ao escopo.
  - [x] Executar `npm run typecheck` — executado; FAIL somente por baseline externo conhecido.
  - [x] Executar `npm test` — executado; 2.869 testes PASS, 28 FAIL e 1 TODO, com falhas em módulos externos ao escopo.
  - [x] Executar `npm run build` — PASS.
  - [ ] Executar CodeRabbit conforme a configuração do projeto — não executado: CLI não instalado no ambiente.
  - [x] Atualizar checklist, Dev Agent Record e File List antes de mover a story para revisão.

- [x] Task 8 — Adicionar etapa visual de carga e embarque (AC: 12–15)
  - [x] Pré-carregar e utilizar exclusivamente o asset local `containernavio.png`.
  - [x] Manter o card real montado e animá-lo com escala, perspectiva, brilho, blur e clipping até o interior do container.
  - [x] Compor interior, portas recortadas com abertura para fora, moldura frontal e pulso visual de selamento.
  - [x] Transportar o container por trajetória responsiva até a área de carga do navio.
  - [x] Separar aproximação, embarque, buzina, partida, handoff da rota e saída do navio.
  - [x] Preservar o caminho curto `Acesso autorizado → fade → painel` para reduced motion.
  - [x] Garantir que falha de autenticação não monte nenhum elemento da nova etapa.

- [x] Task 9 — Criar bancada visual exclusiva de desenvolvimento (AC: 16)
  - [x] Reutilizar os componentes reais de oceano, card, container e navio sem invocar autenticação ou navegação.
  - [x] Disponibilizar modos `Mar contínuo` e `Transição completa`, com replay manual e loop automático.
  - [x] Bloquear a rota com `notFound()` em qualquer ambiente diferente de desenvolvimento.

- [x] Task 10 — Refinar somente o material do oceano e o contato com o casco (AC: 17–18)
  - [x] Preservar integralmente o vertex shader de ondas, câmera e timeline.
  - [x] Ajustar iluminação, microtextura, reflexos e espuma no material atual.
  - [x] Aplicar oclusão rasa e espuma junto ao casco na cena real e na prévia.
  - [x] Conferir a aparência no navegador e executar os gates do projeto.

- [x] Task 11 — Sincronizar atracação, embarque e reboque da página (AC: 19–20)
  - [x] Manter a animação do card e a abertura/selamento das portas.
  - [x] Calcular encontro navio/container responsivo e aguardar embarque antes da buzina/partida.
  - [x] Pré-carregar a corda e conectar suas pontas à popa e à borda móvel da página real.
  - [x] Preservar autenticação, destino, reduced motion e caminhos de falha.
  - [x] Validar geometria, sequência, prévia, lint, typecheck, testes e build; atualizar file list.

## Dev Notes

### Causa raiz confirmada

- Em `src/components/loginForm.tsx`, o novo `onSubmit` executa `preventDefault()`, impede `formAction` de chegar a `loginAction` e dispara a transição global incondicionalmente.
- Como a autenticação não ocorre, nenhum cookie de sessão é criado; ao fim da animação, a navegação direta para `/PainelAlpha` encontra a rota protegida sem sessão válida.
- O fluxo atual também inicia a animação com credenciais erradas porque não aguarda uma resposta da autenticação.
- `src/lib/loginAction.ts` usa redirect automático no sucesso, portanto o client não recebe um resultado de sucesso utilizável para coordenar a animação.
- `LoginSuccessTransition` está montado dentro da página de login. Uma navegação normal desmonta essa árvore, impedindo que o overlay permaneça enquanto o Painel Alpha real é carregado atrás.
- O estado `error` de `LoginScene` não é alimentado pelo resultado do formulário.

### Fluxo esperado

1. O formulário entra em `validating` e executa a autenticação.
2. Em falha, retorna para `auth_error`, mostra `Dados de Login Incorretos` e não monta navio ou mar.
3. Em sucesso, com sessão estabelecida, entra em `authorized` e monta o overlay persistente.
4. O overlay transparente bloqueia novas interações, mas mantém o login visível; navio e mar iniciam a travessia diretamente sobre essa tela.
5. Quando o navio ocupa o centro da viewport, a navegação client-side carrega `/PainelAlpha` atrás da composição e a travessia continua até liberar o painel.
6. Ao terminar, o overlay é desmontado e o estado da transição é limpo.

### Integration Points

- `src/lib/loginAction.ts` — autenticação por credenciais e retorno de erro existente.
- `src/components/loginForm.tsx` — submissão, pending, mensagem inválida e callback de sucesso.
- `src/components/login/LoginScene.tsx` — composição da tela e conexão com a orquestração.
- `src/components/login/LoginSuccessTransition.tsx` — fases, navio, buzina e conclusão visual.
- `src/components/login/Ocean.tsx` — oceano WebGL e fallback CSS.
- `src/components/login/LoginCard.tsx` — estado visual de erro/atividade.
- `src/components/login/useReducedMotion.ts` — preferência de movimento reduzido.
- `src/app/layout.tsx` — nível persistente entre `/` e `/PainelAlpha` para hospedar o overlay.
- `src/app/page.tsx` — entrada da cena de login e preload dos assets.
- `src/app/globals.css` — keyframes e classes visuais do login.
- `auth.ts`, `middleware.ts` e `src/app/PainelAlpha/layout.tsx` — autoridades atuais de sessão e proteção da rota; devem ser preservadas.
- `auth.config.ts` — consultado no diagnóstico; atualmente não é consumido pelo runtime identificado e não deve virar uma segunda autoridade de autenticação.
- Assets locais reutilizados: `public/BackgroundAtualizado.png`, `public/containernavio.png`, `public/NavioLogin.png` e `public/sounds/buzina.mp3`.

### Estrutura sugerida

- Criar um orquestrador client-side persistente em `src/components/login/LoginTransitionProvider.tsx`, montado pelo root layout.
- Isolar a máquina de estados e os checkpoints temporais em helper puro testável, evitando que regras de autenticação dependam de temporizadores visuais.
- Manter autenticação, transição e navegação como etapas distintas: nenhuma animação autoriza acesso e nenhuma animação deve iniciar antes da autenticação.

### Riscos e atenção

- Navegar antes de o cookie estar disponível ao middleware reproduz o redirecionamento de acesso bloqueado.
- Manter o overlay dentro de `src/app/page.tsx` faz a animação desmontar na troca de rota.
- `window.location.assign` força reload completo e impede a revelação contínua; a navegação precisa preservar o orquestrador compartilhado.
- O overlay atual usa `pointer-events-none`; durante o sucesso, a interface deve impedir novas submissões sem bloquear a conclusão automática.
- O oceano atual permanece estático; sem um progresso compartilhado, ele não acompanha o navio nem produz o efeito de puxar/revelar.
- A detecção inicial de WebGL não cobre falha posterior na criação do renderer; esse caminho precisa ativar o fallback.
- Atualizar estado React em cada `requestAnimationFrame` pode provocar renders excessivos durante a travessia.

### Testing

- Usar Vitest para contratos da action, máquina de estados, ordem dos callbacks, idempotência, reduced motion e fallback.
- Cobrir o formulário no nível de componente disponível no projeto ou, na ausência de harness DOM, manter a decisão de transição em helper puro e adicionar verificação de integração do wiring.
- Validar em navegador a continuidade real entre `/` e `/PainelAlpha`, incluindo ausência de flash, travessia completa e interação após remoção do overlay.
- Regressões existentes de status de acesso, heartbeat e navegação de sessão devem continuar passando.

## Checklist de Pronto para Revisão

- [x] Todos os Acceptance Criteria possuem evidência automatizada direcionada; validação E2E/browser autenticado permanece pendente.
- [x] Credenciais inválidas nunca iniciam efeitos de sucesso.
- [x] Sessão válida existe antes da navegação protegida.
- [x] Overlay persiste no wiring da troca de rota e revela o Painel Alpha; confirmação visual em browser autenticado permanece pendente.
- [x] Reduced motion e fallback WebGL foram validados por testes direcionados e revisão estática.
- [x] Nenhuma regra de autorização foi movida para o client.
- [x] Lint, typecheck, testes, build e indisponibilidade do CodeRabbit foram registrados.
- [x] File List contém todos e somente os arquivos realmente afetados no escopo desta story.

## CodeRabbit Integration

**Story Type:** Frontend + autenticação + integração de navegação  
**Complexity:** Alta — coordena Server Action, cookie, middleware, layouts persistentes e animação entre rotas.

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): CodeRabbit não executado porque a CLI não está instalada; revisão equivalente foi coberta por Lens e Anubis.
- [ ] Pre-PR (@devops): CodeRabbit não executado porque a CLI não está instalada; executar quando a ferramenta estiver disponível.

### Self-Healing Configuration

- Primary Agent: `@dev` em modo light.
- Max Iterations: 2.
- Timeout: 15 minutos.
- CRITICAL: corrigir automaticamente.
- HIGH: documentar para revisão.

### Focus Areas

- Nenhuma transição antes da confirmação de autenticação.
- Nenhum bypass client-side de middleware ou layout protegido.
- Persistência e cleanup correto do overlay, timers, RAF, áudio e renderer.
- Acessibilidade de erro, pending e movimento reduzido.
- Ausência de flash/reload durante a revelação da rota autenticada.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-11 | 1.0 | Story criada a partir do diagnóstico Scout do login cinematográfico. | River |
| 2026-09-11 | 1.1 | Implementação concluída, evidências de desenvolvimento e QA registradas e story movida para Ready for Review. | Codex |
| 2026-09-11 | 1.2 | Removida a tela opaca intermediária; navio e oceano agora começam sobre o login e fazem o handoff de rota no centro da travessia. | Codex |
| 2026-09-11 | 1.3 | Adicionada a etapa cinematográfica de empacotamento do formulário, selamento do container, embarque e partida coordenada. | Codex |
| 2026-09-11 | 1.4 | Adicionada bancada local de preview contínuo do oceano e replay da transição, indisponível em produção. | Codex |
| 2026-09-11 | 1.5 | Refinado somente o material da água e o contato visual com o casco, sem alterar ondas, câmera, asset ou timeline. | Codex |
| 2026-09-11 | 1.6 | Navio atraca sob o container, recebe a carga e parte rebocando a rota real com o PNG de corda fornecido. | Codex |

## Dev Agent Record

### Agent Model Used

Codex — agente de implementação e revisão desta sessão.

### Debug Log References

- Story e blueprint: `docs/stories/story-rm-2026-login-cinematografico-correcao.md`.
- Testes direcionados: `tests/auth/login-action.test.ts`, `tests/auth/login-transition-state.test.ts` e `tests/auth/login-transition-wiring.test.ts`.
- Não foi criado debug log separado.

### Completion Notes List

- Autenticação passou a concluir e confirmar a sessão antes de liberar qualquer estado visual de sucesso.
- Credenciais inválidas preservam `Dados de Login Incorretos` e não montam navio, oceano ou overlay.
- Máquina de estados e provider no layout raiz preservam o overlay durante `router.replace("/PainelAlpha")` e aguardam o pathname protegido antes do reveal.
- Transição e oceano usam carregamento dinâmico; o bloqueio transparente, watchdog e Error Boundary evitam interação ou espera permanente se o chunk falhar.
- A antiga página opaca intermediária foi removida: a confirmação curta `Acesso autorizado`, o container, o navio e o oceano são compostos diretamente sobre o login até o checkpoint de troca para o painel.
- A narrativa foi ampliada sem tocar na autenticação: confirmação curta, card real empacotado entre interior/portas do novo container, selamento, transporte, aproximação do navio, embarque, buzina e partida.
- As portas usam recortes parciais do próprio `containernavio.png`, com pivôs nas dobradiças externas e rotações Y opostas; não há screenshot nem cópia falsa do formulário.
- Navio aguarda carregamento com timeout seguro; reduced motion não monta navio nem WebGL; RAF, timers, áudio e renderer possuem cleanup.
- ESLint direcionado PASS; testes direcionados do login e preview PASS (29/29); diff-check PASS; build final PASS.
- A timeline foi inspecionada em navegador nas resoluções 1366×768, 1440×900 e 1920×1080; o console permaneceu sem exceções durante a sequência visual isolada.
- A rota `/dev/login-transition-preview` permite observar o mar continuamente e repetir a sequência completa por loop ou pela tecla `R`, sem submeter o formulário; em produção, a página executa `notFound()`.
- Gates globais foram reexecutados após o preview, mas mantêm débitos externos conhecidos: typecheck global FAIL apenas por baseline externo; lint global FAIL com 21.198 problemas de baseline; `npm test` global com 2.869 PASS, 28 FAIL e 1 TODO em módulos externos.
- E2E/browser autenticado manual permanece pendente; nenhuma credencial autenticada foi usada para afirmar validação visual real.
- CodeRabbit não foi executado porque a CLI não está instalada no ambiente.

### Refinamento visual do oceano — 2026-09-11

- `ocean-material.ts` isola apenas o fragment shader: normal em espaço global, microtextura de capilaridade, cristas frias, espuma esparsa, reflexos azul/vermelho fragmentados e detalhe reduzido à distância. Nenhuma biblioteca ou imagem adicional.
- O vertex shader, geometria, câmera, relógio e loop de renderização foram comparados ao snapshot anterior desta edição e permaneceram idênticos. A máscara superior suaviza a emenda visual do próprio oceano, sem mudar background ou movimento.
- `ShipWaterContact` é uma camada SVG decorativa compartilhada pela travessia e pela prévia contínua. Usa proporções do asset, oclusão de aproximadamente 4% da altura da imagem (apenas a base do casco), textura fina e espuma na proa direita. Mantém o navio original intacto.
- As camadas existentes de espuma/rastro foram alinhadas à linha d’água real, acima da margem transparente inferior do PNG, e tiveram o brilho difuso reduzido. Seus MotionValues e tempos não mudaram.
- A prévia passou a importar o oceano sem SSR, como a cena real já fazia, eliminando a divergência de hidratação observada quando WebGL está disponível. Nenhuma alteração em autenticação, sessão, navegação ou lógica de replay.
- Browser local com WebGL real via SwiftShader: shader compilado, canvas ativo, camada de oclusão presente e nenhum erro de console nas capturas em 1366×768, 1440×900, 1600×900 e 1920×1080. Inspeção inclui modo contínuo e travessia isolada, sem autenticar. O renderer por software não permite certificar FPS em hardware do usuário.
- ESLint direcionado PASS e 29/29 testes direcionados PASS. Build de produção PASS (configuração existente ignora erros TypeScript no build; typecheck foi executado separadamente).
- Gates globais executados: lint com 21.198 problemas de baseline; typecheck com falhas fora dos arquivos editados; suíte global com 2.871 PASS, 28 FAIL e 1 TODO, sem falhas nos testes do login. Logs locais: `/tmp/alpha-water-{lint,typecheck,test,build}.log`.
- Fallback CSS e caminho de reduced motion preservados; o material detalhado é WebGL. Perda de contexto também exercitada no browser via `WEBGL_lose_context`: canvas desmontado, fallback ativo e contato com o casco mantido. Nenhuma autenticação real nem operação de banco foi executada neste ajuste.

### File List

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/session-draft.md`
- `docs/stories/story-rm-2026-login-cinematografico-correcao.md`
- `public/BackgroundAtualizado.png`
- `public/containernavio.png`
- `public/NavioLogin.png`
- `public/Corda Náutica com Laços Simétricos.png`
- `public/sounds/buzina.mp3`
- `src/app/globals.css`
- `src/app/dev/login-transition-preview/page.tsx`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/loginForm.tsx`
- `src/components/login/AmbientParticles.tsx`
- `src/components/login/GlobalRoutes.tsx`
- `src/components/login/LedNetwork.tsx`
- `src/components/login/LoginCard.tsx`
- `src/components/login/LoginCargoTransition.tsx`
- `src/components/login/LoginScene.tsx`
- `src/components/login/LoginSuccessTransition.tsx`
- `src/components/login/LoginTransitionProvider.tsx`
- `src/components/login/LoginTransitionPreview.tsx`
- `src/components/login/Ocean.tsx`
- `src/components/login/ocean-material.ts`
- `src/components/login/ShipWaterContact.tsx`
- `src/components/login/LoginPageTow.tsx`
- `src/components/login/LoginTowRope.tsx`
- `src/components/login/login-voyage.ts`
- `src/components/login/useLoginVoyage.ts`
- `src/components/login/login-transition-state.ts`
- `src/components/login/useReducedMotion.ts`
- `src/lib/loginAction.ts`
- `tests/auth/login-action.test.ts`
- `tests/auth/login-transition-state.test.ts`
- `tests/auth/login-transition-preview.test.ts`
- `tests/auth/login-transition-wiring.test.ts`
- `tests/auth/login-voyage.test.ts`

### Atracação e reboque — evidências de 2026-09-11

- Sequência visual nominal: confirmação/empacotamento existente → aproximação a partir de 1.450 ms por 600 ms → embarque de 480 ms com navio parado → buzina e partida de 240 ms → mesmo callback de navegação → rota pronta → reboque de 1.150 ms. A duração final depende da carga real da rota e dos frames disponíveis.
- `LoginCard`, oceano/material/contato com o casco, formulário e action de login permaneceram byte a byte iguais ao snapshot anterior desta edição. As funções de confirmação de sessão e navegação do provider também foram comparadas sem diferenças; suas mudanças são apenas composição e progresso visual.
- O container não se desloca mais para a esquerda: fica no centro até o navio alcançar a mesma coordenada, então reduz com pequeno içamento/descida e clipping sobre a área de carga. A buzina só é disparada depois da conclusão do embarque.
- O provider anima o slot real de `/PainelAlpha` com `LoginPageTow`, mantendo a instância da página. A borda direita da página e os dois pontos da corda são derivados do mesmo progresso; não há screenshot, iframe novo ou painel de dados simulado no fluxo autenticado.
- O asset de corda foi encontrado em PNG e preservado integralmente. Margens transparentes são recortadas apenas por wrappers DOM; preload no login e `priority` na imagem. Nenhuma biblioteca adicionada.
- A prévia reutiliza os mesmos componentes de embarque e reboque; seu destino é identificado como prévia sem dados do painel. Replay agora remonta o card com chave própria, sem reiniciar a sequência ao alternar apenas o loop.
- Navegador local: WebGL e assets carregados, sem erros de console nas execuções finais em 1366×768, 1440×900 e 1920×1080. Capturas locais: `/tmp/alpha-tow-boarding.png`, `/tmp/alpha-tow-1440.png`, `/tmp/alpha-tow-1920-final.png`. Em 1366/1440, amostras de DOM/áudio confirmaram navio estacionado durante o embarque e buzina após a carga ocultar. GPU por software; sem certificação de FPS em hardware real.
- Testes direcionados: 36/36 PASS. A nova suíte verifica encontro central, sentido de movimento, limites do reboque e coincidência das pontas da corda com a borda da página em 390, 1366, 1440, 1600, 1920 e 2560 px.
- ESLint direcionado PASS. Gates globais executados: lint mantém 21.198 problemas de baseline; typecheck sem erros nos arquivos editados, mas falha em módulos externos; suíte global 2.878 PASS, 28 FAIL e 1 TODO fora do login. Build de produção PASS em diretório de validação isolado para não sobrescrever o servidor dev. Logs: `/tmp/alpha-tow-{lint,typecheck,test,build}.log`.
- Validação autenticada real continua pendente; nenhum usuário/sessão foi criado ou contornado. Sem operação de banco, commit ou deploy. CodeRabbit permanece indisponível conforme registro anterior.

## QA Results

- Forge: ESLint direcionado PASS; 29/29 testes de login e preview PASS; diff-check PASS; build final PASS.
- Smoke visual: timeline sem exceções de console em 1366×768, 1440×900 e 1920×1080; import dinâmico e perda posterior de WebGL cobertos.
- Probe: `CONCERNS` exclusivamente pela ausência de E2E/browser autenticado manual; wiring funcional aprovado.
- Anubis: 0 achados críticos e 2 débitos preexistentes fora do diff desta story.
- Lens: PASS final após revalidação do fallback de chunk dinâmico e cleanup de RAF/timers.
- Sage: PASS.
- CodeRabbit: não executado; CLI indisponível/não instalada.
- Baseline global: typecheck FAIL apenas por débito externo conhecido; lint FAIL com 21.198 problemas preexistentes; suíte global com 2.869 PASS, 28 FAIL e 1 TODO em módulos externos ao login.
- Pendência de revisão: executar E2E/browser autenticado manual para observar continuidade visual, ausência de flash, travessia e interação após o reveal.

### QA Gate Decision

CONCERNS — implementação e gates direcionados aprovados; E2E/browser autenticado manual e CodeRabbit permanecem não executados.
