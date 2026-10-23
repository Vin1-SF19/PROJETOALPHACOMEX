# Story: Incidente — Fechado comercial sem criação do card Financeiro

## Status e responsáveis

Ready for Review — autoria `@sm`; investigação/correção `@dev`, decisões de arquitetura quando necessárias `@architect`, validação `@qa`, publicação `@devops`. Staging primeiro. Produção limitada ao incidente e a eventual reparo individual confirmado; sem DDL ou alterações amplas.

## Story

Como usuário do Comercial, quero que o fechamento de um negócio elegível crie o card financeiro vinculado exatamente uma vez, para dar continuidade ao processo sem duplicações.

Incidente informado em 2026-10-23: usuário de TI moveu em produção o card de da empresa identificada pelo solicitante (identidade e recibos somente no diagnóstico privado) de **Em tratativa** para **Fechado**, mas o card Financeiro esperado não apareceu. Diagnóstico confirmado em leitura: movimento manual com autoridade administrativa, evento marcado com `automacoesSuprimidas=true`, nenhuma execução e nenhum destino Financeiro. A regra publicada estava ativa e correta.

## Acceptance Criteria

1. Investigar inicialmente somente em leitura: identificar inequivocamente card, pipeline, movimento, ator/horário, destino, histórico, vínculos, eventos/outbox, execuções e erros da automação e configuração publicada. Distinguir card não criado de card criado mas invisível por consulta/estado/ACL. Não expor dados pessoais, segredos ou dumps em artefatos públicos.
2. Demonstrar a causa com caminho de execução e evidência concreta; conferir os contratos atuais de Fechado → Financeiro e as regras aplicáveis ao ator TI. Não alterar permissões ou inventar gatilhos para contornar o incidente; preservar transições, validações e acesso existentes.
3. Preparar correção isolada que faça o fechamento elegível produzir o card Financeiro no destino configurado, vinculado ao Comercial, com dados e efeitos de domínio previstos. Falha transacional ou de execução deve ser identificável/retomável, sem deixar agregado parcial ou mascarar erro como sucesso.
4. Garantir criação única/idempotente: repetição, retry e concorrência não geram outro card/vínculo/evento financeiro para a mesma origem. Card Financeiro já existente permanece vinculado e não tem edições humanas sobrescritas por reprocessamento. Preservar a semântica atual de estado/visibilidade do card comercial.
5. Cobrir regressão do movimento equivalente, ator TI com suas permissões atuais, condições de elegibilidade, destino inválido/ausente, falha e retomada, repetição/concorrência e caso já criado porém não visível. Executar gates do projeto e validar a correção primeiro em staging, com evidências e QA; não experimentar o reparo em produção antes da análise e validação.
6. Após confirmar o diagnóstico e a ausência do destino, preparar reparo somente do card afetado por caminho canônico/idempotente, com prévia, identidade/estado esperados e recibo. Revalidar origem, vínculo e destino imediatamente antes; se já existir destino, não criar outro. Aplicar apenas dentro da autorização específica efetiva e políticas do projeto, registrando antes/depois e auditoria; sem lote, DDL, seed/backfill ou reexecução ampla de automações.
7. Encerrar com causa, correção/testes, validação staging e situação exata do card afetado: reparado e conferido, já existente, ou passo concreto ainda dependente de autorização. Publicação/reparo não incluem mudanças alheias, ampliação de permissões ou arquivos dirty do repositório original. Atualizar checklist e File List com os artefatos efetivos.

8. Conforme esclarecimento explícito do usuário, o encaminhamento é **automático**, inclusive para TI. Novos fechamentos executam o fluxo no servidor; pendência já existente é recuperada automaticamente ao abrir o card com sessão administrativa legítima, pela ação canônica autenticada, sem botão, reinterpretação de evento antigo ou autenticação sintética. Recuperação e retries validam regra/versão/condição/destino atuais e preservam auditoria, CAS, cópia e vínculo.

## Tasks

- [x] Identificar origem/movimento/destino e coletar configuração/logs em leitura.
- [x] Confirmar causa e preparar correção isolada, preservando ACL e contratos.
- [x] Cobrir regressões/idempotência e executar gates locais; ratificação final QA e validação remota seguem registradas separadamente.
- [ ] Validar primeiro em staging e preparar plano individual do card afetado.
- [ ] Revalidar e executar somente o reparo autorizado necessário, sem duplicar destino.
- [ ] Registrar resultado, evidências e File List finais.

## Implementação e validação

- Marcador novo gerado no servidor e também no histórico somente no fechamento comercial livre; eventos anteriores conservam a supressão.
- Exceção aceita apenas regra ativa com grafo inteiro `CRIAR_CARD_OUTRO_PIPELINE → FIM`, vínculo/deduplicação explícitos e destino financeiro ativo. Materializador, worker e efeito transacional revalidam proveniência, autoridade, condição e contexto.
- Destino conserva recepção pendente, SLA, cópia sem sobrescrita e supressão de cadências/automação indireta de `CARD_CRIADO`.
- Recuperação pontual usa sessão real e solicitação nova auditada; a janela tenta automaticamente uma vez por card/regra/destino. Erros permanecem visíveis e os retries preservam a validação restrita. Não foi feito login, simulação de sessão ou escrita em produção nesta fase.
- Arquitetura e QA de fonte aprovaram o desenho. Dois problemas encontrados no retry foram corrigidos; regressão focada de três arquivos/63 testes passou. Gates completos e deployments finais serão registrados abaixo.
- O commit oficial concorrente `eccf19c3` foi preservado por fast-forward antes dos gates.
- Evidências operacionais privadas em `/home/ialpha/.cache/painel-alpha/incidente-fechado-financeiro-20261023/`. Nenhum dado real, dump ou credencial é incluído na entrega.

## File List

- `docs/stories/story-fechado-financeiro-ti-20261023.md`
- `src/actions/bpm/Encaminhamentos.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelEncaminhamentos.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/automacoes/encaminhamento.ts`
- `src/lib/bpm/automacoes/eventos.ts`
- `src/lib/bpm/automacoes/financeiro-movimento-livre-server.ts`
- `src/lib/bpm/automacoes/financeiro-movimento-livre.ts`
- `src/lib/bpm/automacoes/minuta-movimento-livre.ts`
- `src/lib/bpm/automacoes/orquestrador.ts`
- `src/lib/bpm/automacoes/recuperacao-financeiro-server.ts`
- `src/lib/bpm/transicao-command.ts`
- `tests/bpm/encaminhamentos-painel-react.test.ts`
- `tests/bpm/financeiro-movimento-livre-seguranca.test.ts`
- `tests/bpm/financeiro-movimento-livre-sqlite.test.ts`
- `tests/bpm/movimento-livre-command.test.ts`

## Gates finais locais — 2026-10-23

- `release-tests.log`: 751 arquivos, 6.221 testes PASS, quatro ignorados e um todo; exit 0.
- `release-lint.log`: zero erros e 1.183 avisos legados; exit 0.
- `release-build.log`: build padrão completo, 86 páginas; exit 0.
- `release-typecheck.log`: typecheck sequencial após build; exit 0.
- Revisão de fonte sem P1/P2 pendentes após as correções; QA local final PASS recebido para commit e publicação somente em staging; validação remota ainda pendente neste checkpoint.
- O encaminhamento ocorre automaticamente no fechamento pelo servidor; recuperação de pendência ocorre ao abrir o card com sessão real, sem botão. Nenhuma escrita de reparo, DDL ou publicação de produção foi realizada por este checkpoint.
