# Prompt: Remover Hardcoded do Pipeline Financeiro e Tornar Fluxo Configurável

**Tipo:** Task Prompt  
**Gerado por:** Phantom (Bibble Squad)  
**Data:** 2026-09-26  
**Pedido original:** "Gere um prompt para eu colar na minha IA para resolver todos esses problemas, nesse prompt tem que estar tudo especificado para não ter divergências — foco absoluto remover os Hardcoded"  
**Uso:** Colar em uma IA de implementação (Codex, Claude Code, etc.) para executar a refatoração completa do pipeline Financeiro no Painel Alpha.  
**Modelo recomendado:** Codex-sonnet-4-6 / Claude Opus / qualquer modelo com acesso a filesystem e terminal.

---

## 1. Contexto do Projeto

Você está trabalhando no repositório:

```
/home/ialpha/projetos/alpha-comex/painel-alpha
```

Stack:

- Next.js (App Router)
- TypeScript
- Prisma + SQLite/Turso
- Tailwind CSS
- Módulos de CRM/BPM em `src/app/PainelAlpha/AlphaCRM` e `src/lib/bpm`

O sistema possui um pipeline chamado **Financeiro** com as seguintes etapas:

1. Novo Contrato
2. Elaboração de Contrato
3. Formalização
4. Confirmação de Pagamento
5. Emissão de Nota Fiscal
6. Concluído

Hoje, o comportamento do pipeline Financeiro depende de **hardcoded** no código:

- Chave do pipeline: `"financeiro"`
- Chaves de etapas: `"solicitacao_contrato"`, `"elaboracao_contrato"`, `"formalizacao_contratacao"`, `"confirmacao_pagamento"`, `"emissao_nota_fiscal"`, `"contratacao_finalizada"`
- Chaves de campos: `alpha.financeiro.status.contrato.assinatura`, `alpha.data.da.assinatura`, `alpha.contrato.assinado.anexo`, `alpha.pagamento.confirmado`, `alpha.status.do.contrato`, `alpha.financeiro.prazo.assinatura`, `alpha.nf.emitida`, `alpha.data.de.emissao`, `alpha.numero.da.nf`, `alpha.arquivo.link.da.nf`, `alpha.cnpj`
- Valores de status: `"Assinado"`, `"Sim"`, `"Pendente"`, `"Concluído"`
- Automações: `financeiro.handoff.contrato.concluido.operacional`, `fechamento_comercial`, `avanco_nota_fiscal`
- Tipos de tarefa: `ASSINATURA_CONTRATO`, `EMISSAO_NF`

O objetivo é **remover todo hardcoded** e fazer o sistema ler essas configurações do banco de dados, permitindo que a UI gerencie pipeline, etapas, campos, requisitos e automações.

---

## 2. Role

Você é um engenheiro sênior full-stack especializado em Next.js, Prisma, TypeScript e sistemas de CRM/BPM. Sua missão é executar uma refatoração completa para eliminar dependências hardcoded do pipeline Financeiro e tornar o comportamento do pipeline totalmente configurável via banco de dados e UI.

Você trabalha de forma autônoma, mas deve:

- Ler e entender o código antes de modificar.
- Preservar o comportamento funcional atual.
- Não introduzir regressões.
- Rodar lint, typecheck e testes após as mudanças.
- Reportar exatamente o que foi feito, o que mudou e quais validações foram executadas.

---

## 3. O que você FAZ

- Auditoria completa de todas as referências hardcoded do pipeline Financeiro.
- Criação de seed/migração para popular `BpmPipeline`, `BpmEtapa`, `BpmCampo`, `BpmCampoEtapaConfig`, `BpmCampoObrigatorioEtapa`, `BpmRequisito` e `BpmAutomacao`.
- Refatoração do código para substituir comparações literais por leitura de configuração.
- Atualização de testes que dependem de valores hardcoded.
- Validação do fluxo completo do pipeline Financeiro.
- Relatório final com evidências.

## 4. O que você NÃO FAZ

- NÃO inventa requisitos fora do escopo.
- NÃO remove funcionalidades existentes.
- NÃO altera a estrutura do banco sem backup e confirmação.
- NÃO deixa o sistema em estado quebrado.
- NÃO entrega código sem rodar `npm run lint`, `npm run typecheck` e `npm test`.

---

## 5. Instruções Principais

### 5.1. Fase 1 — Auditoria

Antes de qualquer modificação, execute uma auditoria completa e liste:

1. Todos os arquivos que contêm a string `"financeiro"` relacionada a pipeline.
2. Todos os arquivos que contêm as chaves de etapa do Financeiro.
3. Todos os arquivos que contêm as chaves de campo do Financeiro.
4. Todos os arquivos que usam os valores `"Assinado"`, `"Sim"`, `"Pendente"`, `"Concluído"` no contexto do Financeiro.
5. Todos os arquivos que referenciam as automações `financeiro.handoff.contrato.concluido.operacional`, `fechamento_comercial`, `avanco_nota_fiscal`.
6. Todos os arquivos que referenciam os tipos de tarefa `ASSINATURA_CONTRATO` e `EMISSAO_NF`.

Para cada item, registre:

- Arquivo
- Linha
- Trecho de código
- Tipo de hardcoded (pipeline, etapa, campo, valor, automação, tarefa)
- Ação necessária (substituir por leitura de banco, migrar para seed, remover)

Salve essa auditoria em:

```
.bibble/memory/auditoria-hardcoded-financeiro-2026-09-26.md
```

### 5.2. Fase 2 — Seed/Migração do Banco

Crie um script de seed idempotente em:

```
scripts/seed-financeiro-config.mts
```

Esse script deve:

1. Localizar o pipeline `Financeiro` por nome.
2. Se `BpmPipeline.chave` estiver nula, definir `chave = "financeiro"`.
3. Localizar as etapas do pipeline por nome e definir as chaves estáveis:

| Nome da Etapa | Chave Estável |
|---|---|
| Novo Contrato | `solicitacao_contrato` |
| Elaboração de Contrato | `elaboracao_contrato` |
| Formalização | `formalizacao_contratacao` |
| Confirmação de Pagamento | `confirmacao_pagamento` |
| Emissão de Nota Fiscal | `emissao_nota_fiscal` |
| Concluído | `contratacao_finalizada` |

4. Criar/actualizar os seguintes campos em `BpmCampo` (idempotente por `chave`):

| Chave do Campo | Nome | Tipo |
|---|---|---|
| `alpha.cnpj` | CNPJ | `text` |
| `alpha.financeiro.status.contrato.assinatura` | Status da assinatura | `select` |
| `alpha.data.da.assinatura` | Data da assinatura | `date` |
| `alpha.contrato.assinado.anexo` | Contrato assinado (anexo) | `file` |
| `alpha.pagamento.confirmado` | Pagamento confirmado | `select` |
| `alpha.status.do.contrato` | Status do contrato | `select` |
| `alpha.financeiro.prazo.assinatura` | Prazo de assinatura | `date` |
| `alpha.nf.emitida` | NF emitida | `select` |
| `alpha.data.de.emissao` | Data de emissão da NF | `date` |
| `alpha.numero.da.nf` | Número da NF | `text` |
| `alpha.arquivo.link.da.nf` | Link da NF | `text` |
| `alpha.financeiro.valor.liquido.pagamento` | Valor líquido | `number` |

5. Criar `BpmCampoEtapaConfig` para associar os campos às etapas corretas.
6. Criar `BpmCampoObrigatorioEtapa` para os campos obrigatórios em cada etapa.
7. Criar `BpmRequisito` para as regras de formalização:
   - `alpha.financeiro.status.contrato.assinatura` deve ser `"Assinado"`
   - `alpha.pagamento.confirmado` deve ser `"Sim"`
   - `alpha.contrato.assinado.anexo` deve ter anexo
8. Criar `BpmAutomacao` para:
   - `financeiro.handoff.contrato.concluido.operacional`
   - `fechamento_comercial`
   - `avanco_nota_fiscal`
9. Criar/associar tarefas de tipo `ASSINATURA_CONTRATO` e `EMISSAO_NF` quando aplicável.

**Requisitos do seed:**

- Idempotente: pode rodar múltiplas vezes sem duplicar.
- Usa `upsert` ou `create` com `skipDuplicates` quando possível.
- Não apaga dados existentes.
- Loga cada ação executada.
- Retorna resumo final com contagem de registros criados/atualizados.

### 5.3. Fase 3 — Refatoração do Código

Substitua todas as referências hardcoded encontradas na auditoria por leitura de configuração.

#### 3.1. Pipeline / Etapas

- Substituir `card.pipeline.chave === "financeiro"` por uma função que verifica se o pipeline tem a chave `financeiro` (lida do banco) ou se é o pipeline Financeiro configurado.
- Substituir `card.etapa.chave === "solicitacao_contrato"` e `"contratacao_finalizada"` por leitura de `BpmEtapa.chave`.
- Substituir `NOME_PIPELINE_FINANCEIRO = "Financeiro"` por leitura de `BpmPipeline.nome`.
- Substituir `NOME_ETAPA_NOTA_FISCAL = "Nota Fiscal"` por leitura de `BpmEtapa.nome`.

#### 3.2. Campos

- Substituir todas as ocorrências de `alpha.financeiro.status.contrato.assinatura`, `alpha.data.da.assinatura`, `alpha.contrato.assinado.anexo`, `alpha.pagamento.confirmado`, `alpha.status.do.contrato`, `alpha.financeiro.prazo.assinatura`, `alpha.nf.emitida`, `alpha.data.de.emissao`, `alpha.numero.da.nf`, `alpha.arquivo.link.da.nf`, `alpha.cnpj` por constantes importadas de um único módulo de configuração ou por leitura de `BpmCampo`.
- Criar um módulo central `src/lib/bpm/financeiro-config.ts` que exporta as chaves canônicas lidas do banco (com fallback para as chaves atuais durante a transição).
- Garantir que todos os arquivos importem desse módulo central, nunca de strings literais.

#### 3.3. Valores

- Substituir `"Assinado"`, `"Sim"`, `"Pendente"`, `"Concluído"` por constantes de configuração ou por leitura de `BpmRequisito`.
- As regras de formalização em `financeiro-formalizacao.ts` devem ser movidas para `BpmRequisito` e lidas dinamicamente.

#### 3.4. Automações

- Substituir `CHAVE_AUTOMACAO = "financeiro.handoff.contrato.concluido.operacional"` por leitura de `BpmAutomacao.chave`.
- Substituir `fechamento_comercial` e `avanco_nota_fiscal` por leitura de `BpmAutomacao.chave`.
- O runtime de automações em `central-runtime.ts` deve buscar as automações pelo pipeline/etapa, não por chaves literais.

#### 3.5. Tarefas

- Substituir `tipo: "ASSINATURA_CONTRATO"` e `tipo: "EMISSAO_NF"` por leitura de configuração ou por constantes centralizadas.

### 5.4. Fase 4 — UI de Configuração

Implementar ou ajustar a UI para permitir:

1. Visualizar as etapas do pipeline Financeiro.
2. Editar os campos de cada etapa.
3. Definir quais campos são obrigatórios.
4. Configurar requisitos de transição.
5. Criar/editar automações do pipeline.

A UI deve:

- Usar as mesmas entidades `Bpm*` do banco.
- Não conter hardcoded de chaves de campo ou etapa.
- Validar que as chaves são únicas e canônicas.
- Exibir erro claro se tentar criar campo/etapa com chave duplicada.

### 5.5. Fase 5 — Testes e Validação

1. Atualizar todos os testes que dependem de valores hardcoded.
2. Criar testes de integração para o fluxo completo do Financeiro:
   - Novo Contrato → Elaboração → Formalização → Confirmação de Pagamento → Emissão de NF → Concluído
   - Handoff Financeiro → Operacional
   - Automação de lembrete de assinatura
   - Automação de emissão de NF
3. Rodar:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
4. Se houver falhas, corrigir e rodar novamente até passar.

---

## 6. Formato de Saída

Ao final da execução, entregue um relatório em markdown com:

```markdown
# Relatório — Remoção de Hardcoded do Financeiro

## Resumo
[3-5 linhas descrevendo o que foi feito]

## Auditoria
[Lista de arquivos e linhas modificados]

## Seed/Migração
[Comandos executados e resultado]

## Refatoração
[Arquivos alterados e o que mudou em cada um]

## UI
[O que foi implementado/ajustado]

## Testes
[Comandos executados e resultado]

## Validações
[Checklist de validações executadas]

## Riscos Restantes
[Se houver]

## Próximos Passos
[Recomendações]
```

---

## 7. Exemplos

### Exemplo 1 — Substituição de chave de pipeline

**Antes:**
```typescript
if (card.pipeline.chave === "financeiro") {
  // ...
}
```

**Depois:**
```typescript
import { isFinanceiroPipeline } from "@/lib/bpm/financeiro-config";

if (isFinanceiroPipeline(card.pipeline)) {
  // ...
}
```

Onde `financeiro-config.ts` exporta:
```typescript
export const PIPELINE_CHAVE_FINANCEIRO = "financeiro";

export function isFinanceiroPipeline(pipeline: { chave: string | null }): boolean {
  return pipeline.chave === PIPELINE_CHAVE_FINANCEIRO;
}
```

---

### Exemplo 2 — Substituição de chave de campo

**Antes:**
```typescript
const statusAssinatura = valores.get("alpha.financeiro.status.contrato.assinatura");
```

**Depois:**
```typescript
import { CAMPOS_FINANCEIRO } from "@/lib/bpm/financeiro-config";

const statusAssinatura = valores.get(CAMPOS_FINANCEIRO.STATUS_ASSINATURA);
```

Onde `financeiro-config.ts` exporta:
```typescript
export const CAMPOS_FINANCEIRO = {
  STATUS_ASSINATURA: "alpha.financeiro.status.contrato.assinatura",
  DATA_ASSINATURA: "alpha.data.da.assinatura",
  CONTRATO_ASSINADO_ANEXO: "alpha.contrato.assinado.anexo",
  PAGAMENTO_CONFIRMADO: "alpha.pagamento.confirmado",
  STATUS_CONTRATO: "alpha.status.do.contrato",
  PRAZO_ASSINATURA: "alpha.financeiro.prazo.assinatura",
  NF_EMITIDA: "alpha.nf.emitida",
  DATA_EMISSAO_NF: "alpha.data.de.emissao",
  NUMERO_NF: "alpha.numero.da.nf",
  LINK_NF: "alpha.arquivo.link.da.nf",
  CNPJ: "alpha.cnpj",
} as const;
```

---

### Exemplo 3 — Substituição de valor de status

**Antes:**
```typescript
const assinaturaConfirmada = entrada.statusAssinatura === "Assinado";
```

**Depois:**
```typescript
import { VALORES_FINANCEIRO } from "@/lib/bpm/financeiro-config";

const assinaturaConfirmada = entrada.statusAssinatura === VALORES_FINANCEIRO.ASSINADO;
```

Onde `financeiro-config.ts` exporta:
```typescript
export const VALORES_FINANCEIRO = {
  ASSINADO: "Assinado",
  SIM: "Sim",
  PENDENTE: "Pendente",
  CONCLUIDO: "Concluído",
} as const;
```

---

## 8. Anti-exemplos

### ❌ Anti-exemplo 1 — Deixar hardcoded em múltiplos lugares

**Situação:** Substituir `"financeiro"` em alguns arquivos, mas deixar em outros.

**Por que está errado:** Cria inconsistência e mantém a dependência de hardcoded.

**Correção:** Substituir TODAS as ocorrências encontradas na auditoria.

---

### ❌ Anti-exemplo 2 — Criar constantes espalhadas

**Situação:** Criar `const PIPELINE_FINANCEIRO = "financeiro"` em cada arquivo.

**Por que está errado:** Duplica a fonte de verdade e dificulta manutenção.

**Correção:** Criar UM módulo central `financeiro-config.ts` e importar de todos os lugares.

---

### ❌ Anti-exemplo 3 — Não atualizar testes

**Situação:** Refatorar o código, mas deixar testes quebrados.

**Por que está errado:** Entregada em estado quebrado.

**Correção:** Atualizar todos os testes e rodar `npm test` até passar.

---

## 9. Regras Absolutas

- **NUNCA** deixe uma string literal `"financeiro"` no código após a refatoração.
- **NUNCA** deixe uma chave de campo hardcoded (`alpha.financeiro.*`, `alpha.contrato.assinado.anexo`, etc.) no código.
- **NUNCA** deixe um valor de status hardcoded (`"Assinado"`, `"Sim"`, `"Pendente"`, `"Concluído"`) no código sem referência a uma constante centralizada.
- **NUNCA** entregue sem rodar `npm run lint`, `npm run typecheck` e `npm test`.
- **SEMPRE** crie o seed idempotente antes de refatorar o código.
- **SEMPRE** preserve o comportamento funcional atual.
- **SEMPRE** reporte o que foi feito com evidências.

---

## 10. Edge Cases

| Situação | Comportamento esperado |
|---|---|
| Pipeline Financeiro não existe no banco | Criar seed que cria o pipeline e etapas |
| Etapa já tem chave diferente | Atualizar para a chave canônica |
| Campo já existe com chave diferente | Atualizar para a chave canônica |
| Campo já existe com chave correta | Não duplicar |
| Requisito já existe | Não duplicar |
| Automação já existe | Não duplicar |
| Teste depende de valor hardcoded | Atualizar teste para usar constante |
| UI não expõe configuração | Implementar UI mínima para gerenciar |

---

## 11. Checklist de Qualidade

- [ ] Auditoria completa salva em `.bibble/memory/auditoria-hardcoded-financeiro-2026-09-26.md`
- [ ] Seed idempotente criado em `scripts/seed-financeiro-config.mts`
- [ ] Seed executado com sucesso
- [ ] Módulo central `src/lib/bpm/financeiro-config.ts` criado
- [ ] Todas as referências hardcoded substituídas
- [ ] UI de configuração implementada/ajustada
- [ ] Testes atualizados
- [ ] `npm run lint` passou
- [ ] `npm run typecheck` passou
- [ ] `npm test` passou
- [ ] Relatório final entregue

---

## 12. Como Usar

**Onde colar:** Em uma IA de implementação com acesso ao repositório.

**Pré-requisitos:**
- Acesso ao repositório `/home/ialpha/projetos/alpha-comex/painel-alpha`
- Acesso ao banco de dados (Turso/SQLite)
- Permissão para rodar `npm run lint`, `npm run typecheck`, `npm test`

**Variáveis a substituir:** Nenhuma.

**Teste recomendado:**
Após a execução, verificar que:
1. O pipeline Financeiro tem `chave = "financeiro"` no banco.
2. As etapas têm as chaves canônicas.
3. Os campos existem em `BpmCampo`.
4. Os requisitos existem em `BpmRequisito`.
5. As automações existem em `BpmAutomacao`.
6. O código não contém mais strings literais `"financeiro"`, `"Assinado"`, `"Sim"`, etc.
7. O fluxo completo do Financeiro funciona de ponta a ponta.
