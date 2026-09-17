# Revisão — CS & NPS: alertas sem CS e acesso Admin/RH

**Data:** 2026-09-17
**Escopo:** alterações não commitadas da story `STORY-CS-NPS-ALERTAS-SEM-CS-ADMIN-RH`

## CodeRabbit

O executável `~/.local/bin/coderabbit` não está instalado neste ambiente Linux. A revisão automatizada foi ignorada conforme a política de degradação graciosa do projeto.

## Revisão manual substituta

| Severidade | Quantidade | Situação |
|---|---:|---|
| CRITICAL | 0 | Nenhum bloqueio encontrado |
| HIGH | 0 | Nenhum achado |
| MEDIUM | 0 | Nenhum achado |
| LOW | 0 | Nenhum achado |

Pontos revisados:

- autorização usa ID autenticado e role/status atuais persistidos;
- Admin, TI e Recursos Humanos são permitidos sem incluir CEO ou Administrativo;
- serviços sem CS são derivados sem persistência adicional e sem alteração de schema;
- campos de data permanecem nulos em `SEM_CS` e não são formatados pela UI;
- a assinatura da fila diferencia tipo e evita tratar o primeiro CS como a mesma notificação;
- consulta, salvamento rápido, reconciliação e fluxo de CS vencido foram preservados;
- `git diff --check`, ESLint focado, 40 testes focados e build de produção foram aprovados.

**Decisão:** PASS manual; CodeRabbit indisponível no ambiente.
