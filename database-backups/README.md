# Backups do PainelAlpha

Esta pasta guarda backups locais do banco remoto do PainelAlpha. Dumps, snapshots, manifests com dados e qualquer arquivo de backup são confidenciais e ficam fora do Git.

## Estrutura operacional

- `daily/`: backup completo automático todos os dias às 02:00 no fuso `America/Sao_Paulo`.
- `pre-change/`: backup completo criado ou selecionado antes de uma alteração estrutural, migration, backfill ou mutação em massa.

## Regras

- Um backup usado para liberar alteração deve ser anterior à operação, estar verificado e ter no máximo 48 horas.
- A limpeza automática remove somente arquivos de `daily/` com mais de 30 dias e apenas depois de um novo backup diário ser criado e validado.
- A limpeza automática nunca remove `pre-change/`.
- Uma falha de backup não autoriza alteração no banco e não autoriza apagar backups existentes.
- Nunca registrar tokens, URLs com credenciais ou conteúdo de linhas do banco em logs.

As pastas `daily/` e `pre-change/` podem ser criadas automaticamente pela rotina de backup quando necessário.
