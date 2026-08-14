# Story — Operacional: Alinhamento Estratégico agendado

## Status

Ready for Dev

## Objetivo

Tornar a etapa **Alinhamento Estratégico agendado** operacional: lembrar visualmente a chamada pendente, registrar seu resumo com template, identificar o responsável pelo processo por nome e CPF e bloquear a saída sem o resumo persistido.

## Decisões de implementação

- O alerta é visual, persistente e aparece no board e no formulário enquanto o campo **Resumo da reunião** estiver vazio. Não há data/hora da chamada configurada na etapa, portanto não será inventado cron ou notificação temporal.
- O template inserível contém: participantes, objetivo, pontos discutidos, decisões e próximos passos.
- Os campos diretos obrigatórios da etapa são: **Responsável pelo processo**, **CPF do responsável** e **Resumo da reunião**.
- CPF recebe validação algorítmica no frontend/backend. O resumo usa campo longo.
- A regra de saída é revalidada no backend antes e dentro da transação; drag-and-drop, botão e action direta convergem no mesmo bloqueio.
- Não há schema ou migration: os dados usam `BpmCampo`/`BpmCardCampoValor` existentes.

## Acceptance Criteria

1. Cards em Alinhamento Estratégico agendado sem resumo mostram alerta vermelho no board e no formulário.
2. O formulário central da etapa expõe os três campos, inclusive se vazios.
3. O resumo tem botão para inserir o template sem sobrescrever texto já digitado.
4. CPF inválido é recusado no cliente e no backend.
5. Nenhum caminho de movimento permite sair da etapa sem resumo persistido.
6. Nome e CPF do responsável podem ser preenchidos e editados posteriormente dentro do card.
7. Campos são configurados na etapa Operacional já criada, sem alterar schema.
8. Histórico/realtime/CAS existentes são preservados.

## Tasks

- [ ] Criar helpers de etapa, template e validação de CPF.
- [ ] Suportar os tipos de campo `texto_longo` e `cpf` no editor/validador.
- [ ] Configurar os campos obrigatórios da etapa no pipeline Operacional.
- [ ] Aplicar alerta e template no formulário e no board.
- [ ] Estender o guard de transição, com validação pré e transacional.
- [ ] Cobrir os fluxos com testes e executar quality gates.

## File List

- A preencher após a implementação.
