# Revisão — Proteção contra autofill na Gestão da Equipe

## Execução automática

- Escopo solicitado: alterações não commitadas.
- Resultado: CodeRabbit indisponível porque o WSL não está instalado neste ambiente.
- Instalação não executada, pois alteraria a infraestrutura da máquina sem solicitação do usuário.

## Fallback manual

| Severidade | Quantidade | Status |
|---|---:|---|
| CRITICAL | 0 | Aprovado |
| HIGH | 0 | Aprovado |
| MEDIUM | 0 | Aprovado |
| LOW | 0 | Aprovado |

### Pontos revisados

- O token permanece vazio no cliente e bloqueado até ação explícita do administrador.
- O payload não inclui `token_onyx` quando a edição não foi ativada, mesmo que algum gerenciador injete valor no estado.
- Cancelar, remover, salvar e recarregar limpam o estado temporário do token.
- A política de autofill cobre criação, edição, selects, observações, senha e campos auxiliares.
- Não há logs, exposição de token, alteração de schema ou nova dependência.

**Decisão:** PASS (revisão manual; automatização pendente em ambiente com WSL/CodeRabbit).
