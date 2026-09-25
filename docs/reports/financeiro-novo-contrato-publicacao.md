# Financeiro — Novo contrato: plano de publicação e checkpoint Vault

Data: 25/09/2026. Estado: **publicado no Turso remoto com autorização explícita do usuário; auditoria ADM (ID 1)**.

## Ambiente e banco

- Aplicação: Painel Alpha, CRM, pipeline `financeiro`, etapa `solicitacao_contrato` (interface: Solicitação de Contrato / Novo contrato).
- Banco afetado: Turso remoto apontado por `TURSO_DATABASE_URL` em `.env.local`. O arquivo SQLite local indicado por `DATABASE_URL` não é o destino deste plano.
- Formulário: `form:cmt8vpa0h000004jiprwpu64s`; versão atual 4. Pipeline: versão de configuração atual 8. O comando bloqueia a aplicação caso qualquer versão mude.

## Alterações propostas

Uma transação configura somente a primeira etapa do Financeiro: 31 campos em três seções editáveis no administrador (11 cadastrais, 7 da contratação, 13 financeiros), com composição, ordem, rótulos e obrigatoriedade estática. O campo CARD legado `Valor bruto do contrato` é reativado com chave canônica e recebe mapeamento configurável de cópia do campo comercial `Valor acordado no contrato` quando um card Financeiro vinculado é criado. `Regime tributário do cliente` recebe mapeamento configurável do campo comercial `Regime tributário`. Os demais campos compartilhados por cliente usam a mesma identidade cadastrada. A opção `Aguardando pagamento` é acrescentada ao catálogo do campo Status financeiro. O formulário e a versão da configuração são incrementados, com registro de auditoria.

O plano preserva IDs e valores dos campos. Remove da composição **desta etapa** referências de campos fora dos 31 solicitados; os valores históricos desses campos permanecem. Não cria ou altera tabelas, colunas, índices ou constraints. As demais etapas não têm sua composição alterada. O novo código usa alíquotas e indicadores informados pela equipe, sem inferir regime da API de CNPJ. `Indicação` só exige `Parceiro responsável` se houver parceiro vinculado.

## Backup pré mudança

- Arquivos privados em `database-backups/pre-change/`:
  - `painelalpha_turso_pre_change_2026-09-25T13-36-15-207Z.sql`
  - `painelalpha_turso_pre_change_2026-09-25T13-36-15-207Z.manifest.json`
- Motivo no manifesto: `novo-contrato-financeiro`.
- SHA-256: `822fd86696183b3654981f43aa05b4643cd213cd7ce1953ae209072c4d1b2bca`.
- Tamanho: 162.897.427 bytes; 331 tabelas; 170.575 linhas.
- `node scripts/verify-turso-backup.mjs ...sql ...manifest.json` restaurou o dump temporariamente e passou em hash, tamanho, contagens, `PRAGMA integrity_check` e `PRAGMA foreign_key_check`.
- Verificar novamente idade máxima de 48 horas e integridade imediatamente antes da aplicação. Não versionar o dump.

## Sequência de aplicação autorizada e executada

1. Confirmar que a versão do formulário ainda é 4 e a configuração do pipeline ainda é 8 com o modo de plano (somente leitura):

   `node --import tsx --conditions=react-server scripts/bpm-novo-contrato-config.mjs`

2. Confirmar que a conta escolhida para auditoria é um administrador autorizado; executar a operação transacional com o ID confirmado:

   `NOVO_CONTRATO_APPROVED=AUTORIZO_CONFIG_NOVO_CONTRATO_FINANCEIRO node --import tsx --conditions=react-server scripts/bpm-novo-contrato-config.mjs --apply --admin-id=<ID_ADMIN_CONFIRMADO> --expected-version=4 --expected-config-version=8 --backup-base=database-backups/pre-change/painelalpha_turso_pre_change_2026-09-25T13-36-15-207Z`

3. Conferir a publicação no editor e no card, a cópia a partir de `Revisão de Radar`, o cálculo e as pendências de avanço. O script grava um snapshot privado `*.novo-contrato-config.<timestamp>.json` imediatamente antes da transação.

**Resultado:** a primeira tentativa excedeu o timeout padrão de 5 segundos do Prisma e foi revertida; leitura posterior confirmou versões 4/8 e chave legada intacta. A segunda tentativa, com timeout transacional de 60 segundos, concluiu. Formulário versão 5, pipeline `configVersion` 9. Snapshot anterior: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-25T13-36-15-207Z.novo-contrato-config.1790343976334.json`. O verificador somente leitura `node --import tsx --conditions=react-server scripts/verify-novo-contrato-config.mjs` confirmou os grupos 11/7/13, os dois mapeamentos ativos, campo bruto editável/obrigatório e status com `Aguardando pagamento` somente leitura.

**Pendente:** smoke visual do card e do editor no ambiente com a versão do aplicativo atualizada; o script de verificação confirmou metadados, sem gerar card de cliente para teste.

## Impacto e riscos

O formulário pode mudar durante o uso por pessoas que já estão com um card aberto; elas devem recarregar antes de salvar. A nova opção de Status financeiro é compartilhada onde o campo é usado. Uma falha da transação reverte suas alterações. Se a configuração publicada divergir do plano ou uma opção/campo estiver indisponível, o avanço poderá ser bloqueado até correção. O cálculo e os dados de pagamento dependem das informações conferidas pela equipe; o sistema não decide automaticamente incidência ou alíquotas tributárias.

## Alternativa e reversão

A alternativa sem mutação é manter a configuração atual e usar somente o plano de leitura. Para reverter após publicação, restaurar os metadados afetados a partir do snapshot privado da configuração em uma transação, após novo checkpoint Vault, preservando cards criados depois. O dump completo verificado é a última opção de recuperação; sua restauração integral descartaria alterações ocorridas após o instante do backup e exigiria janela coordenada. Não executar restauração automaticamente.

## Qualidade local

No índice isolado para commit: `npm run lint`: zero erros (1.192 avisos); `npm run typecheck`: passou; `npm test`: 510 arquivos, 3.828 testes passaram, 4 ignorados e 1 pendente; `npm run build`: passou. O build registra avisos do `pdfjs-polyfill`.
