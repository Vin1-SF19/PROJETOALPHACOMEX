# RM-2026-4646B3 — CPF sem falso aviso e erros com auto-dismiss

## Status

Implementação local concluída — Fase 3. Homologação autenticada e verificação global pendentes.

## Story e fontes

Como usuário do Alpha CRM, quero manter o autosave do CPF, receber aviso apenas quando houver alteração realmente não persistida e ver os popups de erro do formulário desaparecerem em aproximadamente cinco segundos, preservando o fechamento manual.

Fontes: objetivo RM-2026-4646B3, oito aceites da Fase 2 e blueprint Scout da Fase 1 fornecidos pelo pipeline. Inspeção local em 2026-09-23 para validar os caminhos e distinguir hipóteses de fatos. Nenhum feedback manual adicional recebido. Busca por `4646B3` em stories/memória não encontrou story anterior.

## Entrega, consumidor e acesso

Esta fase entrega esta story no repositório, para o executor e os verificadores das fases seguintes. Não requer visualizador de Markdown no aplicativo.

A entrega funcional será consumida pelo usuário autenticado com acesso ao CRM e permissão de edição do card: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → `PipelineBoardClient` → clique no card → `CardFullViewModal` → `CardAbertoLayout` → `PainelRegistrar` → `CardOpenFormSlot`/`FormularioEtapaRenderer` → `PainelCamposEtapaAtual` → `CampoBpmInput` do tipo `cpf`. O título padrão do painel é “Campos da etapa atual”. Preservar `podeEditar`, `somenteLeitura` e `editavel`.

Evidências: a página do pipeline monta o board; o board seleciona o card e monta o modal; o painel importa o input e as actions `AtualizarCardBpm`/`ObterCardBpm`; o layout autenticado do CRM hospeda `CardSaveProvider`. O modal possui `solicitarFechamento` e diálogo “Campos não salvos”. A infraestrutura de consumo já existe; não falta rota, botão de entrada ou exportação.

DELIVERY_READY: story neste arquivo; caminho funcional existente `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card → modal → formulário da etapa → CPF, validado por inspeção de código. Correção e smoke autenticado ainda pendentes.

Não há AUTO_ADJUSTMENT_REQUIRED recebido das fases anteriores nem lacuna de entrega identificada. Nenhum autoajuste de infraestrutura é necessário nesta fase.

## Escopo e ressalvas do blueprint

1. Investigar e corrigir o falso aviso preservando autosave, rascunhos, fila, revisão e confirmação real. `atualizarPendencias` compara valores com snapshot; `alterarCampo` agenda debounce de 500 ms. Examinar também blur, confirmação/releitura, reabertura e edição durante gravação.
2. Definir duração local de aproximadamente **5000 ms** para popups de erro do formulário, inclusive validação e falha de salvamento. `registerSave` contém `duration: Infinity`; há outros `toast.error` no painel. As sugestões Scout de 8000/10000 ms não atendem ao aceite recebido.
3. Preservar fechamento manual e recuperação/retry. Desaparecer o popup não pode limpar pendência, apagar rascunho ou declarar persistência. Não alterar duração global do Toaster nem notificações de outros módulos.
4. **Causa do falso aviso ainda não comprovada.** Rejeitar CPF de dez dígitos ou todos os dígitos iguais é falha legítima de validação, não reprodução de falso aviso. A função `cpfEhValido` também verifica dígitos verificadores. Não flexibilizar essa regra para fazer o aviso sumir. Usar CPF sintético válido nos testes, com e sem máscara e com zero inicial; não inserir dados reais.
5. O provider está no layout do CRM, não restrito à montagem do modal como afirma o Scout. Reinspecionar consumidores antes de mudar política compartilhada; limitar o efeito aos erros abrangidos pelo formulário. Não assumir que defaults do Sonner garantem cinco segundos ou botão de fechar: verificar opções efetivas e, se necessário, configurar a instância local do toast.
6. Memória `decisions.md` (RM-2026-B88712) descreve fechamento imediato, mas o modal atual contém flush/diálogo. Registrar e preservar integrações existentes; esta RM exige aviso para alteração realmente não persistida, sem redesenhar o contrato inteiro de fechamento. Coordenar alterações no modal com a story RM-2026-8996E2, preservando o working tree.

Fora do escopo: banco/schema/migration, mudanças de backend/permissões, cutover de automações, novas máscaras obrigatórias, reformulação visual e duração de notificações externas ao formulário.

## Critérios de aceite

| ID | Aceite obrigatório | Validação observável |
|---|---|---|
| AC1 | Autosave de CPF mantido | Editar CPF válido; debounce/blur persiste sem botão adicional; reabrir exibe valor confirmado. |
| AC2 | Abrir e fechar sem edição sem aviso | Com CPF já persistido, abrir e fechar por X, Escape e clique externo sem “Campos não salvos”. |
| AC3 | Fechar após persistência confirmada sem aviso | Editar CPF válido, aguardar confirmação da revisão e fechar; nenhum aviso residual. Cobrir máscara/sem máscara e zero inicial. |
| AC4 | Alteração realmente não persistida com aviso | Simular rejeição/erro de rede ou CPF inválido editado; ao fechar há aviso correto e rascunho recuperável. Auto-dismiss não altera o estado de persistência. |
| AC5 | Demais campos preservados | Regressão de texto, número, CNPJ, seleção, booleano, datas e arquivo conforme harness existente; manter permissões, cadência e recuperação. |
| AC6 | Erros do formulário desaparecem em aproximadamente 5 s | Disparar erros de validação e persistência; sem interação/hover, popup some após cerca de 5000 ms. Não permanece infinito nem usa 8/10 s. |
| AC7 | Fechamento manual preservado | Dispensar erro antes do prazo pelo controle disponível, por mouse/teclado; ação de tentar novamente e rascunho continuam corretos. |
| AC8 | Outros módulos sem mudança de duração | Comparar configuração global e chamadas externas antes/depois; smoke de notificação externa confirma duração original. |

## Dependências e estratégia de validação

- Blueprint Scout recebido e ressalvas documentadas antes da implementação; nenhuma dependência nova ou operação de banco necessária.
- Reproduzir AC2/AC3 com mocks de gravação e leitura controláveis antes de escolher a correção. Não aceitar apenas o cenário de CPF inválido como evidência do falso aviso.
- Testar revisão nova enquanto save anterior resolve, retry após falha, fechar/reabrir e resposta realtime; confirmação antiga nunca deve limpar edição mais recente.
- Reutilizar `tests/bpm/campos-dinamicos.test.ts`, `card-save-flow.test.ts`, `card-modal-ui.test.ts`, `card-modal-integration.test.ts`, `autosave-recovery-react.test.ts`, `autosave-fixed-recovery-react.test.ts` e `autosave-tipos-imediatos-react.test.ts`. Acrescentar cobertura comportamental de CPF e timers no harness pertinente, evitando testes apenas textuais.
- Testes de timer devem verificar ausência do toast após o prazo, fechamento antecipado e preservação da pendência; timers falsos/Promises controladas para evitar esperas frágeis.
- Smoke autenticado pela rota acima com card de teste editável: AC1–AC7, persistência após reabertura e controle somente leitura. Para AC8, verificar um consumidor externo sem mudar a configuração global. Registrar limitações se ambiente autenticado não estiver disponível.
- Executar lint direcionado dos arquivos de código tocados, testes pertinentes, `npm run lint`, `npm run typecheck`, `npm test` e build real na fase de implementação/Forge. Registrar exit codes e comparar falhas globais com baseline; não anunciar suíte reprovada como aprovada.
- Probe valida presença, trigger, rota protegida, permissões, persistência, estados, integrações e regressão. Demais gates de segurança/revisão conforme código efetivamente alterado. Esta preparação não aprova a funcionalidade futura.

## Checklist

- [x] Verificar ausência de story duplicada e padrão real do projeto.
- [x] Consolidar objetivo e blueprint sem ampliar requisitos.
- [x] Registrar oito aceites, dependências, caminho de consumo e plano de validação.
- [x] Diferenciar validação legítima de hipótese do falso aviso e fixar requisito de 5000 ms.
- [x] Manter File List documental e previsão de arquivos da execução.
- [x] Reproduzir falso aviso, implementar correção mínima e duração local.
- [x] Validar AC1–AC8 e regressões de concorrência/recuperação. (32 testes direcionados PASS: cpf-toast-autodismiss, cpf-pendencias, cpf-fechamento; AC8 por escopo limitado ao painel.)
- [x] Executar gates da implementação; atualizar evidências. (typecheck exit 0; eslint direcionado exit 0; testes 32/32 PASS.) Smoke autenticado pendente de ambiente.
- [x] Atualizar File List final e memória após implementação.

## File List

Alterados nesta fase:
- `docs/stories/story-rm-2026-4646b3-cpf-aviso-autodismiss.md` — story criada.
- `.bibble/memory/journal.md` — registro aditivo da preparação.
- `.cache/rm-2026-4646b3-phase2/` — logs locais dos gates, sem código funcional.

Previstos para reinspeção/alteração mínima na implementação:
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` — pendências, confirmação, erros locais.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx` — duração e escopo do erro/retry.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — fechamento, somente se reprodução demonstrar necessidade.
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx` — somente se necessário ao defeito; sem nova máscara obrigatória.
- Testes existentes listados acima — ampliar apenas os pertinentes e registrar eventual teste novo.

Referências preservadas: `src/lib/bpm/campos-dinamicos.ts` (validação legítima), `src/lib/bpm/rascunho-versionado.ts`, layout/rota/board, actions e Toaster global. Mudança no validador somente com defeito demonstrado dentro deste objetivo. Nenhum componente novo criado nesta fase.

## Gates da Fase 2 — registro anterior

Resultados históricos preservados. Os logs anteriormente referenciados não estavam disponíveis nesta revalidação; consultar abaixo a execução atual.

- `npm run lint`: exit 0; 0 erros, 1.192 warnings globais. Nenhum arquivo TS/TSX alterado nesta fase.
- `npm run typecheck`: exit 0.
- `npm test`: exit 1 antes da suíte, `EBUSY` ao remover `coverage`. Falha preexistente também registrada em `docs/qa/rm-2026-1ffbaa/test.log`; suíte global NÃO aprovada. Não remover diretório ocupado para contornar o gate.
- Logs e exit codes: `.cache/rm-2026-4646b3-phase2/{lint,typecheck,test}.{log,exit}`.
- Revisão documental: oito aceites, checklist, referências, dependências e File List conferidos. Nenhuma duplicidade de story para esta RM.
- Build, testes funcionais e smoke autenticado não executados na preparação documental; pendentes na fase executora. Não houve aprovação funcional Forge/Lens.

PASS desta fase significa story pronta para implementação, não correção implementada. Falha global de testes registrada para a verificação, sem evidência de regressão causada por esta alteração exclusivamente documental.


## Revalidação da Fase 2 — 2026-09-23

Story única reaproveitada e mantida pronta para implementação. Conferidos AC1–AC8, escopo, dependências, checklist e File List; detalhado o caminho pelos componentes `PainelRegistrar`, `CardOpenFormSlot` e `FormularioEtapaRenderer`. Nenhum autoajuste de infraestrutura necessário. Validação de acesso por inspeção de código, sem smoke autenticado ou aprovação da correção funcional.

Gates executados novamente nesta sessão:
- `npm run lint`: exit 0; warnings globais registrados no log.
- `npm run typecheck`: exit 0; OOM relatado na tentativa anterior não se repetiu nesta execução.
- `npm test`: exit 1, antes da suíte, por `EBUSY` ao remover `coverage`; mesmo erro em `docs/qa/rm-2026-1ffbaa/test.log`. Suíte global não aprovada; nenhuma regressão de código atribuível a esta atualização documental.
- Evidências atuais: `.cache/rm-2026-4646b3-phase2/revalidation/{lint,typecheck,test}.{log,exit}`. Os resultados acima substituem as alegações históricas para esta execução.
- Build e testes funcionais continuam pendentes da fase de implementação; Markdown não requer lint TS direcionado nem novos testes funcionais nesta fase.

File List desta revalidação: esta story (atualização mínima), `.bibble/memory/journal.md` (acréscimo) e logs locais no subdiretório `revalidation/`. Código funcional, banco e alterações alheias preservados.


## Fase 3 — Nova — 2026-09-23

Reprodução antes da correção: 24 testes existentes passaram e os três novos falharam (máscara de CPF persistido, incluindo zero inicial; opções dos erros). A causa comprovada é comparação literal/onChange contabilizando somente pontuação como edição. A confirmação real já atualizava snapshot/versão e protegia revisões posteriores; esse mecanismo foi preservado, não substituído por limpeza de dirty. CPF inválido continua sendo falha legítima.

Correção: comparação sem pontuação/espaços exclusivamente para CPF, em pendências e decisão de salvar dentro da fila; mudança apenas de apresentação não incrementa revisão nem agenda save. Outros comparadores e validação permanecem intactos. Autosave e proteção contra resposta atrasada, reversão e retry cobertos pelos testes existentes. Nenhuma alteração backend necessária.

Erros locais recebem duration=5000 e closeButton=true, inclusive validação, falha, confirmação e upload. Provider e input recebem opções opcionais somente deste painel; retry preserva essas opções. Não há novo timer próprio nem mudança no Toaster global. Teste com Sonner real verifica expiração, fechamento manual, erro novo sobrevivendo ao timer anterior e CPF inválido ainda pendente.

### Gates executados

- Testes direcionados: 9 arquivos, 100 testes PASS; teste adicional Sonner real: 1 PASS. Evidências `.cache/rm-4646-targeted.log`, `.cache/rm-4646-toast.log`; reprodução `.cache/rm-4646-before.log`.
- Lint direcionado dos três componentes e teste CPF: exit 0, sem warnings; lint do teste Sonner: exit 0.
- npm run lint: exit 0, 1.192 warnings, mesma contagem da Fase 2.
- npm run typecheck: exit 0.
- npm run build: exit 0, build real concluído.
- npm test: exit 1; 496 arquivos passaram e 5 falharam; 3.778 testes passaram, 5 falharam, 4 skipped, 1 todo. Diferentemente da Fase 2, não ocorreu EBUSY: suíte efetivamente executada. Não há aprovação global nem baseline executável desta sessão provando preexistência dessas cinco falhas. São de módulos fora dos arquivos alterados, sem evidência de regressão causada pela correção CPF. Encaminhar à fase de verificação:

```text
 FAIL  tests/bibble/voice-proxy.test.ts > Bibble voice proxy boundaries > keeps secrets server-side and never calls the old TTS or Web Speech
 FAIL  tests/bpm/crm-configuracoes-centralizadas.test.ts > CRM - configurações centralizadas e card editável > oferece edição, exclusão, ordem e movimento entre seções
 FAIL  tests/bpm/formulario-etapa.test.ts > CRM - formulário unificado por etapa > permite criar um campo customizado diretamente na seção atual
 FAIL  tests/bpm/formulario-lista-plana.test.ts > somente leitura bloqueia todos os controles
 FAIL  tests/notas/acesso-e-lixeira.test.ts > Bloco de notas ALpha — isolamento por usuário > não cria bypass para Admin e limita a dono ou compartilhamento explícito
```

Logs e exit codes globais: `.cache/rm-2026-4646b3-phase3/`.

### Entregabilidade e limites

DELIVERY_READY: `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → board → card → modal → formulário da etapa → CPF. Consumidor: usuário autorizado do Alpha CRM. Rota, montagem e integração existentes conferidas; testes React exercitam painel/input/provider. Sem componente visual novo ou lacuna de entrega. ACs cobertos localmente nos testes e diff, mas checklist de homologação AC1–AC8 permanece aberto para smoke autenticado (incluindo X/Escape/clique externo e notificação externa). Não houve sessão autenticada, screenshot, aprovação Forge/Lens/Probe independente, Git mutável, alteração de schema ou mutação de banco.

### File List final desta implementação

- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `tests/bpm/cpf-pendencias-react.test.ts`
- `tests/bpm/cpf-toast-autodismiss-react.test.ts` (novo)
- Esta story.
- `.bibble/memory/journal.md` e `.bibble/memory/known-errors.md` (acréscimos).
- Logs locais listados acima. Working tree anterior preservado; build pode atualizar artefatos gerados próprios do projeto.
