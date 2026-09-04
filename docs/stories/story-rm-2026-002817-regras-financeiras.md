# Story RM-2026-002817 — Regras Financeiras configuráveis

## Contexto

O pipeline Financeiro já possui campos de valor bruto, retenções, IRRF, CSRF,
forma de pagamento, valor líquido e memória de cálculo. O CRM também já possui:

- Motor de Regras BPM versionado (`BpmRegra`/`BpmRegraVersao`), com condições
  estruturadas, fórmulas seguras e tabelas de decisão;
- motor de Comissões versionado (`CommissionRule`/`CommissionRuleVersion`),
  lançamentos e memória de cálculo;
- ponto de consumo no card do pipeline Financeiro e guarda transacional de
  movimentação.

A entrega deve conectar essas capacidades. Não será criada uma terceira DSL nem
uma nova tabela. Regras tributárias usam o armazenamento/versionamento de
`BpmRegra`; regras de comissão usam `CommissionRule`; os resultados são aplicados
no card e, após pagamento confirmado, no módulo de Comissões.

## Critérios de aceitação

- [x] Administrador acessa `Alpha CRM > Configurações > Regras Financeiras`.
- [x] CRUD de regras tributárias permite condições por regime tributário,
  serviço, forma de pagamento e campos configuráveis da contratação.
- [x] IRRF, CSRF, respectivas bases e fórmula do valor líquido são configurados
  no painel; nenhuma alíquota ou percentual de negócio fica no código.
- [x] A primeira linha tributária aplicável é escolhida por prioridade, como uma
  tabela de decisão, usando o avaliador estruturado do Motor de Regras e sem
  `eval`/`new Function`.
- [x] O card do pipeline Financeiro mostra loading, vazio, erro e resultado da
  regra (bruto, retenções, líquido e memória), sempre recalculado no servidor.
- [x] Ao avançar o fluxo financeiro, o backend reaplica a regra vigente e
  persiste os campos automáticos na mesma transação da movimentação.
- [x] Regra de comissão permite base bruta ou líquida, percentual ou valor fixo,
  beneficiário e condições; versões publicadas participam do cálculo real.
- [x] Pagamento confirmado no card gera evento/lancamento de comissão idempotente
  e auditável, sem impedir a movimentação caso o subsistema de comissão falhe.
- [x] Todas as Server Actions validam sessão, permissão e payload; ações por card
  também validam acesso ao card.
- [x] Testes cobrem seleção, cálculo, fórmula segura, regras publicadas,
  autorização e integração; lint, typecheck, testes e build não apresentam nova
  regressão no escopo.

## Plano de implementação

- [x] Fase 0 — auditoria de entregabilidade e confirmação dos pontos de reuso.
- [x] Fase 1 — modelagem sem migration, reutilizando modelos existentes.
- [x] Fase 2 — domínio tributário, Actions e integração transacional.
- [x] Fase 3 — rota/UI administrativa e painel de resultado no card.
- [x] Fase 4 — gates técnicos reais.
- [x] Fase 5 — auditoria de segurança.
- [x] Fase 6 — verificação de integração ponta a ponta.
- [x] Fase 7 — revisão de código.
- [x] Fase 8 — memória técnica.
- [x] Fase 9 — journal e fechamento.

## Evidências de verificação

- ESLint direcionado e `git diff --check`: aprovados.
- 8 suítes BPM direcionadas: 69 testes aprovados.
- Suíte completa de comissões: 21 suítes, 196 testes aprovados.
- Suíte BPM ampla: 74 suítes/583 testes aprovados; manteve as 19 falhas
  estruturais basais registradas antes desta entrega, sem falha nova do escopo.
- Typecheck direcionado: sem diagnóstico nos arquivos da entrega; o typecheck
  global mantém erros concorrentes fora do escopo.
- Prisma validate: aprovado.
- Build isolado chegou ao compilador e parou em débito basal de
  `src/app/PdfPreview/page.tsx` (`@react-pdf/renderer` ESM), fora do escopo.

## Restrições

- Não alterar nem concluir o objetivo paralelo RM-2026-209DB4.
- Não criar migration: os modelos necessários já existem no working tree e no
  banco do projeto.
- Dinheiro é calculado em centavos no domínio; conversão para reais ocorre nas
  bordas de UI/campos legados.
- Regras publicadas são imutáveis; edição cria nova versão.
- Ausência total de configuração preserva o fluxo tributário legado; quando há
  regra financeira ativa, configuração inválida ou ausência de correspondência
  bloqueia o pagamento com mensagem observável.

## File List

- `docs/stories/story-rm-2026-002817-regras-financeiras.md`
- `src/actions/bpm/RegrasFinanceiras.ts`
- `src/actions/bpm/Regras.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/CommissionRuleBuilder.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/regras-financeiras/page.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/components/bpm/regras-financeiras/PainelCalculoFinanceiro.tsx`
- `src/components/bpm/regras-financeiras/RegrasFinanceirasWorkspace.tsx`
- `src/components/Comissoes/Configuracoes/ConstrutorRegras.tsx`
- `src/lib/bpm/regras-financeiras/schemas.ts`
- `src/lib/bpm/regras-financeiras/motor.ts`
- `src/lib/bpm/regras-financeiras/persistencia.ts`
- `src/lib/bpm/regras-financeiras/comissoes-card.ts`
- `src/lib/bpm/pipeline-financeiro.ts`
- `src/lib/commissions/persisted-rule-loader.ts`
- `src/lib/commissions/entry-generator.ts`
- `src/lib/commissions/types.ts`
- `tests/bpm/regras-financeiras-engine.test.ts`
- `tests/bpm/regras-financeiras-comissao.test.ts`
- `tests/bpm/pipeline-financeiro.test.ts`
- `tests/commissions/entry-generator.test.ts`
