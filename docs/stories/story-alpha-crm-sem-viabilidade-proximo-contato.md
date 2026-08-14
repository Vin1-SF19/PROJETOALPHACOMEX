# Story — CRM: Próximo Contato na entrada de Sem Viabilidade

Status: Ready for Review

> **Supersessão de criação — 2026-08-13:** a criação direta em **Sem Viabilidade** foi substituída pela story `story-alpha-crm-criacao-somente-novos-leads-formularios-no-card.md`. Próximo Contato continua obrigatório para entrada por movimento e permanece disponível para edição dentro do card; referências abaixo a criação direta permanecem apenas como histórico do contrato anterior.

## Contexto

O CRM já bloqueia a movimentação para `Sem Viabilidade` quando `Próximo Contato` não está preenchido. O guard é aplicado no fluxo comum de movimento, usado pelo drag e pelo modal de requisitos, e é revalidado dentro da transação. O caminho de criação direta pelo botão `+` da coluna ainda não aceita, exibe, valida nem persiste `proximoContatoEm`, permitindo criar um card inválido diretamente nessa etapa.

## Objetivo

Fechar o bypass de criação direta e garantir que todo caminho de entrada em `Sem Viabilidade` exija um Próximo Contato válido, com controle acessível na interface e validação autoritativa no backend.

## Critérios de Aceite

1. Ao criar um card diretamente em `Sem Viabilidade`, o modal exibe `Próximo Contato` como Data/Hora obrigatória.
2. A interface não envia a criação enquanto Data/Hora estiver vazia ou inválida e explica claramente a pendência.
3. O valor válido é enviado em ISO e persistido em `BpmCard.proximoContatoEm` na mesma transação da criação.
4. `CriarCardBpm` rejeita a criação direta em `Sem Viabilidade` sem Próximo Contato, independentemente da interface.
5. O backend aplica o mesmo guard canônico já usado pelos movimentos e revalida a etapa e o valor dentro da transação.
6. Se a etapa mudar concorrentemente para uma etapa que exige Próximo Contato, a criação sem valor falha sem card, membro, campos ou histórico parcial.
7. Drag, modal de requisitos e chamadas diretas continuam convergindo no executor comum e não permitem contornar a regra.
8. O modal de avanço continua permitindo preencher Próximo Contato e salvar+mover atomicamente.
9. Dentro de `Sem Viabilidade`, Próximo Contato continua exposto no lado esquerdo do card para edição pelo fluxo normal.
10. A criação bem-sucedida registra no histórico apenas que o requisito foi configurado, sem duplicar dados desnecessários.
11. Realtime só é emitido após commit bem-sucedido.
12. Sessão, acesso ao pipeline, responsável elegível e demais validações existentes permanecem obrigatórios.
13. O painel direito, rotas, menus e automações não são alterados.
14. Não há alteração de schema, migration, seed, backfill ou mutação em massa.
15. A regra é de entrada. A edição ou limpeza posterior já existente não será transformada em invariância permanente sem novo requisito de negócio.
16. A criação direta em outras etapas não sofre regressão. Como o guard canônico também reconhece `Em Tratativa`, a UI de criação deve expor o campo em toda etapa que o domínio declarar como exigente, evitando um novo fluxo impossível.

## Tasks

- [x] Expor um predicado client-safe para identificar etapas que exigem Próximo Contato na entrada.
- [x] Adicionar `proximoContatoEm` ao schema de criação com parsing de Data/Hora e tratamento de vazio.
- [x] Aplicar o guard antes da transação de criação e novamente após reler a etapa dentro da transação.
- [x] Persistir Próximo Contato e registrar metadado mínimo no histórico da criação.
- [x] Exibir e validar o controle Data/Hora no modal de criação das etapas aplicáveis.
- [x] Preservar os fluxos já existentes de drag, requisitos e edição dentro do card.
- [x] Cobrir schema, helper, criação direta, revalidação transacional, ausência de efeitos, permissões e UI.
- [x] Executar gates focados e registrar baselines globais externos, se houver.

## Testes Esperados

- Helper reconhece `Sem Viabilidade` com variações de caixa/acentuação/espaço e não reconhece etapas alheias.
- Schema de criação converte ISO em `Date`, trata vazio e rejeita data inválida.
- Criação direta sem Próximo Contato em `Sem Viabilidade` é bloqueada antes da transação.
- Criação válida persiste data, membro, histórico e emite realtime somente após commit.
- Mudança concorrente da etapa para `Sem Viabilidade` é bloqueada dentro da transação sem efeitos parciais.
- Chamada sem sessão ou sem acesso não alcança efeitos de criação.
- UI renderiza Data/Hora obrigatória, bloqueia vazio, envia ISO e mantém o painel direito intocado.
- Regressão dos movimentos: valor persistido ou enviado atomicamente permite entrada; ausência bloqueia.

## Initial File List

- `src/lib/bpm/em-tratativa.ts`
- `src/lib/validations/bpm.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `tests/bpm/em-tratativa.test.ts`
- `tests/bpm/sem-viabilidade-actions.test.ts`
- `tests/bpm/card-modal-integration.test.ts`

## Dev Agent Record

### Completion Notes

- O predicado compartilhado `etapaExigeProximoContato` é a fonte única para UI e backend e normaliza caixa, diacríticos e espaços.
- A criação direta agora valida Próximo Contato antes e dentro da transação, persiste o valor no card e registra apenas `proximoContatoConfigurado: true` no histórico.
- O modal de criação exibe Data/Hora obrigatória, feedback acessível e envia ISO para Sem Viabilidade e demais etapas declaradas pelo domínio.
- Drag e modal de requisitos preservam o executor comum já protegido; o editor posterior continua no lado esquerdo.
- Nenhuma alteração de schema, migration, seed, backfill, rota ou painel direito.
- Forge: `npx vitest run tests/bpm` — 23 arquivos/158 testes PASS; ESLint focado PASS; `git diff --check` PASS.
- `npm run typecheck` mantém somente os cinco erros basais externos conhecidos em ExclusaoFiscal, HabilitacaoRadarClient e google-calendar/sync-queue.
- Build e lint global não foram executados: não houve rota/schema e o usuário solicitou evitar gates longos sem ganho; foram usados gates proporcionais focados.
- Probe e Anubis: APROVADO, sem bloqueantes, críticos ou importantes.

### File List

- `docs/stories/story-alpha-crm-sem-viabilidade-proximo-contato.md`
- `src/lib/bpm/em-tratativa.ts`
- `src/lib/validations/bpm.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `tests/bpm/em-tratativa.test.ts`
- `tests/bpm/sem-viabilidade-actions.test.ts`
- `tests/bpm/card-modal-integration.test.ts`

## QA Results

READY FOR REVIEW. Forge, Probe e Anubis aprovaram o recorte. A suíte BPM completa passou com 158 testes. O typecheck global permanece limitado exclusivamente por cinco erros basais fora desta story; nenhum diagnóstico foi emitido nos arquivos do CRM alterados.
