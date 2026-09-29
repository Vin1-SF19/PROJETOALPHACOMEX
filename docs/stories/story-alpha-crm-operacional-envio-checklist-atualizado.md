# Story — Operacional: Envio do Checklist Atualizado

## Status

Ready for Review — código e configuração v11 validados; publicação da aplicação pendente.

## Objetivo

Na coluna **Envio do Checklist Atualizado** do pipeline Operacional, anexar ao card a planilha Excel atualizada do checklist, criar uma tarefa e disponibilizar o link do arquivo no card no mesmo dia da reunião de alinhamento estratégico. Os campos adicionados devem ser configuráveis em **Configurações → Campos e Formulários**.

## Contexto e referências

- Pedido direto do usuário nesta conversa, após a etapa **Alinhamento Estratégico Agendado**.
- A etapa anterior registra a reunião e exige o link HTTPS do resumo para avançar: `docs/stories/story-alpha-crm-operacional-alinhamento-estrategico.md`.
- `[USER-DECISION]` Por ora, o checklist é uma **planilha Excel anexada ao card**. O upload BPM existente aceita `.xlsx` e `.xls`; reutilizar esse fluxo.
- O Alpha CRM já possui **Configurações → Checklists** e checklist BPM, mas nenhum template ou lista de documentos foi definido para esta etapa. Não materializar checklist BPM por presunção.
- A integração com o módulo operacional **Alpha CheckList** (`src/actions/checklist.ts`, `/PainelAlpha/CheckList`) é **futura**.
- `docs/stories/accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout. `[AUTO-DECISION]` A coerência foi conferida pelas stories relacionadas e pelo código disponível, sem inventar conteúdo ausente.

## Requisitos desta entrega

1. O checklist atualizado deve ser enviado no **mesmo dia da reunião de alinhamento estratégico**.
2. Disponibilizar no card a planilha Excel atualizada como anexo `.xlsx` ou `.xls`, com acesso pelo histórico/documentos vinculados ao card.
3. Criar uma tarefa para o checklist e disponibilizar no card o link do arquivo anexado, com data/hora para verificar o prazo de mesmo dia.
4. Todos os campos novos da etapa devem aparecer em **Configurações → Campos e Formulários**, com a configuração publicada respeitada na leitura, edição e validação.

## Requisitos registrados para o futuro — fora desta entrega

- Utilizar o Checklist nativo do Painel Alpha como experiência do cliente e integrá-lo ao processo do CRM.
- Cliente acessar por login/senha; regra solicitada: login = CPF, senha = CPF ao contrário. **Não implementar essa regra de autenticação nesta story**; antes de eventual implementação, submeter a desenho e revisão de segurança.
- Controlar automaticamente documentos enviados versus pendentes e atualizar os painéis após uploads. Quando o cliente enviar um documento, ele deverá deixar de aparecer como pendente no painel do cliente. Isso depende da experiência nativa futura; a planilha Excel anexada nesta entrega não fornece uma lista estruturada de itens ou uploads de cliente.

## Critérios de aceite

- [ ] O operador pode anexar a planilha Excel atualizada (`.xlsx` ou `.xls`) ao card usando o upload BPM existente e encontrá-la depois no card/histórico, sem criar uma cópia por simples recarregamento.
- [ ] O card identifica o anexo escolhido como checklist atualizado, sem presumir itens, documentos pendentes ou template BPM que não foram definidos.
- [ ] A etapa gera a tarefa do checklist e expõe no card o link para a planilha anexada. A data/hora da disponibilização permite verificar se ocorreu na mesma data civil da reunião de alinhamento. Quando a data da reunião não estiver disponível, a interface não declara o prazo atendido sem evidência.
- [ ] O card mantém vínculo entre a planilha, o cliente e o histórico do processo.
- [ ] Campos novos e requisitos de etapa usados por este fluxo ficam configuráveis em Configurações → Campos e Formulários; a validação do servidor respeita a configuração publicada.
- [ ] O fluxo de upload BPM não sofre regressão; ausência de planilha, anexo Excel e registro de envio são cobertos por testes.
- [ ] Nenhum acesso de cliente por CPF/senha reversa ou novo painel de cliente é ativado nesta entrega.

## Decisões pendentes de produto

- `[USER-DECISION]` Nesta fase, “envio” significa **tarefa e link no card**, sem mensagem externa. Não pressupor destinatário, horário-limite dentro do dia ou comportamento fora do expediente.
- Identificar qual data representa a reunião efetivamente ocorrida se houver remarcação. O cumprimento de “mesmo dia” deve usar essa data, não apenas a data original do convite.
- Nenhuma lista de documentos ou template BPM foi fornecido; não inferir itens da planilha nem automatizar estados de pendência com base apenas no arquivo Excel.

## Checklist de implementação

- [x] Inventariar etapa ativa, formulário publicado, upload/anexos BPM e histórico; registrar diagnóstico somente leitura.
- [x] Desenhar a regra de data civil para reunião e envio com o fuso usado pelo processo, sem presumir horário de corte.
- [x] Reutilizar o upload BPM de `.xlsx`/`.xls`, vincular a planilha ao card, criar tarefa e disponibilizar o link do arquivo no card com data/hora.
- [x] Expor o novo campo da etapa em Campos e Formulários: configuração v10→v11 aplicada e verificada.
- [x] Exibir no card a planilha anexada, o link e a tarefa; manter controle automático de enviados/pendentes para a fase futura do checklist nativo.
- [x] Cobrir aceite por testes de domínio, action e UI; executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
- [x] Aplicar a configuração após relatório Vault, backup completo verificado e autorização específica, conforme AGENTS.md.
- [x] Atualizar esta checklist, a File List e as evidências antes da publicação.

## File List inicial

- `docs/stories/story-alpha-crm-operacional-envio-checklist-atualizado.md` — criação desta story.
- Pontos de integração a confirmar no inventário: fluxo BPM de upload/anexos, `src/actions/bpm/Tarefas.ts`, documentos/histórico do card, formulário da etapa e configuração de Campos e Formulários. `src/actions/bpm/Checklists.ts` e `src/actions/checklist.ts` são referências de sistemas existentes, fora da implementação atual.

### File List da implementação

- `scripts/configurar-checklist-operacional.mts`, `scripts/verificar-checklist-operacional.mts`
- `src/lib/bpm/checklist-envio-operacional.ts`, `src/lib/bpm/transicao-command.ts`
- `src/actions/bpm/Anexos.ts`, `src/actions/bpm/Tarefas.ts`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelEnvioChecklistOperacional.tsx`
- `src/lib/bpm/historico-descricao.ts`, `src/lib/bpm/timeline.ts`
- `tests/bpm/checklist-envio-operacional.test.ts`, `tests/bpm/anexos-idempotencia.test.ts`

### Evidência da preparação

- Inventário somente leitura: Operacional v10, coluna `draft-stage-b455e79f-2390-43f2-bed9-6e86054aa95a` (ordem 2), formulário v2 com 22 componentes, nenhum card na coluna e nenhum template de checklist associado ao pipeline.
- Prévia da configuração: v10→v11, um campo `arquivo` configurável para Excel, exibido na coluna e nas 10 seguintes; obrigatório na saída desta coluna. Formulário da coluna v2→v3, 22→23 componentes. Nenhum card existente alterado.
- Prazo da tarefa: último instante da mesma data civil da reunião em `America/Sao_Paulo`. Sem data da reunião, a interface não declara o prazo cumprido. O upload registra a data/hora e se ocorreu no dia; não envia mensagem externa.
- `prisma migrate diff --script`: migration vazia; sem alteração de schema.
- Backup Vault dedicado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T19-16-01-554Z.sql`, gerado pelo snapshot da réplica Turso. Manifesto adjacente; 183.062.358 bytes, 332 tabelas, 195.086 linhas, SHA-256 `f412e1698f3ff43407b7dd38bc1b0a4ce10afc210d24b897b852b06039b7100f`. Verificação por `scripts/verify-turso-backup.mjs`: hash, tamanho, integridade, chaves estrangeiras e restauração isolada aprovados. O método alternativo por transação longa falhou por timeout antes de gerar dump; não foi utilizado.
- Gates: lint 0 erros (1.191 avisos preexistentes), typecheck e build aprovados; `npm test` com 562 arquivos e 4.129 testes aprovados, 4 ignorados e 1 pendente; testes focados da planilha e anexo aprovados.
- Configuração v11 aplicada em 2026-09-29 após confirmação explícita do usuário para esta alteração, com o backup dedicado verificado antes da transação. `scripts/verificar-checklist-operacional.mts`: `verificado: true`, pipeline v11, campo em 11 etapas, formulário da coluna v3 e obrigatoriedade na saída. Código no commit local `ddd52fb0`; não houve push ou deploy nesta etapa.

## Validação do draft

- Story original, objetivo, critérios observáveis, dependências e limites do futuro documentados.
- Canal definido como tarefa e link no card; nenhum horário, lista de documentos, template BPM ou mensagem externa presumido.
- O código foi implementado e validado localmente; a configuração do Turso e a publicação continuam pendentes.
