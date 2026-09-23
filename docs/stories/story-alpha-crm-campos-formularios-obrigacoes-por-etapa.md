# Story: Alpha CRM — reformular Campos e formulários por pipeline e etapa

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: testes BPM, lint, typecheck, build e revisão visual/acessibilidade

## Story

Como administrador do Alpha CRM, quero configurar pela interface os campos, seções e obrigações de cada etapa de cada pipeline, com indicação do que já está em uso, para adaptar os formulários dos cards e as condições de avanço sem perder dados existentes.

## Contexto e limites

- Caminho atual: Alpha CRM → Configurações → pipeline → **Campos e formulários**, em `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]`.
- O editor atual já seleciona etapa, cria/adiciona campos, organiza seções, mostra prévia e publica uma composição versionada. Há controles de campo por etapa para visibilidade e obrigatoriedade, inclusive de entrada/saída; os guards de transição já são executados no servidor.
- O formulário do card pertence à **etapa atual**. Requisitos de avanço aparecem no painel esquerdo do card, conforme `story-alpha-crm-formulario-unificado-por-etapa.md`. A etapa **Agendar Reunião** tem restrição própria a data/hora e Google Meet; controles nativos e regras de domínio não devem ser eliminados pelo editor genérico.
- `public/imagemreferenciaFORMULARIO.png` é referência de **organização visual**: catálogo lateral, seletor de fase, área central de montagem/prévia e propriedades da seleção. Reproduzir com identidade, cores, componentes e navegação do Painel Alpha. Tipos vistos na imagem só entram se houver suporte real no catálogo, renderer, persistência e validação existentes; nenhum tipo novo é requisito implícito.
- “Audições” do pedido é interpretado como **adições** de seções e campos. `[AUTO-DECISION]` A edição deve contemplar criar, acrescentar, reorganizar, configurar e remover da composição com segurança.
- O escopo usa contratos e persistência existentes. Nenhuma migration, seed ou mutação em massa está autorizada por esta story. Se a análise técnica concluir que mudança de estrutura é indispensável, interromper essa parte, acionar Vault e cumprir a política de backup/consentimento de `AGENTS.md`.

## Acceptance Criteria

1. A aba apresenta seleção clara de pipeline e etapa, ou mantém a navegação por pipeline existente com troca fácil e indicação inequívoca do pipeline atual. É possível configurar todas as etapas de todos os pipelines aos quais o administrador tem acesso, sem aplicar rascunho de um pipeline/etapa a outro.
2. O editor apresenta catálogo lateral apenas com componentes/tipos suportados, área central de composição e prévia fiel do formulário publicado no card, propriedades da seleção e ações explícitas de salvar/publicar e descartar. Em telas estreitas, todos os controles continuam acessíveis por teclado e toque.
3. Em cada etapa, o administrador consegue criar, renomear, ordenar e retirar seções; criar campo compatível, adicionar campo já existente, editar suas propriedades permitidas, mover/reordenar e retirar campo de seção. Uma “Nova seção” criada na aba aparece como seção correspondente no formulário do card após publicação, respeitando o renderer canônico.
4. A UI permite definir o alcance de cada campo/formulário entre as etapas/pipelines **conforme as associações que o modelo atual suporta**; mostra de forma explícita se a alteração afeta só a etapa selecionada ou um campo compartilhado. Edição de identidade/tipo/opções de campo compartilhado nunca é apresentada como alteração local quando tiver efeito global.
5. Para cada campo aplicável, a interface expõe e salva visibilidade, editabilidade e obrigações suportadas pelo contrato atual, distinguindo preenchimento na etapa, requisito para sair da etapa e requisito para entrar na próxima. A prévia e o card deixam claro o obrigatório; a tentativa de avançar com requisito faltante é bloqueada pelo guard servidor com mensagem acionável. Regras de domínio já existentes continuam autoritativas.
6. Antes de editar, desativar, retirar ou excluir campo existente, a UI informa os usos conhecidos: etapas/formulários que o referenciam e presença de valores ou anexos associados, quando disponíveis no modelo atual. Se a análise não puder ser concluída, a ação de risco fica indisponível com explicação; não presumir “sem uso”.
7. Campo em uso pode ter propriedades compatíveis atualizadas preservando seu ID, valores dos cards e referências de arquivo. Mudança incompatível de tipo/opções, exclusão física ou remoção de referência usada é bloqueada ou conduzida pelo mecanismo de segurança já existente, com aviso do impacto. Arquivos/anexos não são regravados nem desvinculados por uma edição de apresentação do campo.
8. Salvar/publicar mantém versionamento/CAS, valida referências e composição no servidor, impede sobrescrever edição concorrente e preserva rascunho em caso de falha. Trocar pipeline, etapa ou aba com alterações pendentes oferece opção clara de salvar ou descartar, sem perda silenciosa; após sucesso, o editor mostra o estado confirmado.
9. O formulário publicado controla a composição de cada seção configurável dentro do card da etapa, sem duplicar controles em painéis diferentes. Campos ainda sem valor aparecem para preenchimento; valores já preenchidos e anexos permanecem íntegros. Etapas com controles nativos, em especial Agendar Reunião, Lost e Fechado, preservam seus fluxos e guards específicos.
10. A UI usa a linguagem visual do Painel Alpha e rótulos/instruções simples. Estado vazio orienta a criar uma seção ou adicionar campo; erros identificam o item e a correção possível; foco, contraste, nomes acessíveis e rolagem funcionam em desktop e mobile.
11. A solução oferece uso operacional independente da UI para as operações de configuração e inspeção necessárias, conforme CLI First da Constitution; a UI consome os mesmos contratos autoritativos. Não criar decisões de obrigatoriedade apenas no cliente.

## Tasks / Subtasks

- [x] Mapear catálogo, renderer, actions de campos/formulários, configuração de etapa e guard de transição; registrar o que pode ser editado com contratos atuais (AC 3–7, 11).
- [x] Implementar leitura de impacto/uso com autorização por pipeline e contagens/referências necessárias; evitar expor valores privados na análise (AC 4, 6, 7).
- [ ] Completar comandos/contratos de configuração e inspeção utilizáveis fora da UI; manter identidade de campo, CAS e validações do servidor (AC 5–8, 11).
- [x] Reformular o editor e a navegação responsiva segundo a imagem e o design system atual; incluir seleção, catálogo, composição, propriedades, análise de uso e feedback de publicação (AC 1–4, 6, 8, 10).
- [x] Integrar a composição publicada às seções do card e aos requisitos de avanço sem duplicar controles nem enfraquecer regras especiais (AC 5, 9).
- [x] Testar fluxos de edição segura, anexos, concorrência, troca de contexto e guards; validar as interações automatizadas do editor.
- [ ] Validar visualmente em navegador desktop/mobile e teclado em ambiente autenticado.
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar resultados reais e atualizar checklist/File List antes de concluir.

## Dev Notes

- Editor: `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` e `FormularioEtapaWorkspace.tsx`.
- Contratos: `src/actions/bpm/Campos.ts`, `src/actions/bpm/FormulariosEtapa.ts`, `src/lib/bpm/formularios-etapa.ts`, `src/lib/bpm/formulario-renderer.ts`, `src/lib/bpm/requisitos-etapa-server.ts`, `src/lib/bpm/transicao-command.ts`.
- Card: `src/app/PainelAlpha/AlphaCRM/CardModal/` e `src/actions/bpm/Cards.ts`.
- Stories relacionadas: `story-alpha-crm-formulario-unificado-por-etapa.md`, `story-alpha-crm-edicao-campos-card.md`, `story-rm-2026-b5c986-manter-aba-campos-formularios.md`, `story-rm-2026-4c9c6d-gestao-campos-dados.md`. A primeira ainda tem tarefas guarda-chuva abertas; preservar os contratos já implementados e verificar diferenças entre documentação e código.
- `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados nesta árvore na criação da story. Reavaliar se surgirem antes da implementação.
- O fluxo de exclusão de `Campos.ts` já verifica valores e anexos; reutilizar essa proteção e ampliar a comunicação de impacto. Não fazer limpeza de dados para “liberar” alteração.

## Testing

- Testes de contrato/integração BPM: configuração por etapa/pipeline, publicação/CAS, leitura de uso, alteração compatível de campo usado, bloqueio de alteração incompatível e preservação de `BpmCardAnexo`/valor.
- Teste de transição com obrigatório de saída/entrada faltante e preenchido; regressão de controles nativos de Agendar Reunião, Lost e Fechado.
- Teste de interação do editor: nova seção, seleção, edição, prévia, publicação, falha, conflito, troca de contexto com rascunho e navegação por teclado. Comparar a composição final do card com a publicada, não somente texto do código.
- Verificação visual responsiva com a imagem como referência de layout, sem importar aparência de outro produto.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Frontend (primário), API/integração BPM (secundário); complexidade alta.
- **Specialized Agents:** `@dev` executor; `@ux-design-expert` para revisão visual/acessibilidade; `@qa` para cobertura; `@architect` se houver decisão de contrato. `@devops` apenas para PR/deploy, se solicitado.
- **Quality Gates:** pre-commit por `@dev` com lint, typecheck, testes, build e revisão; pre-PR por `@devops` quando houver PR; pre-deployment somente em implantação.
- **Self-Healing (Story 6.3.3):** `@dev` light, até 2 iterações/15 min, corrige CRITICAL e documenta HIGH; `@qa` full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; `@devops` check, somente relatório. Ajustar ao que estiver disponível no ambiente, sem declarar gate não executado.
- **Focus Areas:** autorização por pipeline, preservação de IDs/arquivos/valores, CAS e referências, guard servidor, regressões do card, acessibilidade e responsividade.

## Checklist

- [x] Pedido e referência visual traduzidos em critérios verificáveis.
- [x] Contratos e stories existentes identificados; nenhuma migration assumida.
- [x] Implementação e testes concluídos com evidência real.
- [ ] Qualidade, integração no card e experiência visual aprovadas.
- [x] File List final atualizada com todos os arquivos efetivamente alterados.

## File List

- `docs/stories/story-alpha-crm-campos-formularios-obrigacoes-por-etapa.md` — story e evidências.
- `src/actions/bpm/Campos.ts` — análise de uso e proteção de valores/anexos/configurações.
- `src/actions/bpm/FormulariosEtapa.ts` — publicação atômica da composição e obrigações.
- `src/lib/bpm/formularios-etapa.ts` — contrato das obrigações.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` — contexto do pipeline.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — editor visual, prévia, regras e análise de uso.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ListaCamposFormulario.tsx` — seleção e modo somente leitura.
- `tests/bpm/campos-configuraveis-actions.test.ts` — uso e proteção de campo.
- `tests/bpm/formularios-etapa-save.test.ts` — obrigações e publicação.
- `tests/bpm/pipeline-editor-react.test.ts` — fluxo do editor.
- `tests/bpm/relacionamento-ui.test.ts` — tipos de campo no editor.
- `tests/bpm/crm-configuracoes-centralizadas.test.ts` — estrutura visual atual.
- `tests/bpm/formulario-etapa.test.ts` — texto e controles da etapa.
- `tests/bpm/formulario-lista-plana.test.ts` — somente leitura (sem alteração do teste; passou após correção do componente).

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-09-23 | 0.1 | Story criada a partir do pedido e da imagem de referência, com análise de uso e segurança de dados existentes. | River |
| 2026-09-23 | 0.2 | Editor reformulado, análise de uso e publicação atômica das obrigações; testes BPM e interface atualizados. | Codex |

## Dev Agent Record

- Agent Model Used: Codex GPT-6.
- Debug Log References: `npm run lint` (0 erros, 1192 avisos existentes), `npm run typecheck` (passou), `npm test` (501 arquivos, 3784 testes aprovados; 4 ignorados, 1 todo), `npm run build` (passou; avisos no módulo PDF não relacionado).
- Completion Notes: sem migration ou escrita em banco; arquivos, valores e IDs preservados. CLI de edição e inspeção independente da UI (AC 11) e validação visual em navegador autenticado permanecem pendentes.

## QA Results

Revisão automatizada de ações e UI passou. A validação visual manual e o comando CLI independente ainda precisam de revisão; a story fica Ready for Review.
