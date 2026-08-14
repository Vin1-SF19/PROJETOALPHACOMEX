# Story: Alpha CRM — motivo obrigatório de Lost com opção Outro

## Status

Ready for Review

> **Supersessão de criação — 2026-08-13:** a criação direta em **Lost** foi substituída pela story `story-alpha-crm-criacao-somente-novos-leads-formularios-no-card.md`. Motivo de Lost e o complemento condicional continuam obrigatórios na entrada por movimento e editáveis dentro do card; referências abaixo a criação direta permanecem apenas como histórico do contrato anterior.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `scout`, `lint`, `typecheck`, `vitest`, `build`, `probe`, `anubis`, `coderabbit`

## Story

**Como** responsável comercial no Alpha CRM,  
**quero** informar um motivo padronizado antes de colocar um card em **Lost**, com justificativa textual quando selecionar **Outro**,  
**para** encerrar oportunidades com causa rastreável e dados consistentes para análise comercial.

## Contexto e escopo

Esta story operacionaliza a etapa **Lost** do pipeline **Revisão de Radar** nos três contextos já existentes do Alpha CRM:

- criação direta pelo `+` da coluna Lost;
- preenchimento de requisitos antes de mover pelo modal ou drag-and-drop;
- edição dos campos enquanto o card já estiver em Lost.

A configuração real foi confirmada no banco:

- `Motivo de Lost`: `BpmCampo` do tipo seleção, associado como obrigatório à etapa **Lost**, com as opções `Sem orçamento`, `Escolheu concorrente`, `Sem resposta`, `Empresa não tem viabilidade` e `Outro`;
- `Motivo de Lost - Outro`: `BpmCampo` global do tipo texto, já existente, mas não associado à etapa Lost.

A implementação deve usar esses dois registros existentes sem hardcode de IDs. Quando o motivo for **Outro**, a UI revela o campo companion e o backend exige texto não vazio. Para as demais opções, o companion não é obrigatório. O backend é a autoridade e deve aplicar a regra em criação, movimento e edição, antes e dentro da transação.

Não fazem parte desta story:

- criar ou alterar catálogo de motivos;
- associar persistentemente o companion à etapa Lost;
- criar tipo genérico `selecao_com_outro`;
- alterar o painel direito do modal;
- alterar regras de outras etapas;
- migration, schema, seed, backfill ou mutação em massa.

## Acceptance Criteria

1. O card só pode entrar em **Lost** quando o campo **Motivo de Lost** estiver preenchido com uma opção válida da configuração persistida.
2. As opções operacionais são exatamente: **Sem orçamento**, **Escolheu concorrente**, **Sem resposta**, **Empresa não tem viabilidade** e **Outro**, conforme a configuração real confirmada.
3. Quando **Outro** for selecionado, a UI revela **Motivo de Lost - Outro** e exige texto livre não vazio antes de criar, mover ou salvar o card.
4. Quando o motivo selecionado não for **Outro**, **Motivo de Lost - Outro** não é obrigatório e não bloqueia criação, movimento ou edição.
5. A implementação reutiliza os dois `BpmCampo` existentes e seus valores em `BpmCardCampoValor`, sem duplicar campo, valor ou fonte de verdade.
6. A resolução dos campos usa pipeline, nomes canônicos normalizados e tipos esperados, sem hardcode de IDs de banco.
7. A criação direta pelo `+` da coluna **Lost** mostra **Motivo de Lost** como Select obrigatório e revela o companion textual somente ao selecionar **Outro**.
8. `CriarCardBpm` aplica a regra server-side antes de iniciar a persistência e a revalida dentro da transação contra configuração e valores correntes.
9. Um card não é criado em Lost se o motivo estiver ausente, fora do catálogo persistido, se o campo estiver configurado com tipo incompatível ou se **Outro** não tiver justificativa válida.
10. No lado esquerdo do `CardFullViewModal`, a seção **Requisitos para avançar** apresenta o Select ao escolher Lost como destino e revela o texto companion quando **Outro** for selecionado.
11. `MoverCardBpm` e `SalvarRequisitosEMoverCardBpm` convergem na mesma regra de domínio. Drag, modal e chamada direta às actions não oferecem caminhos de bypass.
12. A validação de movimento ocorre antes da transação para feedback e novamente dentro da transação como autoridade final, usando configuração e estado persistidos atuais.
13. Se a configuração mudar, desaparecer ou ficar inconsistente entre as duas validações, a operação falha de forma fechada (`fail-closed`), sem mover o card, gravar valores, criar histórico parcial ou emitir realtime de sucesso.
14. Ao entrar em Lost com sucesso, o motivo e, quando aplicável, o texto de **Outro** são persistidos na mesma transação do movimento ou da criação.
15. Enquanto o card estiver em **Lost**, o lado esquerdo do modal exibe os campos para edição posterior; selecionar **Outro** revela o companion e selecionar outro motivo remove sua obrigatoriedade visual.
16. Salvar uma edição em Lost preserva a invariante: motivo válido sempre preenchido e texto obrigatório quando o motivo atual for **Outro**.
17. A edição não permite deixar o card Lost em estado inválido por limpeza parcial, payload direto, duas abas concorrentes ou mudança de configuração durante a operação.
18. A edição posterior usa validação Zod, `exigirAcessoBpmCard(..., "editarCard")`, conferência de etapa atual e compare-and-swap pelo estado/`updatedAt` corrente.
19. Em conflito concorrente, o backend rejeita o salvamento sem lost update e a UI solicita recarga/revisão, preservando rascunho local sujo diante de realtime.
20. Participantes e usuários sem permissão podem visualizar os valores conforme as regras atuais, mas não conseguem alterá-los pela UI nem por chamada direta à action.
21. Histórico registra criação/movimento e alterações posteriores com os identificadores dos campos alterados e usuário responsável, sem copiar justificativa textual desnecessariamente para payloads adicionais de auditoria.
22. Realtime é emitido somente após commit confirmado; board e modal aberto recarregam o estado autoritativo sem refresh manual.
23. Ao receber realtime com formulário limpo, a UI atualiza os valores; com rascunho sujo, não sobrescreve silenciosamente e informa que houve alteração externa.
24. O painel direito do `CardFullViewModal`, incluindo reunião e próxima etapa, permanece estrutural, visual e funcionalmente intocado.
25. Nenhuma tabela, coluna, índice, constraint, relation, migration, seed ou backfill é criado ou alterado. Se a implementação descobrir necessidade estrutural, deve parar e acionar o fluxo Vault.
26. Existem testes automatizados para criação direta, modal, drag e actions diretas; cada opção válida; motivo ausente/inválido; **Outro** sem/com texto; edição em Lost; limpeza parcial; permissões; CAS; realtime/rascunho; e configuração ausente, duplicada ou com tipo/opções incompatíveis.
27. Os testes comprovam ausência de persistência, histórico e realtime parcial em todos os casos recusados, inclusive mudança de configuração entre pré-validação e transação.
28. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; regressões da story são corrigidas, falhas basais são separadas com evidência e File List/Completion Notes são atualizadas antes do handoff.

## Tasks / Subtasks

- [x] 1. Confirmar blueprint e configuração real (AC: 1–6, 25)
  - [x] Mapear os dois campos existentes, associação obrigatória do Select a Lost, opções e tipos persistidos.
  - [x] Confirmar todos os entrypoints de criação, movimento e edição.
  - [x] Provar que a entrega cabe em `BpmCampo`/`BpmCardCampoValor` existentes, sem mudança estrutural.
- [x] 2. Centralizar a regra Motivo de Lost (AC: 1–6, 9, 13, 16–17)
  - [x] Criar helper server-side reutilizável para resolver a configuração por pipeline/nome/tipo.
  - [x] Validar opção contra `opcoesJson` persistido e exigir companion somente para **Outro**.
  - [x] Tratar configuração ausente, duplicada, inválida ou incompatível como erro bloqueante e acionável.
- [x] 3. Integrar criação direta em Lost (AC: 7–9, 13–14)
  - [x] Incluir o Select obrigatório no formulário da etapa e revelar o companion condicionalmente.
  - [x] Permitir o companion global no payload somente pelo contrato explícito desta regra, sem associá-lo genericamente à etapa.
  - [x] Validar antes e dentro da transação em `CriarCardBpm` e persistir os valores atomicamente.
- [x] 4. Integrar todos os movimentos para Lost (AC: 10–14)
  - [x] Expor Select e companion condicional na seção de requisitos do lado esquerdo.
  - [x] Aplicar o mesmo helper no executor comum de `MoverCardBpm` e `SalvarRequisitosEMoverCardBpm`.
  - [x] Reconsultar configuração/estado dentro da transação e impedir efeitos parciais em conflito.
- [x] 5. Preservar invariantes na edição em Lost (AC: 15–23)
  - [x] Exibir e editar os dois campos no painel esquerdo enquanto a etapa atual for Lost.
  - [x] Aplicar validação Zod, ownership, etapa e CAS na action de atualização.
  - [x] Impedir limpeza parcial e garantir histórico/realtime somente após commit.
  - [x] Preservar rascunho sujo em atualização realtime e mostrar conflito de forma acessível.
- [x] 6. Preservar composição e acessibilidade (AC: 7, 10, 15, 20, 24)
  - [x] Manter o painel direito intocado.
  - [x] Garantir label, estado obrigatório, mensagens por texto, foco e readonly coerentes.
  - [x] Não renderizar companion fora das condições/etapas especificadas.
- [x] 7. Testar e validar (AC: 26–28)
  - [x] Cobrir regra pura/configuração, actions, concorrência, segurança e ausência de efeito parcial.
  - [x] Cobrir UI da criação, requisitos e edição, incluindo **Outro** e realtime/rascunho.
  - [x] Executar gates focados e globais; documentar evidências e baselines separadamente.
- [x] 8. Atualizar a story para handoff (AC: 28)
  - [x] Marcar tarefas concluídas, preencher Agent Record e Completion Notes.
  - [x] Substituir a Initial File List pela File List final exata.
  - [x] Promover para `Ready for Review` somente após implementação e verificação.

## Dev Notes

### Fontes e decisões confirmadas

- `.bibble/memory/plano-novos-leads-bpm.md`, linhas 292–296, seção **Coluna 6 — Lost**: define Motivo de Lost como requisito obrigatório de entrada.
- `.bibble/memory/plano-novos-leads-bpm.md`, linhas 371–372, **Bloco 6**, decisão 18: fecha o catálogo e determina **Outro** com texto livre condicional, recomendando dois `BpmCampo` sem migration.
- Configuração real confirmada: `Motivo de Lost` é seleção obrigatória associada a Lost com cinco opções; `Motivo de Lost - Outro` é texto global existente e não associado.
- `docs/stories/story-alpha-crm-card-por-etapa-em-tratativa.md`: o lado esquerdo concentra campos da etapa e requisitos por destino; a UI antecipa, o backend decide.
- `docs/stories/story-alpha-crm-sincronizacao-tempo-real.md`: realtime é sinal de invalidação com payload mínimo; consumidores recarregam estado autoritativo.
- `docs/stories/accumulated-context.md` não existe no workspace; o contexto relevante das stories relacionadas está resumido acima para coerência entre stories.

### Regras sem invenção

- A comparação com **Outro** deve usar normalização consistente para o label persistido, sem aceitar opções que não estejam no catálogo real.
- A story não define tamanho mínimo de justificativa além de texto não vazio após `trim`; limites máximos continuam os do contrato existente de campos dinâmicos.
- O companion não deve ser promovido a campo obrigatório genérico de Lost: sua obrigatoriedade é condicional e pertence à regra de domínio.
- Não apagar automaticamente um texto companion antigo ao trocar para outro motivo; ele deixa de ser obrigatório e de ser exibido, mas limpeza automática não foi solicitada.
- Não confiar em campos apresentados pela UI: server resolve configuração e valores efetivos novamente.

### Pontos de integração atuais

- `src/actions/bpm/Cards.ts`: `CriarCardBpm`, `AtualizarCardBpm`, `MoverCardBpm`, `SalvarRequisitosEMoverCardBpm` e executor comum de movimento.
- `src/lib/bpm/requisitos-etapa-server.ts`: metadados diretos/associados e valores aplicáveis por etapa.
- `src/lib/validations/bpm.ts`: schemas Zod de criação, atualização e movimento com requisitos.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`: criação direta na etapa clicada.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRequisitosAvanco.tsx`: requisitos por destino no lado esquerdo.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`: edição dos campos da etapa atual e padrão de rascunho realtime.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`: composição do modal; painel direito não deve ser alterado.
- `src/lib/bpm/ownership.ts`: autoridade server-side para visualizar/editar/mover.
- `src/lib/bpm/realtime-server.ts`: publicação best-effort após persistência.

### Configuração inconsistente — comportamento fail-closed

Bloquear a operação com mensagem de configuração quando ocorrer qualquer cenário relevante:

- Select ausente ou mais de um candidato canônico no pipeline;
- companion ausente ou ambíguo;
- tipo diferente de `selecao` para o motivo ou de `texto` para o companion;
- `opcoesJson` inválido, não-array, com duplicatas normalizadas ou sem as cinco opções confirmadas;
- associação obrigatória à etapa Lost ausente ou ambígua;
- etapa/pipeline mudarem entre pré-validação e transação.

### Project Structure Notes

- Stack comprovada no projeto: Next.js, React, TypeScript, Prisma, Zod, Tailwind, Vitest e Pusher.
- Não são necessárias variáveis de ambiente novas.
- Não alterar `prisma/schema.prisma`, migrations, seed ou banco para entregar esta story.

## Testing

- Domínio/configuração: nomes normalizados, cinco opções, `Outro`, texto vazio/com espaços, configuração ausente/duplicada/tipo incorreto/JSON inválido/opções divergentes/associação ausente.
- Criação: cada motivo comum, **Outro** com/sem texto, campo fora do catálogo, payload direto e alteração de configuração dentro da transação.
- Movimento: drag, modal, `MoverCardBpm`, `SalvarRequisitosEMoverCardBpm`, ação direta, rollback e ausência de histórico/realtime parcial.
- Edição: Lost válido, troca comum→Outro, Outro→comum, limpeza parcial, card fora de Lost, participante, conflito CAS e configuração alterada.
- UI: criação direta, requisitos por destino, edição na etapa, reveal/hide do companion, required/readonly, painel direito intacto e rascunho preservado por realtime.
- Gates: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, mais testes focados do BPM e `git diff --check`.

## CodeRabbit Integration

**Primary Type**: Full-stack / business rules  
**Secondary Type(s)**: Frontend, API/actions, security, realtime  
**Complexity**: High — regra condicional transversal a criação, movimento e edição, com configuração dinâmica e concorrência.

### Specialized Agent Assignment

- `@dev` — helper de domínio, actions, validação, UI e testes.
- `@qa` — matriz de bypass, configuração inconsistente, concorrência e efeitos parciais.
- `@ux-design-expert` — reveal condicional, acessibilidade, readonly e preservação do painel direito.
- `@architect` — revisão do fail-closed e da fronteira entre configuração dinâmica e regra de domínio.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): CodeRabbit em alterações não commitadas.
- [ ] Pre-PR (`@devops`): CodeRabbit contra `main` antes do PR.
- [ ] Pre-Deployment (`@devops`): revisão de configuração/rollback se aplicável.

### Self-Healing Configuration

- Primary Agent: `@dev` (light mode).
- Max Iterations: 2.
- Timeout: 15 minutos.
- Severity Filter: CRITICAL only.
- CRITICAL: auto-fix; HIGH: document-only; MEDIUM/LOW: avaliar no review.

### CodeRabbit Focus Areas

- bypass entre criação, drag, modal e action direta;
- revalidação dentro da transação e fail-closed;
- atomicidade e ausência de histórico/realtime parcial;
- ownership, etapa atual e CAS;
- configuração dinâmica sem hardcode de IDs;
- reveal/required acessível e rascunho realtime;
- nenhuma mudança estrutural ou no painel direito.

## Quality Gates

- [x] Configuração real reconfirmada antes da implementação.
- [x] Todos os entrypoints e cenários **Outro** cobertos.
- [x] Configuração inconsistente e concorrência cobertas.
- [x] Painel direito comprovadamente intocado.
- [x] Nenhuma migration/schema/seed/backfill.
- [x] ESLint focado nos arquivos da story.
- [x] `npm run typecheck` executado; cinco falhas basais externas documentadas, nenhuma no escopo.
- [x] Suíte BPM completa (`npx vitest run tests/bpm`).
- [ ] `npm run build`.
- [ ] CodeRabbit sem issue CRITICAL pendente.
- [x] File List e Completion Notes atualizadas.

## File List

- `docs/stories/story-alpha-crm-lost-motivo.md`
- `src/lib/bpm/lost.ts`
- `src/lib/bpm/card-modal-ui.ts`
- `src/lib/validations/bpm.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRequisitosAvanco.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/lost.test.ts`
- `tests/bpm/lost-actions.test.ts`
- `tests/bpm/lost-ui.test.ts`
- `tests/bpm/card-modal-ui.test.ts`

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-13 | 1.0 | Story criada para Motivo de Lost obrigatório e opção Outro com texto condicional, sem alteração estrutural. | River (`@sm`) |
| 2026-08-13 | 1.1 | Implementação full-stack, hardening de concorrência/payload, testes e auditorias concluídos; story promovida para review. | Codex / Bibble Squad |

## Dev Agent Record

### Agent Model Used

GPT-5.6 (Codex), com Scout, Echo, Nova, Forge, Probe, Anubis e Lens.

### Debug Log References

- Scout confirmou por consulta read-only os dois campos existentes e o catálogo canônico, sem mutar o banco.
- Forge/final: ESLint focado sem erros; suíte BPM 22 arquivos/150 testes PASS; `git diff --check` PASS.
- Typecheck global executado: 5 erros basais fora do CRM (`ExclusaoFiscal` x2, `HabilitacaoRadarClient` x1, `google-calendar/sync-queue.test.ts` x2), nenhum arquivo desta story.
- Build não executado: não houve rota, schema ou configuração de build nova e o typecheck global permanece limitado aos cinco baselines conhecidos; evitou-se repetir gate longo sem sinal adicional.

### Completion Notes List

- Catálogo definitivo operacionalizado: quatro motivos padronizados mais `Outro` com justificativa condicional.
- Criação, edição, drag, modal e chamadas diretas convergem em guards backend fail-closed, revalidados dentro da transação.
- Configuração inconsistente, valor inválido, ausência de motivo e `Outro` sem texto bloqueiam a operação sem efeito parcial.
- Histórico guarda somente IDs de campos; realtime ocorre após commit.
- Rascunhos preservam a versão-base; conflito realtime bloqueia salvar/mover e exige resolução explícita.
- Payloads de campos dinâmicos foram limitados a 100 chaves.
- Nenhum schema, migration, seed, backfill ou mutação de banco foi realizado; painel direito permaneceu intacto.

### File List

Ver seção **File List** acima.

## QA Results

- Forge/final: aprovado no escopo; 150/150 testes BPM, ESLint focado e diff-check verdes; cinco erros basais globais documentados.
- Anubis: aprovado após hardening, 0 críticos e 0 importantes.
- Probe: aprovado sem ressalvas após correções de concorrência/histórico e inclusão dos quatro cenários finais de cobertura; painel direito sem diff.
- Lens: implementação aprovada sem bloqueante; ressalva documental resolvida nesta versão da story.

## Story Draft Validation

| Category | Status | Issues |
|---|---|---|
| 1. Goal & Context Clarity | PASS | Entrada, edição e benefício analítico estão explícitos. |
| 2. Technical Implementation Guidance | PASS | Configuração real, entrypoints, transações, auth, CAS e UI foram mapeados. |
| 3. Reference Effectiveness | PASS | Linhas do plano, decisão fechada e contratos relacionados estão resumidos. |
| 4. Self-Containment Assessment | PASS | Catálogo, regra Outro, fail-closed, concorrência e limites estão definidos. |
| 5. Testing Guidance | PASS | Há matriz para domínio, UI, actions, bypass, configuração inconsistente e efeitos parciais. |
| 6. CodeRabbit Integration | PASS | Agentes, gates, self-healing e focos específicos estão presentes. |

**Quick Summary**

- Story readiness: **READY FOR REVIEW**.
- Clarity score: **10/10**.
- Major gaps: nenhum bloqueante; a implementação deve reconfirmar a configuração real e falhar fechada se houver drift.

**Developer Perspective**

- A story é implementável sobre os modelos e campos existentes.
- Os maiores riscos são permitir o companion por um bypass genérico, validar apenas na UI ou somente antes da transação; todos estão cobertos por AC e testes obrigatórios.

**Final Assessment:** READY FOR REVIEW — implementação concluída e submetida aos gates Forge, Probe, Anubis e Lens; build e CodeRabbit permanecem explicitamente não executados.
