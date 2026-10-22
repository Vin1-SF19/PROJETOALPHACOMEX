# Story: CRM — resumo compacto do card aberto

## Status

Ready for Review — autoria `@sm`; implementação `@dev`, validação `@qa` e publicação `@devops`, primeiro em staging. Layout, conferência visual e todos os gates concluídos; publicação staging em preparação. Produção desta nova UI não está autorizada.

## Story

Como usuário do CRM, quero organizar **Em edição: pipeline · etapa**, responsáveis Comercial/Operacional e recebimento/permissão em blocos lado a lado, para liberar espaço vertical no card aberto, removendo o texto explicativo de Histórico de passagem.

## Acceptance Criteria

1. Remover somente o texto explicativo completo **“Histórico de passagem — as abas consultam a jornada; o formulário permanece no card em edição”**, preservando a funcionalidade correspondente.
2. Apresentar os blocos de contexto de edição, responsáveis anteriores e recebimento/permissão lado a lado no desktop, com largura flexível e sem overflow; empilhar no mobile mantendo leitura e acesso aos controles.
3. Preservar todos os nomes, status, motivos e textos de permissão, botão **Assumir**, ACL, callbacks e estados de loading/erro. A reorganização não amplia acesso nem muda comportamento.
4. Preservar abas, histórico, origem, dados da empresa e formulário/edição. Não alterar schema, APIs ou dados.
5. Validar visualmente desktop/mobile e executar os gates do AGENTS, reutilizando testes existentes; não criar testes novos para este ajuste CSS de baixo risco. Publicar/validar primeiro em staging quando autorizado; produção exige autorização própria posterior.

## Tasks

- [x] Implementar blocos responsivos e remover o texto solicitado.
- [x] Reutilizar testes existentes, executar gates e validar visual desktop/mobile.
- [ ] Validar entrega em staging e registrar evidências, sem publicar esta UI em produção.

## File List

- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRecebimentoCard.tsx`
- `docs/stories/story-crm-card-aberto-resumo-compacto-20261022.md`

## Implementação e evidências

- Base isolada: staging aprovado `04cc69c0b716dc340ad0a3f63670406bbe631f98`. Sem incorporar arquivos dirty de outros checkouts, código WIP ou mudanças de banco/configuração. Escopo executável restrito aos dois componentes listados.
- Cabeçalho apresenta etapa atual como primeiro bloco; cada responsável anterior, situação atual do recebimento e impedimento de assunção ocupa seu próprio bloco com borda. Grid flexível lado a lado desde640px, uma coluna abaixo disso; espaços verticais do cabeçalho reduzidos. Texto explicativo de Histórico de passagem removido inteiro.
- `PainelRecebimentoCard` aceita somente um slot visual opcional `contextoEtapa`; lógica de assunção, ACL, lock de cliques, estados, mensagens, callbacks e reconciliação permanecem iguais. Cards sem recebimento exibem o bloco de etapa sem painel vazio.
- Testes existentes focados:4arquivos/38PASS. Suite completa `npm test`: **729arquivos/5909PASS,4skipped,1todo**,exit0, cobertura gerada (`/tmp/crm-card-aberto-blocos-20261022-tests.log`). Nenhum teste novo para CSS foi adicionado.
- `npm run lint`:exit0,0erros/1193avisos legados (`/tmp/crm-card-aberto-blocos-20261022-lint.log`). `npm run build` padrão:exit0,81páginas; warnings preexistentes do pdfjs, sem falha (`/tmp/crm-card-aberto-blocos-20261022-build.log`). `npm run typecheck`:exit0, executado em sequência após o build (`/tmp/crm-card-aberto-blocos-20261022-typecheck.log`).
- Prévia Chromium real com fontes e CSS reais e fixture fictícia Boas vindas/ADM: **1440/768/390px PASS**, sem overflow/erros. Em1440px,4blocos alinhados na mesma faixa de57px; em390px,4blocos empilhados de350px. Aviso completo preservado, ação proibida ausente e texto descartado ausente. Nenhuma conexão ou escrita de dados pela prévia. Capturas e recibo `/tmp/crm-card-aberto-blocos-visual/{header-1440.png,header-768.png,header-390.png,verification.json}`.
- QA de código PASS: delta somente visual, condições e callbacks intactos. Ratificação final depende de gates completos e conferência staging.

## Integração com avanço paralelo de staging

- Durante os gates, staging avançou para **`37a7048dc7eb2129f0a48e1868231b11d8482487`**, descendente de04cc com a entrega CheckList de outro fluxo. DevOps fez fast-forward normal para37a; os dois componentesUI e esta story foram preservados byte a byte. Não houve conflito, reset, reaplicação de migration ou alteração de banco. O delta desta entrega continua somente os três arquivos da File List.
- Cliente Prisma privado regenerado para acompanhar o schema já publicado do novo staging, semSQL. Gates repetidos na árvore combinada: **build padrão exit0/86páginas,lint exit0/0erros1183avisos legados,typecheck exit0**, sem mudança de scripts/configurações. Logs em `/home/ialpha/.cache/painel-alpha/crm-card-aberto-blocos-20261022/{build-combined,lint-combined,typecheck-combined}.log`.
- Primeira execução global encontrou `/tmp`sem espaço; descarte dessa rodada como evidência de aprovação. Foram removidos apenas caches gerados e inativos, preservando fontes, ambientes e dados; área temporária privada emHOME e espaço de `/tmp` conferidos antes da nova rodada.
- Nova execução global real `npm test -- --maxWorkers=4`: **745arquivos,6092PASS,4skipped,1todo e um teste com timeout5s** no arquivo legado `tests/bpm/contratacao-em-tratativa-config.test.ts`. Não houve falha lógica ou dos componentes alterados. Retentativa isolada **do arquivo inteiro**, sem ampliar timeouts: **13/13PASS,exit0,6,06s totais**. Cobertura dos6093testes confirmada pela rodada global e retentativa limitada; não alegar que a primeira execução global combinada saiu com exit0. Nenhum teste/fonte fora da UI foi modificado para contornar a infraestrutura.
- Recibos globais e retentativa: `tests-combined-final.log` e `tests-retry-contratacao.log` no mesmo diretório privado. Prévia visual anterior continua aplicável: os dois componentes e CSS são idênticos e não foram tocados pelo avanço37a.
