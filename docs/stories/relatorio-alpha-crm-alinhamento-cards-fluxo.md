# Entrega — alinhamento dos cards e fluxo Comercial/Financeiro

Data: 20/10/2026. Fonte: `RESUMO PLAUD - ALINHAMENTO 1 CRM.pdf` e decisões do usuário nesta conversa.

## Código implementado localmente

- Compatibilidade com **Fechado / Contrato fechado** e **Stand By / Stand-by — follow-up semanal**, preservando códigos dos status e o ciclo semanal existente. Chaves técnicas reconhecidas nas guardas da transição.
- Nos dois campos comerciais de valor e forma de pagamento, retirada da expressão **exigido na entrada**, preservando o asterisco e as validações. Ajuste no formulário e no painel de requisitos da movimentação.
- Conteúdo explicativo apresentado como **Orientações da etapa**; lista executável como **Checklist da etapa** e área administrativa como **Checklists**. Documento vazio tem mensagem própria. Rejeição de carregamento do checklist termina o estado de carregamento e mostra erro com nova tentativa.
- Histórico RD aproveita autoria original verificável no próprio payload quando ainda não projetada. Não usa o responsável atual como autor. IDs de autores sem nome continuam sem preenchimento presumido.
- Retorno do contrato ao Comercial pelo vínculo explícito da contratação. Somente PDF anexado com elaboração marcada como concluída, ou documento gerado **FINALIZADO**, com PDF e origem financeira conferida, fica disponível.
- O retorno é acionado ao salvar campos financeiros, por alteração de campo da automação, ao confirmar upload do contrato e ao finalizar o documento gerado. Cria uma única tarefa de envio por contratação e protege os estados que já avançaram no Comercial ou Financeiro.
- **Registrar envio** registra ator/histórico, conclui a tarefa e atualiza o campo canônico de envio no Financeiro. O evento alimenta as automações existentes de data e acompanhamento de assinatura. A ação registra um envio já realizado; não envia e-mail ou WhatsApp.
- **Encaminhar pagamento para conferência** cria/reutiliza uma tarefa no mesmo card financeiro vinculado. Não cria outro card, não marca pagamento confirmado e não relaxa os requisitos Financeiro → Operacional.
- Ações específicas para usuários autorizados, inclusive no card final encaminhado; edição e movimentação geral continuam bloqueadas. Consulta de colega não ganha escrita. Controle de concorrência protege os dois cards.
- Download via endpoint autenticado do card Comercial, limitado ao documento validado dessa contratação, sem conceder acesso global ao Financeiro.

## Configuração preparada, ainda não aplicada

A prévia foi executada somente para leitura no banco Turso configurado em `.env.local`, tratado como produção. Nenhuma alteração persistente, migration ou backfill foi executado nesta entrega.

O script `scripts/configurar-alinhamento-crm.mts` prepara, em uma transação:

1. Renomear Fechado para **Contrato fechado**, com chave `fechado`.
2. Renomear Stand By do Radar para **Stand-by — follow-up semanal**, com chave `standby_follow_up`.
3. Exigir o e-mail canônico do contato na entrada em Contrato fechado, inclusive em futura reentrada. A consulta de cards antigos permanece disponível; não há backfill.
4. Acrescentar **Fechado no tarifário padrão**, campo opcional de seleção **Sim/Não**, no formulário Contratação.
5. Incrementar versões de configuração/formulário e registrar auditoria administrativa.

A aplicação exige código compatível publicado, administrador auditor, backup completo verificado de até 48 horas e autorização específica. O script compara o estado atual com a prévia e aborta em divergência. O rollback restaura nomes/regra do e-mail e desativa o campo novo sem apagar respostas eventualmente preenchidas.

Detalhes, backup, comandos exatos, riscos e alternativa: [relatório Vault](./relatorio-vault-crm-alinhamento.md). O banco, os nomes e os campos ativos ainda estão como antes; esta entrega não publicou o código.

## Formas de pagamento preservadas

1. 50% Entrada / 50% Êxito (Pix)
2. Parcelamento Cartão de Crédito - até 12x com juros
3. Integral na contratação - 10% OFF (Pix)

**Pendência expressamente confirmada pelo usuário:** definir novas opções antes de acrescentá-las. Não houve alteração do catálogo atual.

## Pendências para continuidade

- **Admin e líderes de setor moverem cards sem obrigatoriedades:** registrado no [backlog específico](./story-alpha-crm-movimentacao-excepcional-admin-lideres.md), para definição de abrangência, justificativa e auditoria. Não implementado nesta entrega.
- Autorizar a aplicação da configuração descrita no Vault, após publicação do código compatível.
- Homologar com Nai/Naila um ciclo real: elaborar/validar documento → abrir no Comercial → registrar envio → conferir pagamento. Os testes usam dados sintéticos e não enviam comunicações reais.
- Recuperar autores RD ausentes somente quando houver fonte original ou de/para verificável. Nenhuma recuperação em lote foi executada.
- Novos funis TTD/Habilitação, novas cadências, mensagens automáticas e BI permanecem fora deste escopo.

## Validação

- `npm run lint`: zero erros (1.193 avisos existentes).
- `npm run typecheck`: aprovado.
- `npm test`: **4.941 testes aprovados**, 654 arquivos; 4 ignorados e 1 todo.
- Build: compilação ocorreu, mas o processo foi encerrado por falta de memória. O kernel confirmou OOM na tentativa isolada/sequencial. **Publicação bloqueada até build completo aprovado.**
- QA: todos os achados de código corrigidos; **NEEDS_WORK** exclusivamente pelo gate de build não concluído. Sem homologação em dados reais.

Resultados finais e decisão independente constam na [story de implementação](./story-alpha-crm-alinhamento-cards-fluxo-contrato.md#qa-results). Foram adicionados cenários de autorização, estados financeiros posteriores, prontidão do documento, token de conferência, schemas reais de evento/tarefa, concorrência, idempotência, download, upload e finalização do PDF.

CodeRabbit CLI não está instalada no PATH nem em `~/.local/bin/coderabbit`. A revisão foi realizada pelo agente QA, com correção dos achados e nova execução dos testes. Não há aprovação de produção ou publicação implícita nesse resultado.
