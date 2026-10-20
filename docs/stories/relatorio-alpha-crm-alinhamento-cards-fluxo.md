# Entrega — alinhamento dos cards e fluxo Comercial/Financeiro

Data: 20/10/2026. Fonte: `RESUMO PLAUD - ALINHAMENTO 1 CRM.pdf` e decisões do usuário nesta conversa.

Código publicado em [painel.alpha-comex.com](https://painel.alpha-comex.com), com configuração autorizada aplicada em 20/10/2026.

## Melhorias publicadas

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

## Configuração aplicada

A identidade do banco Turso foi confirmada contra a variável de produção da Vercel. A autorização “autorizo” foi registrada para o plano exato, e o backup completo foi restaurado e verificado antes da execução. Não houve alteração de schema, backfill ou alteração de valores preenchidos em cards.

O script `scripts/configurar-alinhamento-crm.mts` aplicou, em uma transação:

1. Fechado renomeado para **Contrato fechado**, com chave `fechado`.
2. Stand By do Radar renomeado para **Stand-by — follow-up semanal**, com chave `standby_follow_up`.
3. E-mail canônico do contato obrigatório na entrada em Contrato fechado, inclusive em futura reentrada. A consulta de cards antigos permanece disponível; não há backfill.
4. **Fechado no tarifário padrão**, campo opcional de seleção **Sim/Não**, acrescentado no formulário Contratação.
5. Versão da configuração **33 → 34**, versão do formulário **2 → 3**, com auditoria administrativa.

A primeira tentativa encontrou `SQLITE_BUSY`. Vault verificou por leitura que não houve aplicação parcial: snapshot idêntico ao plano, versão 33, sem campo novo nem auditoria da operação. A repetição do mesmo comando guardado concluiu com sucesso, versão 34. Não houve mudança do plano, ampliação do escopo ou rollback.

Detalhes, backup, comandos, auditoria e verificação: [relatório Vault](./relatorio-vault-crm-alinhamento.md). O rollback preparado restaura nomes/regra do e-mail e desativa o campo novo sem apagar respostas; sua execução exige autorização própria.

## Formas de pagamento preservadas

1. 50% Entrada / 50% Êxito (Pix)
2. Parcelamento Cartão de Crédito - até 12x com juros
3. Integral na contratação - 10% OFF (Pix)

**Pendência expressamente confirmada pelo usuário:** definir novas opções antes de acrescentá-las. Não houve alteração do catálogo atual.

## Pendências para continuidade

- **Admin e líderes de setor moverem cards sem obrigatoriedades:** registrado no [backlog específico](./story-alpha-crm-movimentacao-excepcional-admin-lideres.md), para definição de abrangência, justificativa e auditoria. Não implementado nesta entrega.
- Homologar com Nai/Naila um ciclo real: elaborar/validar documento → abrir no Comercial → registrar envio → conferir pagamento. Os testes usam dados sintéticos e não enviam comunicações reais.
- Recuperar autores RD ausentes somente quando houver fonte original ou de/para verificável. Nenhuma recuperação em lote foi executada.
- Novos funis TTD/Habilitação, novas cadências, mensagens automáticas e BI permanecem fora deste escopo.

## Validação

- `npm run lint`: zero erros (1.193 avisos existentes).
- `npm run typecheck`: aprovado.
- `npm test` no pacote baseado em produção: **4.924 testes aprovados**, 654 arquivos; 4 ignorados e 1 todo. Os 4.941 testes do workspace original incluem alterações de outras tarefas e são evidência anterior, não o gate do pacote publicado.
- Build: **aprovado na Vercel**, tanto no preview como no target de produção. As tentativas locais foram interrompidas por memória e não foram contadas como aprovação.
- QA: **APPROVED**, sem achados de código abertos para o patch publicado.
- Verificações HTTP: página inicial 200, CRM sem autenticação redirecionado, download sem autenticação negado. No domínio principal a proteção da Vercel apresentou desafio 403; na URL isolada da mesma release o endpoint respondeu 401. Nenhuma proteção foi relaxada.
- Homologação de um ciclo autenticado com dados reais permanece pendente com Nai/Naila.

Resultados finais e decisão independente constam na [story de implementação](./story-alpha-crm-alinhamento-cards-fluxo-contrato.md#qa-results). Foram adicionados cenários de autorização, estados financeiros posteriores, prontidão do documento, token de conferência, schemas reais de evento/tarefa, concorrência, idempotência, download, upload e finalização do PDF.

CodeRabbit CLI não está instalada no PATH nem em `~/.local/bin/coderabbit`. A revisão foi realizada pelo agente QA, com correção dos achados e nova execução dos testes.

## Evidências da publicação

O pacote foi preparado em checkout isolado sobre a versão de produção confirmada `1504a1c6255693073ef437d2103d271065d7168a`, preservando as proteções e alterações já publicadas. Alterações locais de outras tarefas ficaram fora da entrega.

- Checkout: `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/crm-alinhamento-prod-base-20261020`.
- Patch aprovado: `23ad30083b76a0c4e61be3867fcbfd7d62549f6052e6a5197220e011ee6604a9`, 39 arquivos conferidos.
- Preview READY: `dpl_HGxKK2fARxUvHCVX9axXBmMkrjXj`.
- Produção READY e ativa no domínio: `dpl_9ExDHA2EK2Te4nZCSRpKDr9Zdh5t`.
- A produção foi construída com suas próprias variáveis existentes, antes da promoção. Alias anterior conferido imediatamente antes da troca, sem publicação concorrente.
- Não houve alteração de variáveis remotas, audiência, proteção de acesso ou serviços locais. A sessão expirada da Vercel foi renovada automaticamente pelo CLI, sem necessidade de nova conexão.
- Patch, manifesto, logs e relatório DevOps: `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/crm-alinhamento-prod-base-20261020-report.md`.

O código permanece no workspace e no patch isolado; esta entrega não criou commit nem fez push. Antes de uma publicação futura pelo Git, incorporar esse patch à linha correspondente para preservar as melhorias já ativas.
