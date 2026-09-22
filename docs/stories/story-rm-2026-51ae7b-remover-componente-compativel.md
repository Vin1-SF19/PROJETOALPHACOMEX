# RM-2026-51AE7B — Remover “Adicionar componente compatível”

## Status

In Progress — fase 3 implementada localmente; gates globais falharam e aceite funcional autenticado permanece pendente.

- Projeto: Painel Alpha / Alpha CRM. Data: 2026-09-22.
- Responsável pela fase: Nova, por atribuição explícita do pipeline.
- Fonte: objetivo RM-2026-51AE7B e os dois resumos Scout recebidos no pipeline, ambos `CONTEXT_AUDITED`. O blueprint está consolidado abaixo para consumo sem depender do histórico da sessão.
- Objetivo 4 de 10 do grupo integrado; referência operacional: pipeline Revisão de Radar.

## Objetivo e escopo

Como administrador autorizado, quero configurar Campos e formulários sem a opção “Adicionar componente compatível”, mantendo a capacidade de adicionar, criar, editar e excluir campos pelo fluxo existente.

Remover exclusivamente o seletor visual de componentes compatíveis e suas dependências locais sem uso. “Adicionar campo” corresponde atualmente ao seletor “Adicionar campo aplicável…” para campos existentes; “Criar novo campo” abre o diálogo de criação. Preservar ambos, sem renomeá-los. Manter tipos, opções quando aplicáveis, obrigatoriedade, composição e publicação.

Fora do escopo: backend, auth, API, schema, migrations, configurações de produção em lote, catálogo compartilhado de capacidades, outras telas/abas e implementação dos demais objetivos do grupo. Nenhuma alteração de banco é necessária.

## Dependências e blueprint Scout consolidado

Dependência: [RM-2026-B5C986](story-rm-2026-b5c986-manter-aba-campos-formularios.md), que estabelece navegação e rascunho por pipeline/etapa. A implementação local já existe, mas sua story ainda registra validações pendentes; não presumir aceite concluído. Reutilizar esse trabalho e preservar as alterações locais existentes.

Base de caminho: `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/`.

1. Em `FormularioEtapaWorkspace.tsx`, remover o bloco completo `label/select` iniciado na linha 830, incluindo o ícone local e a opção “Adicionar componente compatível…” (840). O bloco é repetido por seção e não possui variante responsiva separada.
2. Remover apenas `adicionarComponente` (311), `catalogoComponentes` (216) e o import `listarCatalogoComponentesFormulario` (30), após confirmar que ficaram sem uso. Preservar `obterDefinicaoComponenteFormulario` (usado em 931), `Plus` e `useMemo`, necessários ao restante da tela. Não remover o catálogo compartilhado nem componentes previamente configurados.
3. Preservar `adicionarCampo`, `abrirNovoCampo`, `Dialog`, `TIPOS_CAMPO`, nome, opções, obrigatoriedade e `CriarCampoBpm`. O seletor de campo começa em 795; “Criar novo campo” está em 824; o diálogo começa em 962.
4. Preservar edição de rótulos, ordenação, movimentação entre seções e remoção da apresentação. Remover da composição não equivale a excluir o cadastro do campo. Manter `AtualizarCampoBpm` e `ExcluirCampoBpm` intactos, assim como suas entradas administrativas existentes.
5. Preservar `SalvarFormularioEtapaBpm`, IDs, `versaoEsperada`, `configVersion`, `publicationBlocked` e `BpmCampoEtapaConfig`. Não mudar aplicabilidade, visibilidade ou lógica de publicação. Manter componentes já configurados apresentados e persistidos.
6. `AdminPipelineClient.tsx:955` é o consumidor real na aba `fields`; preservar o callback em 961 que mantém essa aba antes de `router.refresh()`. `PipelineWorkspaceSections.tsx` não contém o seletor alvo e não requer edição. A aba Card usa `CardKanbanWorkspace`; não ampliar a remoção para ela.

As linhas são referências da inspeção desta fase, não offsets para substituição cega. Aplicar diff mínimo sobre o conteúdo vigente.

## Critérios de aceite verificáveis

- [ ] CA1: na aba Campos e formulários, em todas as seções, desktop e mobile, não aparece “Adicionar componente compatível…” nem seu seletor acessível “Adicionar componente à seção…”.
- [ ] CA2: “Adicionar campo aplicável…” permanece e adiciona campo existente à seção uma única vez, respeitando aplicabilidade e a prevenção de duplicação.
- [ ] CA3: “Criar novo campo” abre o diálogo “Criar campo para…”. Nome, tipo, opções quando aplicáveis e obrigatório continuam disponíveis; cancelar mantém o comportamento existente.
- [ ] CA4: criar um campo válido e executar o fluxo normal de salvamento/publicação faz o campo aparecer na etapa correta, com nome, tipo, opções e obrigatoriedade configurados. Conferir após atualização da tela; distinguir cadastro salvo de composição ainda em rascunho.
- [ ] CA5: edição e exclusão de campos pelo fluxo administrativo existente permanecem funcionais; editar rótulo ou remover da apresentação mantém a semântica atual, sem excluir cadastro indevidamente.
- [ ] CA6: demais controles continuam funcionais: seções, ordenação, movimentação, remoção, seleção de etapa e publicação. Aba, etapa e rascunho preservam o comportamento da RM-2026-B5C986; outras abas não mudam.
- [ ] CA7: componentes já configurados continuam visíveis e persistidos. Publicação mantém payload, IDs, versão esperada, bloqueios e atualização de versão; erro e conflito não promovem rascunho a sucesso nem sobrescrevem configuração concorrente.
- [ ] CA8: registrar gates reais e validar o fluxo autenticado com administrador autorizado. Não apresentar inspeção de código como prova de navegador ou de dados de produção.

## Auditoria de entregabilidade e autoajuste

Artefato desta fase: esta story executável, consumida por dev/Nova por leitura deste arquivo em `docs/stories/`. Artefato final do objetivo: a tela administrativa sem o seletor, consumida por administradores autorizados.

DELIVERY_READY: caminho confirmado no código — Alpha CRM → Configurações (`CRMLayoutClient.tsx:27`, entrada administrativa) → `/PainelAlpha/AlphaCRM/admin` → pipeline (links em `AdminPipelinesListClient.tsx:254,347`) → `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` → Campos e formulários (`fields`) → Pipeline → etapa. As páginas administrativas verificam `auth()` e `isAdminRole`; reutilizar as permissões existentes, incluindo `configurarCampos` nas actions conforme Scout.

O caminho existente dispensa visualizador, download, rota ou botão novo. Navegador autenticado e identidade/dados do pipeline Revisão de Radar não foram validados nesta fase. O sinal acima confirma a infraestrutura, não a remoção ainda pendente.

Autoajuste anterior resolvido: os resumos Scout sinalizaram ausência da story específica (`AUTO_ADJUSTMENT_REQUIRED`). Este arquivo fornece escopo, blueprint, dependências, aceite, checklist e file list antes da alteração de frontend, cumprindo `AUTO_ADJUSTMENT_ACCEPTANCE`. Não foi identificada necessidade de suporte adicional de UI nesta fase.

## Validação planejada e evidências

- Reutilizar `tests/bpm/formulario-etapa.test.ts`, `formularios-etapa-save.test.ts`, `formulario-renderer.test.ts`, `campos-configuraveis-actions.test.ts`, `pipeline-editor-state.test.ts` e `pipeline-editor-react.test.ts`. Ajustar somente expectativas atingidas pela remoção quando necessário; buscas de strings não substituem aceite funcional.
- Na implementação, executar CA1–CA8 em ambiente apropriado, com etapa e campo de teste; não executar limpeza em massa ou mutação de produção para validar esta story.
- Gates obrigatórios: `npm run lint`, `npm run typecheck`, `npm test`. Build real pelo Forge antes de revisão qualitativa; integração pelo Probe na entrega de frontend. PR e screenshot são opcionais e não bloqueiam a implementação local.
- Evidência documental: seletor, controles preservados, consumidor, links e proteção das rotas reinspecionados em 2026-09-22. Nenhuma action ou operação de banco executada.
- Resultados reais desta fase: `npm run typecheck` passou (exit 0); `npm run lint` falhou (exit 1, 2.417 erros e 1.218 avisos no working tree); `npm test` falhou (exit 1) antes da execução dos testes por `EBUSY` ao tentar limpar `coverage`. Nenhuma limpeza manual realizada. As falhas globais ficam registradas para o gate técnico da implementação; o PASS desta fase refere-se somente à story executável, sem aprovação técnica do produto. Logs em `.roadmap-worker/rm-2026-51ae7b-phase2/`. Build e navegador autenticado não fazem parte da aprovação documental e permanecem pendentes para implementação.

## Riscos e rollback

Riscos: remover junto o seletor de campos, retirar dependências ainda usadas ou apagar apresentação de componentes existentes. Mitigar por remoção estritamente local, revisão do diff e CA1–CA7. Preservar alterações preexistentes nos arquivos administrativos.

Rollback futuro: restaurar apenas o bloco visual e as dependências locais removidas por esta RM, sem reverter alterações alheias. Nenhum rollback de dados necessário. Sem Git mutável nesta fase.

## Checklist da fase

- [x] Blueprint Scout recebido e revalidado no código.
- [x] Story criada antes de implementar frontend, conforme padrão documental real.
- [x] Escopo, dependências, critérios verificáveis e limites transcritos.
- [x] Artefato, consumidor e acesso real identificados.
- [x] Autoajuste documental anterior resolvido.
- [x] File list distingue entrega atual de alterações previstas.
- [x] Registrar resultados finais dos gates e arquivar sessão.
- [x] Implementar a remoção mínima na fase 3, preservando o working tree anterior.
- [ ] Validar CA1–CA8 e atualizar status na entrega funcional.

## File list

Entregues nesta fase:
- `docs/stories/story-rm-2026-51ae7b-remover-componente-compativel.md` — story canônica e blueprint consolidado.
- `.bibble/memory/journal.md` — registro aditivo da sessão.

Evidências locais dos gates: `.roadmap-worker/rm-2026-51ae7b-phase2/`.

Alterados na fase 3:
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — retirados seletor, handler local, memo do catálogo e import sem uso (62 linhas removidas).
- `docs/stories/story-rm-2026-51ae7b-remover-componente-compativel.md` — status, checklist, evidências e file list.
- `.bibble/memory/components.md` — nota sobre o comportamento do componente existente.
- `.bibble/memory/journal.md` — registro aditivo da execução.

Nenhum teste alterado; nenhum componente novo.


## Execução local — fase 3 (2026-09-22)

Remoção aplicada sobre o conteúdo existente, conforme Scout. O bloco retirado era comum a todas as seções e larguras de tela. Foram preservados adicionarCampo, abrirNovoCampo, diálogo, tipos, opções, obrigatório, prevenção de duplicação, renderização de componentes existentes e todo o fluxo de publicação. Catálogo compartilhado, backend, outras abas e callback de permanência em fields não foram editados. Nenhuma operação de banco ou Git mutável executada.

DELIVERY_READY: integração confirmada por inspeção — administrador autorizado → Alpha CRM → Configurações → /PainelAlpha/AlphaCRM/admin → pipeline → /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId] → Campos e formulários → etapa. O consumidor real é AdminPipelineClient, na aba fields. Menu, links, auth() e isAdminRole revalidados no código. Não houve navegação autenticada nem confirmação dos dados de Revisão de Radar; CA1–CA8 permanecem abertos para aceite funcional completo.

Gates executados:
- npm run typecheck: PASS, exit 0.
- ESLint do FormularioEtapaWorkspace.tsx: PASS, exit 0.
- git diff --check do arquivo: PASS, exit 0.
- npm run lint: FAIL, exit 1, 2.417 erros e 1.218 avisos globais (mesmas contagens da fase documental).
- npm test: FAIL, exit 1, EBUSY ao limpar coverage, antes dos testes.
- Seis suítes direcionadas existentes, com coverage desabilitado: 50 testes passaram em cinco arquivos; pipeline-editor-react.test.ts não iniciou por happy-dom ausente. Comando encerrou com exit 1; não constitui aprovação da execução inteira.
- Build/Forge, Probe e revisão Lens não executados nesta fase; pendentes junto do aceite autenticado. Não há aprovação técnica global.

Evidências locais: .roadmap-worker/rm-2026-51ae7b-phase3/{implementation.diff,lint.log,typecheck.log,test.log,focused.log,localLint.log}. O diff registra exclusivamente a alteração desta sessão sobre o working tree anterior. RESULT: FAIL por gates de qualidade, com implementação local concluída.
