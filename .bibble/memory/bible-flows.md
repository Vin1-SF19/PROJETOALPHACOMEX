# BIBBLE FLOWS — Tool Catalog e Fluxos do Assistente

> Mantido por: Cortex (AI engine) e Sync (UX da conversa)
> Define quais actions Bibble pode executar no painel.

---

## Tool Catalog

### buscar_cliente
- **Descrição:** Busca um cliente por nome, CPF ou ID
- **Parâmetros:** `query: string`
- **Output:** Lista de até 5 clientes (id, nome, cpf)
- **Ownership:** Filtra por `userId` obrigatoriamente

### abrir_relatorio
- **Descrição:** Navega para um relatório específico
- **Parâmetros:** `tipo: 'extratos' | 'comercial' | 'estoque'`, `periodo?: string`
- **Output:** `{ action: 'navigate', path: string }`

<!-- Adicionar novas tools aqui conforme o painel cresce -->

---

## Fluxos de Conversa

### Busca de cliente
1. Usuário menciona nome ou CPF
2. Bibble chama `buscar_cliente`
3. Apresenta resultados com cards clicáveis
4. Usuário seleciona → Bibble navega ou executa ação

### Abertura de relatório
1. Usuário pede "extrato de março"
2. Bibble interpreta período → chama `abrir_relatorio`
3. Frontend recebe `action: navigate` e executa

---

## Limites e Recusas

- Bibble NÃO acessa dados de outros usuários
- Bibble NÃO executa DELETE sem confirmação explícita
- Bibble NÃO revela dados sensíveis (senhas, tokens)
- Bibble NÃO responde sobre tópicos fora do painel sem avisar o escopo
