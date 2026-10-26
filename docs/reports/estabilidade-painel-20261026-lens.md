# Lens — revisão da estabilidade do Painel Alpha

26/10/2026. **APROVADO após correção de concorrência e Forge rodada6.** Revisão manual do patch contra20f310, incluindo helpers novos não rastreados, no candidato isolado. A reprovação inicial e sua evidência permanecem abaixo como histórico. Nenhuma aplicação, teste, schema, ambiente, dado real ou deploy alterado por Lens.

## Revisão final do delta — 22:06 UTC

Conferidos os dois caminhos solicitados: `useNotasWorkspaceSync.refresh()` e o botão `noteQuery.refetch()` da taskbar agora usam `{ cancelRefetch: false }`. O listener esclarece a impossibilidade de cancelar a Server Action. Guards de autorização, geração, tratamento de rejeição, rascunhos e escrita não foram enfraquecidos por esse delta.

As regressões novas exercitam hook e componente reais, com cache preenchido e leitura não abortável pendente: três mensagens mais três reconsultas manuais mantêm calls2/active1/peak1; três cliques no botão de nota iniciam somente uma nova ação. O caso de workspace ainda comprova que aba/rascunho local criados durante a leitura permanecem intactos e não ocorre escrita automática.

Recibo Forge rodada6 conferido: typecheck com tipos Next, lint do delta,8arquivos/63testes, build e HTTP local aprovados; fonte `aa16cb5ab68471e4bbf5de6a192cfd50c5a6769e2a0a1995c37e124015df8d7c`. Suíte integral anterior é reutilizada nos limites proporcionais declarados no recibo; não foi repetida por Lens. Nesta passagem Lens revisou código/testes e executou `git diff --check`, sem nova execução de testes desnecessária após os63focados Forge.

**Bloqueantes abertos:0. Veredicto: APROVADO no escopo local do patch.** Sage deve conferir os limites residuais de unmount/troca de identidade e estado local; staging/produção autenticados e conectividade externa continuam exigindo recibos próprios de DevOps. Aprovação não afirma normalização do Turso ou dos upstreams IA.

## Pré-condições conferidas

Forge aprovado na rodada5: typecheck pós-build, lint, build e smoke HTTP local; suíte integral814arquivos/6.801testes aprovada na fonte anterior, com dois deltas finais comprovados e22testes direcionados. Probe local79testes e Anubis103testes aprovados. Esses subconjuntos não devem ser somados à suíte integral como testes distintos.

CodeRabbit não executado: CLI ausente segundo Forge. `.aiox-core/core-config.yaml` permite `graceful_degradation.skip_if_not_installed: true`; esta revisão manual é o fallback efetivamente realizado, sem declarar aprovação automatizada.

## Histórico — bloqueante de concorrência corrigido

**`src/hooks/useNotasWorkspaceSync.ts:78`**, também chamado pelo listener de mensagens na linha83 e pelo botão de reconsulta. `query.refetch()` usa `cancelRefetch=true` por padrão. Quando a query já tem dados e há uma reconsulta em voo, o segundo refetch cancela somente o observador e inicia outra execução da `queryFn`. `ObterWorkspaceNotas()` é uma Server Action e não recebe/cancela o signal: o primeiro trabalho continua no servidor. Eventos próximos das abas internas podem, portanto, multiplicar consultas durante a lentidão que esta entrega busca conter. O comentário da linha82 promete deduplicação que o código atual não garante.

**Reprodução executada:** QueryClient/QueryObserver reais da dependência instalada, sem rede/banco, com o mesmo padrão da query (Server Action simulada por promise que só verifica o signal depois de resolver). Uma leitura inicial preenche o cache; duas chamadas consecutivas a refetch mantêm a primeira ação pendente:

```json
{"cancelRefetch":"default","calls":3,"active":2,"peak":2}
{"cancelRefetch":false,"calls":2,"active":1,"peak":1}
```

Confirmação primária no código instalado: `queryObserver.ts` define o default `cancelRefetch ?? true`; `query.ts` cancela/reinicia quando há dados e cancelRefetch é true. O comportamento não é inferido de uma documentação externa ou teste estático de texto.

**Correção para Nova:** usar `query.refetch({ cancelRefetch: false })` no helper compartilhado de refresh, conservando a validação de geração, tratamento de rejeição e preservação de rascunhos. Aplicar a mesma opção à reconsulta manual de `noteQuery` em `src/components/Notas/NotesGlobalTaskbar.tsx:224`, pois essa leitura também é Server Action não cancelável. Não remover os guards de autorização, inventar retry de mutações ou tentar cancelar a escrita.

**Regressão exigida:** depois de hidratar/cachear, manter a segunda leitura pendente e disparar várias reconsultas/eventos de mensagens; comprovar uma única nova Server Action em voo e que o resultado antigo não sobrescreve alterações locais/drafts. Repetir para o botão de leitura de nota se coberto em fixture própria. A suíte existente testa hidratação, rejeições e coalescing de escritas, mas não esse caso de refetch com dados já presentes.

## Demais áreas examinadas

Não foi identificado outro bloqueante novo nas áreas examinadas: deadlines de headers/corpo e limpeza de listeners; retenção de slots até settlement real; autorização fail-closed; retry restrito a leitura; backoff/Retry-After dos pollers; guarda SSR corrigida do broadcast; coalescing de preferências sem replay de escrita desconhecida; consumo das rejeições da taskbar; erros IA sanitizados e token individual; JSON/SSE com prazos separados; versão apenas orientativa sem reload; geo policy preservada.

Não é scan integral do repositório nem medição de saúde do banco/provedor. Smoke autenticado e medição operacional em staging/produção continuam pendentes para DevOps.

## Handoff inicial, preservado como histórico

Fila retorna a Nova para a correção acima. Após testes direcionados e revalidação proporcional Forge, Lens deve conferir o delta antes de liberar Sage/rollout. Sage deve priorizar o caso de cache preenchido mais refetch repetido, além de unmount/identity e rascunho concorrente. File list Lens: este relatório e a story.
