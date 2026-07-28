# CodeRabbit Review — Instagram Studio iframe download

**Data:** 2026-07-28
**Escopo:** alterações não commitadas da story `STORY-MARKETING-INSTAGRAM-STUDIO-DOWNLOAD`
**Decisão:** PASS com revisão manual substitutiva

## Execução automatizada

O CodeRabbit CLI não pôde ser iniciado porque o Windows Subsystem for Linux
(WSL), pré-requisito do wrapper do projeto, não está instalado nesta máquina.

Comando tentado:

```text
wsl -l -q
```

Resultado: `O Subsistema do Windows para Linux não está instalado.`

## Revisão manual do diff

| Severidade | Quantidade | Status |
|---|---:|---|
| CRITICAL | 0 | Aprovado |
| HIGH | 0 | Aprovado |
| MEDIUM | 0 | Aprovado |
| LOW | 0 | Aprovado |

Verificações:

- O atributo `sandbox` foi preservado.
- `allow-same-origin`, `allow-scripts` e `allow-forms` foram preservados.
- Somente `allow-downloads` e `allow-top-navigation-by-user-activation` foram adicionados.
- `allow-top-navigation` irrestrito não foi adicionado.
- Nenhum arquivo de autenticação, autorização, permissões ou do iframe global foi alterado.
- O teste focado passou e o build Next.js compilou com sucesso.
