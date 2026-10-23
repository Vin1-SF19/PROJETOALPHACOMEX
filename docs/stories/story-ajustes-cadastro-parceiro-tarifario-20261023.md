# Story: CRM — salvar consulta CNPJ, parceiro e condição tarifária

## Status e responsáveis

Ready for Review — autoria `@sm`; implementação `@dev`, validação `@qa`, publicação `@devops`, primeiro em staging. Base informada `origin/staging` `296185df`, união validada com as mudanças já publicadas. Produção não autorizada nesta entrega; configuração do tarifário no staging aprovada especificamente pelo usuário em 23/10/2026 após validação do backup; repositório original dirty permanece intacto.

## Story

Como usuário do CRM, quero salvar os dados após consultar CNPJ, vê-los nos formulários relacionados mantendo edição manual, selecionar parceiros normalmente e informar se o fechamento usa o tarifário padrão.

## Acceptance Criteria

1. Reproduzir o erro em **card → Dados da empresa → Editar dados → consultar CNPJ → Salvar**, identificar a causa com evidência e corrigir o caminho real, sem mascarar a resposta de erro. Diagnosticar em ambiente isolado/staging; não experimentar gravações em registros reais de produção.
2. Salvar mostra carregamento, evita duplo envio e confirma sucesso apenas após commit. Erro mantém rascunho editável e mensagem acionável; cancelar/descartar mantém o contrato sem escrita. Preservar ACL, validação, CAS, atomicidade e auditoria existentes, incluindo antes/depois e autor.
3. Dados salvos e autorizados aparecem nos formulários e campos laterais vinculados às mesmas fontes canônicas após atualização/reabertura, sem cópias divergentes ou exigência de reconsultar CNPJ. Campos permitidos continuam aceitando escrita manual livre conforme seu tipo; consulta não os bloqueia nem sobrescreve edição humana posterior. Tratar mapeamentos/valores ausentes sem inventar dados.
4. Remover somente a linha **“Parceiro responsável · automático”** pedida pelo usuário. Preservar o seletor condicional existente de **Indicação de parceiro**, seus vínculos e regras de exibição; não apagar dados ou alterar automaticamente a origem.
5. Corrigir o seletor de parceiro para permitir seleção e scroll dentro do card/modal. Investigar interação real de Dialog/Popover, foco/portal e eventos, sem assumir essa hipótese como causa confirmada. Opções escolhidas ficam visíveis e persistem pelo salvamento existente; teclado, rolagem e clique não fecham o modal indevidamente nem ampliam acesso a parceiros.
6. Em **Em Tratativa**, apresentar acima de **Condição Negociada** o select **“Fechado no tarifario padrao?”** com três opções: **Sim**, **Não** e **Não informado…**. O padrão é **Não informado…**; ausência nunca equivale a Não ou Sim e não é inferida por preço, contrato ou outro campo.
7. **Condição Negociada** fica visível somente quando o select for **Não**. Sim/Não informado ocultam esse campo sem apagamento silencioso de valor já salvo; mudanças de visibilidade não geram gravações por si. Não criar obrigatoriedade ou conversão não solicitadas.
8. Verificar os contratos/configuração/campos existentes antes de escolher persistência do triestado e sua projeção. Não inventar schema, executar migration, seed/backfill ou alterar configuração remota implicitamente. Se faltar campo/configuração necessária, preparar a mudança concreta e identificar o gate/autorização aplicável antes da execução.
9. Testes pertinentes cobrem consulta→Salvar válido/erro/loading, sincronização dos campos e edição manual, cancelamento, parceiro em modal com seleção/scroll, retirada da linha sem quebrar indicação, triestado/default e condição visível somente para Não, inclusive reabertura. Executar gates do projeto e obter QA; validar primeiro em staging. Produção desta correção requer autorização própria posterior.

## Tasks

- [x] Reproduzir e diagnosticar falha de salvamento e interação do seletor em candidato isolado.
- [x] Corrigir salvamento/atualização dos dados e preservar edição manual/contratos de segurança.
- [x] Remover a linha solicitada e corrigir seleção/scroll do parceiro.
- [x] Mapear e preparar select triestado/condição dependente sem mutação remota implícita.
- [ ] Executar testes/gates, obter QA e validar staging quando autorizado.
- [ ] Registrar causa, resultados e File List; manter produção e arquivos dirty fora da entrega.

## File List

- `docs/stories/story-ajustes-cadastro-parceiro-tarifario-20261023.md`
- `docs/vault/ajustes-cadastro-parceiro-tarifario-20261023.md`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/EmpresaCadastro.ts`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaEditor.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/components/comercial/SeletorParceiroPesquisavel.tsx`
- `src/components/ui/popover.tsx`
- `src/lib/bpm/cadastro-campos.ts`
- `src/lib/bpm/campos-configuraveis-server.ts`
- `src/lib/bpm/campos-dinamicos.ts`
- `src/lib/bpm/card-modal-ui.ts`
- `src/lib/bpm/dados-empresa-edicao.ts`
- `src/lib/bpm/dados-empresa.ts`
- `src/lib/bpm/requisitos-etapa-server.ts`
- `tests/bpm/cadastro-campos-projecao.test.ts`
- `tests/bpm/edicao-campos-card.test.ts`
- `tests/bpm/empresa-cadastro-editor-react.test.ts`
- `tests/bpm/empresa-cadastro-sqlite.test.ts`
- `tests/bpm/empresa-cadastro.test.ts`
- `tests/bpm/requisitos-etapa-server.test.ts`
- `tests/bpm/tarifario-condicional-react.test.ts`
- `tests/bpm/tarifario-condicional-server.test.ts`

## Implementação e limites

- CEP conhecido de ReceitaWS normalizado antes da validação, sem aceitar letras nem truncar o valor. Complemento cadastral opcional preserva JSON anterior.
- Erros específicos de cada tentativa mantidos no editor e no retry, com loading, bloqueio de clique duplo e rascunho preservado. Auditorias em lote dentro da mesma transação; falha de cache pós-commit não transforma sucesso em erro.
- Cadastro salvo alimenta os aliases publicados de endereço e contatos inequívocos. Substituições locais e limpezas explícitas prevalecem; dados de equipe, indicação e mapeamentos protegidos permanecem canônicos. Eventos usam o mesmo valor anterior efetivo exibido ao usuário.
- Popover do parceiro usa o container do Sheet quando existe, mantendo foco e scroll dentro do modal; seleção por mouse e Enter e wheel real validados em Chrome 1280 e 390 px. Fixture local usa somente parceiros sintéticos; não equivale a teste remoto autenticado.
- Tarifário reutiliza campo publicado existente. Catálogo de edição antecipa somente a dependência exata da condição negociada; servidor valida a seleção submetida antes da condição, com ACL e CAS preservados. Formulário precisa da publicação metadatária descrita no relatório Vault.
- A configuração remota do tarifário foi aprovada especificamente pelo usuário; aplicação aguarda backup completo atual verificado e publicação do código. Nenhuma configuração, lead ou produção foi alterado nesta preparação.

## Evidências

- Diretório privado: `/home/ialpha/.cache/painel-alpha/ajustes-cadastro-parceiro-tarifario-20261023/`. Logs `build-approved.log`, `typecheck-approved.log`, `lint-approved.log`, `tests-release.log`, `visual/report.json`; parecer final QA e recibo de staging serão anexados ao encerrar.
- Um worker da rodada anterior de testes não iniciou durante pressão de memória do host; o arquivo de 15 testes passou isoladamente. A rodada final usa dois workers. O typecheck foi refeito após liberar somente caches temporários de compilação das tarefas anteriores deste agente.

## Gates finais do candidato sobre staging 296185df

- Build: PASS, 86 páginas. Typecheck: PASS. Lint: PASS, zero erros e 1184 avisos legados.
- Testes completos: PASS, 763 arquivos, 6352 testes, 4 skipped e 1 todo, 105,13s, saída 0. A última rodada completa está em `tests-release.log`.
- Browser: PASS em Chrome real com Sheet modal e componente de produção, 1280/390 px; wheel avança 470 px, seleção por mouse e pesquisa+Enter funcionam, sem overflow horizontal nem erros de JavaScript.
- Consulta externa paga e navegação remota autenticada não foram simuladas como execução real: consulta→salvar e autorização/auditoria foram testadas com fixtures sintéticas e SQLite descartável.
- Consentimento do usuário: “Sim, aplicar no staging após validar o backup”, pergunta `call_b744da133e7441cea0e0aae8a684c6f5`. Limitado às 18 operações metadatárias do relatório Vault.
