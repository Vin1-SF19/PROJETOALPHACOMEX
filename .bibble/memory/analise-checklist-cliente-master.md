# ANÁLISE — Módulo Checklist Operacional × Cliente Master

> Status: **ANÁLISE, NÃO É PLANO DE EXECUÇÃO.** Complementa (não substitui) `.bibble/memory/plano-cliente-master.md`. Nenhum código alterado. Este documento existe para você decidir SE e COMO estender o plano do Cliente Master para cobrir o módulo Checklist por completo.

**Origem:** pedido do usuário em 2026-08-11 — análise do banco do módulo Checklist + módulo Clientes, para avaliar fusão com o Cliente Master do CRM/BPM.

---

## 1. Achado principal: o plano do Cliente Master já toca o Checklist, mas só pela metade

Antes de propor qualquer coisa nova, um fato precisa ficar claro: **`plano-cliente-master.md` já decidiu o destino de `OperacionalClientes`** (seção "Tabelas auxiliares por módulo", linha "Operacional") — não é greenfield. O que falta é o resto do módulo.

| Já coberto pelo plano existente | NÃO coberto (este documento) |
|---|---|
| `OperacionalClientes` — vira tabela auxiliar de `Cliente`, perde campos cadastrais (razaoSocial/nomeFantasia/cnpj/dados fiscais), ganha `clienteId → Cliente` | `ClienteOperacional` (login do portal) |
| | `NotificacaoCliente` |
| | `PastaChecklist` |
| | `DocumentoUnidade` (órfã — ver seção 4) |
| | `Checklist` |
| | `ModeloItemChecklist` |
| | `ItemChecklist` |
| | `DocumentoChecklist` |

Ou seja: o plano existente resolve "quem é essa empresa" para o Checklist (mesmo unificador que resolve para CS&NPS/Metas/BPM/Comissões/Parceiros), mas **não toca em nada da estrutura interna do checklist em si** — itens, documentos, catálogo de modelos, login do cliente, notificações. Essas 8 tabelas continuam existindo exatamente como estão, só que penduradas num `OperacionalClientes` que agora aponta para `Cliente` em vez de repetir CNPJ.

**Isso é bom ou ruim para "fundir com o Cliente Master"?** Depende do que você quer dizer com "fundir":
- Se o objetivo é **"toda empresa do sistema é a mesma linha, não importa o módulo"** — o plano já cumpre isso, e este documento só precisa confirmar/ajustar 1 decisão pendente (ver seção 3).
- Se o objetivo é **"o checklist em si (itens, documentos, progresso) devia ser genérico e reaproveitável por outros módulos, não só o Operacional"** — isso é uma extensão bem maior, não coberta ainda, tratada na seção 5.

---

## 2. Mapa completo das 9 tabelas do módulo Checklist (schema real)

```prisma
model ClienteOperacional {          // LOGIN — autenticação do portal do cliente, separada de `usuarios`
  id, nome, email @unique, senha, imagemUrl
  empresas OperacionalClientes[], documentos DocumentoUnidade[], notificacoes NotificacaoCliente[]
}

model OperacionalClientes {          // EMPRESA do checklist — cadastro paralelo a `clientes` (CS&NPS)
  id, status, embasamento, razaoSocial, nomeFantasia, cnpj @unique, progresso, mesProtocolo, linkGrupo
  situacaoRadar, submodalidade, dataSituacao, municipio, uf, regimeTributario, capitalSocial,
  dataConstituicao, contribuinte, tipo (TipoEmbasamento?)
  clienteId → ClienteOperacional, pastaChecklistId? → PastaChecklist
  documentos DocumentoUnidade[], checklists Checklist[]
}

model NotificacaoCliente { id, clienteId → ClienteOperacional, tipo, titulo, mensagem?, empresaId, itemId?, lida, criadaEm }

model PastaChecklist { id, nome @unique, empresas OperacionalClientes[] }

model DocumentoUnidade {             // ÓRFÃ DE CÓDIGO — ver seção 4
  id, codigoDocumento, nomeArquivo, urlBlob, status, observacao
  empresaId → OperacionalClientes, clienteId → ClienteOperacional
}

model Checklist { id, empresaId → OperacionalClientes, tipo (TipoEmbasamento), itens ItemChecklist[]
  @@unique([empresaId, tipo]) }      // 1 checklist por empresa+tipo de embasamento

model ModeloItemChecklist { id, tipo? (null = global), codigo, nome, descricao?, secao, obrigatorio }  // catálogo

model ItemChecklist { id, checklistId → Checklist, modeloItemId?, codigo, secao, descricao, complemento?,
  status (StatusItemChecklist), observacao?, obrigatorio, documentos DocumentoChecklist[] }

model DocumentoChecklist { id, itemId → ItemChecklist, nome, url, uploadedByCliente, observacao?,
  deletadoEm?, deletadoPorCliente }  // soft-delete real
```

**Escala real (Fase 1 do plano Cliente Master já mediu):** só **4 empresas** cadastradas em `OperacionalClientes` hoje. Módulo pequeno em volume de dado, mas com superfície de código relevante (`checklist.ts` tem 610 linhas — é a 2ª maior action file do módulo, atrás só de `Cards.ts` do BPM).

---

## 3. Decisão pendente — RESPONDIDA (2026-08-11): `OperacionalClientes.clienteId` obrigatório, SEM criação automática

**Resposta do usuário, textual:** *"Tecnicamente todo cliente cadastrado na tabela cliente master já devem ter um cadastro no checklist, pois o primeiro cadastro do cliente sempre será no CRM (BPM) que utiliza a tabela Cliente Master como fonte da verdade."*

Isto é mais que uma resposta pontual sobre o Checklist — **é um princípio de arquitetura que se aplica ao plano geral inteiro, não só a este módulo:**

> **O BPM/CRM é a ÚNICA porta de entrada de um `Cliente` novo no sistema.** Nenhum outro módulo satélite (Checklist, Extratos, Pré-Análise, Radar, Metas, Comissões) cria um `Cliente` — todos eles só **referenciam** um `Cliente` que o BPM já criou. Se um módulo satélite não encontra o `Cliente` pelo CNPJ, isso é tratado como **erro de processo** (a empresa deveria ter entrado pelo BPM primeiro), não como um caso normal a resolver criando um registro novo silenciosamente.

**Implicação direta para `OperacionalClientes.clienteId`:** obrigatório, **mas `vincularEmpresaAoCliente` NUNCA cria um `Cliente` novo** — só busca por CNPJ normalizado e, se não encontrar, **bloqueia o cadastro com uma mensagem clara** ("Esta empresa ainda não está cadastrada no CRM — cadastre-a primeiro no Alpha CRM antes de vinculá-la ao Checklist"), nunca cria por conta própria.

**⚠️ Contradição real a resolver antes da Fase de execução:** o `plano-cliente-master.md` (seção "Decisões", pergunta 5) já registrou o OPOSTO para Metas — `ContratoComercial.clienteId` obrigatório **com criação automática** ("`criarContrato` resolve/cria `Cliente` já na criação do contrato"). Se o princípio "só o BPM cria Cliente" for adotado como regra geral (o que a resposta desta sessão sugere fortemente), **essa decisão de Metas precisa ser revisitada** — hoje ela contradiz o que você acabou de estabelecer aqui. Duas leituras possíveis, e preciso que você escolha:
  - **(a) O princípio vale para TODOS os módulos, inclusive Metas** — a decisão antiga de Metas ("cria automaticamente") precisa ser corrigida no plano geral para "só vincula, nunca cria", alinhando com o Checklist.
  - **(b) Metas é uma exceção deliberada** — porque Metas é o único módulo que também pode ser, na prática, uma origem legítima de cliente novo (um lead comercial que fecha contrato sem nunca ter passado pelo BPM/CRM antes), diferente do Checklist (que só faz sentido para uma empresa que já é cliente confirmado).

**Volume real — lista levantada em 2026-08-12 (Vault aprovou leitura pura):** com "só vincula, nunca cria", estes 3 dos 4 registros existentes em `OperacionalClientes` ficam sem `Cliente` correspondente até serem cadastrados no BPM:

| CNPJ | Razão Social | Status |
|---|---|---|
| 01957839000185 | ADICEL - INDUSTRIA E COMERCIO LTDA | ATIVO |
| 44342670000161 | ALPHA COMEX BRASIL LTDA | ATIVO |
| 42591651000143 | ARCOS DOURADOS COMERCIO DE ALIMENTOS SA | ATIVO |

**Nota:** "ALPHA COMEX BRASIL LTDA" é provavelmente a própria empresa dona do painel (uso interno/teste) — vale confirmar antes de decidir se esse registro precisa mesmo de um `Cliente` real ou se é candidato a exclusão/dado de teste, ao contrário dos outros 2 que parecem clientes reais do Checklist.

**Sem sobreposição com Metas** — nenhum destes 3 CNPJs coincide com os 17 órfãos de `contratos_comerciais` (ver `plano-cliente-master.md`). Precisam ser cadastrados manualmente no BPM antes do backfill, mesma mecânica de Metas.

---

## 4. `DocumentoUnidade` — RESPONDIDO (2026-08-11): manter no schema

Confirmado por grep exaustivo em `src/`: **nenhum arquivo lê ou escreve `db.documentoUnidade`**. O model existe no schema, com FKs reais para `OperacionalClientes` e `ClienteOperacional`, mas não há nenhuma Server Action, rota ou componente que o use. `DocumentoChecklist` (o model realmente usado para documentos, vinculado a `ItemChecklist`) parece ter suplantado a intenção original de `DocumentoUnidade` (talvez pensado para documentos "gerais" da empresa, fora de um item específico do checklist).

**Decisão do usuário: manter — "utilizaremos no futuro".** Não remover do schema. `DocumentoUnidade` continua com `empresaId → OperacionalClientes` (que, após a fusão, aponta indiretamente para `Cliente` via `OperacionalClientes.clienteId`) — nenhuma mudança de FK necessária aqui, já que `OperacionalClientes` continua existindo como tabela auxiliar. Nenhuma ação na Fase de execução além de garantir que a migration de `OperacionalClientes` não quebre essa FK por engano.

**Não é bloqueante para a fusão**, mas é um dado relevante: ao desenhar o schema final, `DocumentoUnidade` pode simplesmente ser **removida** (nunca teve uso real) em vez de migrada — evita carregar uma tabela morta para dentro da arquitetura nova. Decisão a confirmar com você antes de qualquer execução (mesma cautela do projeto: nunca remover sem confirmar que é seguro).

---

## 5. A pergunta maior, não resolvida pelo plano atual: o Checklist deveria ser genérico?

Isto é a leitura mais ambiciosa do seu pedido, e vale nomear explicitamente mesmo que a resposta certa seja "não, por enquanto".

Hoje, `Checklist`/`ItemChecklist`/`ModeloItemChecklist`/`DocumentoChecklist` são **específicos do módulo Operacional** — `Checklist.empresaId` aponta só para `OperacionalClientes`, nunca para `Cliente` diretamente, nunca para um `BpmCard`. Se a intenção da "fusão" for fazer o checklist virar um recurso **reaproveitável por qualquer módulo** (ex: um card do BPM também ter itens de checklist, ou o CS&NPS ter checklist de onboarding), isso é uma generalização de arquitetura bem maior que só trocar a FK de empresa — significaria:

1. `Checklist.empresaId → OperacionalClientes` precisaria virar `Checklist.clienteId → Cliente` (ou até `Checklist.contextoTipo/contextoId` genérico, no espírito do `NoteContext` do Sistema de Notas — mesmo padrão de "contexto polimórfico" já usado no projeto).
2. `TipoEmbasamento` (enum fixo: RECEITA_BRUTA_DAS, RECEITA_BRUTA_CPRB, INICIO_RETOMADA, DISPONIBILIDADE_FINANCEIRA) é um conceito **específico do domínio fiscal/RADAR** — não faz sentido genérico fora desse contexto. Um checklist genérico precisaria de um `tipo: String` livre ou um catálogo configurável por módulo, não um enum fixo de 4 valores fiscais.
3. `ModeloItemChecklist` (catálogo de itens por tipo) teria que ganhar uma dimensão de "para qual módulo" — hoje é implicitamente só para embasamentos fiscais.

**Recomendação do Bibble: não generalizar agora.** Não há nenhum sinal no código ou no seu pedido de que outro módulo precisa de checklist — isso seria construir abstração especulativa sem caso de uso real (contraria o princípio já seguido no projeto: "três linhas parecidas é melhor que abstração prematura"). A leitura mais provável do seu pedido é a mais simples: **unificar o cadastro de empresa** (que o plano já cobre) — mas registrei essa leitura maior aqui para você descartar explicitamente, não por engano de escopo meu.

---

## 6. Proposta de extensão ao plano existente (schema)

Assumindo a leitura mais provável (unificar cadastro de empresa, manter o checklist específico do módulo), a extensão ao `plano-cliente-master.md` seria pequena — **nenhuma tabela nova, nenhuma mudança estrutural em `Checklist`/`ItemChecklist`/`DocumentoChecklist`**, só reforçar o que a seção "Tabelas auxiliares" já decidiu:

```prisma
model OperacionalClientes {
  // ...como já desenhado no plano-cliente-master.md
  clienteId Int → Cliente   // OBRIGATÓRIO, mas NUNCA criado por este módulo — só vincula a Cliente pré-existente (ver seção 3)
  embasamento, progresso, mesProtocolo, linkGrupo, pastaChecklistId? — mantidos como estão
  // razaoSocial/nomeFantasia/cnpj/dados fiscais — REMOVIDOS, vêm de Cliente via include, SOMENTE LEITURA (ver decisão abaixo)
}
```

**`ClienteOperacional` (login), `NotificacaoCliente`, `PastaChecklist`, `Checklist`, `ModeloItemChecklist`, `ItemChecklist`, `DocumentoChecklist` continuam EXATAMENTE como estão** — nenhuma delas referencia dado cadastral de empresa diretamente (sempre passam por `OperacionalClientes`), então a unificação em `Cliente` já as beneficia automaticamente sem precisar tocá-las.

**`DocumentoUnidade`**: mantida no schema, sem uso (decisão do usuário, seção 4).

### Edição cadastral — RESPONDIDO (2026-08-11): vira exclusiva de outro módulo

**Decisão do usuário:** a partir da fusão, o Checklist **para de permitir edição de razão social/dados fiscais**. Esses campos passam a ser **somente leitura** na tela do Checklist (exibidos via `include: { cliente }`), e qualquer edição real precisa acontecer no módulo dono do cadastro (CS&NPS, ou o próprio BPM/CRM — a decidir qual é "o" lugar canônico de edição, fora do escopo desta análise). Isso é consistente com o princípio da seção 3 (BPM é a fonte única de verdade) — se o Checklist pudesse editar o `Cliente`, ele deixaria de ser um satélite puro e voltaria a ser uma 2ª fonte de escrita cadastral.

### Impacto no código (Server Actions a reescrever, quando a Fase 5/Operacional do plano rodar)

| Arquivo | Mudança necessária |
|---|---|
| `src/actions/ClientesOperacional.ts` — `vincularEmpresaAoCliente` | **Muda de "criar Cliente automaticamente" para "buscar e bloquear se não achar".** Busca `Cliente` por CNPJ normalizado; se encontrar, cria `OperacionalClientes` com `clienteId` preenchido; se NÃO encontrar, retorna erro claro ("Esta empresa ainda não está cadastrada no CRM — cadastre-a primeiro no Alpha CRM") e não cria nada. Formulário de cadastro do Checklist passa a exigir que o CNPJ já exista — não é mais um cadastro de empresa "do zero", é uma busca+vínculo. |
| `src/actions/checklist.ts` — `getEmpresasChecklist`, `getEmpresaChecklist` | `include` ganha `cliente: { select: { razaoSocial, nomeFantasia, cnpj, uf, municipio, ... } }` no lugar dos campos que hoje vêm direto de `OperacionalClientes` |
| `src/actions/checklist.ts` — `atualizarEmpresaChecklist` | **Deixa de escrever razaoSocial/nomeFantasia/cnpj/dados fiscais** — esses campos somem do formulário de edição do Checklist (viram somente leitura, decisão confirmada). A action continua existindo só para os campos que permanecem exclusivos do módulo (`embasamento`/`tipo`/`pastaChecklistId`/`status`). |
| `src/actions/ClientesOperacional.ts` — `verificarCnpjsOperacional` | Passa a checar duplicidade contra `Cliente.cnpj` (normalizado) em vez de `OperacionalClientes.cnpj` isoladamente |
| `src/app/PainelAlpha/CheckList/Modais/CadastroCliente.tsx` | Mudança de UX real: o formulário deixa de ser "digite CNPJ + preencha dados fiscais manualmente" e vira "busque CNPJ → se encontrado no CRM, mostra dados (read-only) + campos específicos do Checklist para preencher; se não encontrado, bloqueia com link/instrução para cadastrar no Alpha CRM primeiro" |

---

## 7. Riscos específicos desta fusão (além dos já catalogados no plano geral)

1. **Primeira dependência estrutural real do módulo Checklist em relação a outra tabela.** Confirmado pelo Scout: `OperacionalClientes` nunca teve FK para `clientes` nem para nenhuma tabela fora do próprio módulo — não fez parte do incidente de 2026-07-13 porque simplesmente não existia essa dependência. Ao ganhar `clienteId → Cliente`, o Checklist passa a herdar, pela primeira vez, o mesmo risco de acoplamento que já existe para Parceiros/Metas/BPM — a regra permanente de checagem cross-módulo (`PRAGMA foreign_key_list` completo antes de qualquer `DROP`/rename em `Cliente`) precisa **passar a incluir `OperacionalClientes`** na lista de tabelas a verificar, a partir do momento em que essa FK existir.
2. **Edição de dado cadastral duplicada em 2 lugares até a migração ocorrer.** Enquanto o plano geral não roda, `OperacionalClientes` e `clientes` continuam sendo 2 fontes independentes para a mesma empresa — isso já é o estado atual (não é piora), mas reforça que não há urgência técnica isolada só para o Checklist; ele deve entrar na fila do plano geral na ordem já desenhada (posição 5, depois de Extratos/Pré-Análise/Radar, antes de Metas/Comissões).
3. **Volume pequeno é uma vantagem real aqui.** Só 4 empresas hoje — é o módulo mais barato de migrar de toda a fila do plano geral, tecnicamente falando. Não há argumento de escala para adiar.

---

## 8. Resumo executivo — status final desta análise

1. Este documento **não substitui** `plano-cliente-master.md` — é um adendo específico ao módulo Checklist, a ser incorporado nele (seção "Tabelas auxiliares", entrada "Operacional") quando a pendência cross-plano abaixo for resolvida.
2. **As 3 decisões pontuais do Checklist estão FECHADAS (2026-08-11):**
   - `clienteId` obrigatório, **sem criação automática** — só vincula a `Cliente` já existente, bloqueia se não achar.
   - `DocumentoUnidade` — **mantida** no schema, sem uso, para aproveitamento futuro.
   - Edição cadastral — **vira exclusiva de outro módulo**; Checklist passa a ser somente leitura para razão social/dados fiscais.
3. **Pendência cross-plano — RESOLVIDA (2026-08-11): regra geral, sem exceção.** Confirmado com o usuário: todo negócio real sempre nasce como card no BPM/CRM antes de virar contrato em Metas — não há fluxo legítimo de contrato fechado sem passar pelo Kanban primeiro. **`ContratoComercial.clienteId` deixa de criar `Cliente` automaticamente** — a decisão antiga registrada em `plano-cliente-master.md` (pergunta 5, "cria Cliente no ato") está **superada e precisa ser corrigida** no plano geral para o mesmo padrão do Checklist: só vincula a `Cliente` já existente (por CNPJ), bloqueia com mensagem clara se não encontrar. Ver a atualização já aplicada em `plano-cliente-master.md`.
4. **Sem necessidade de generalizar o checklist em si** (seção 5) — não descartado por mim, mas você não sinalizou interesse nisso; segue como não-escopo a menos que você diga o contrário.
5. **Saneamento de dado real necessário em 2 módulos, não só 1:**
   - Checklist: 3 dos 4 registros hoje em `OperacionalClientes` não têm `Cliente` correspondente.
   - Metas: a Fase 1 do plano geral já mediu **18 CNPJs de `contratos_comerciais` sem correspondente em `clientes`** (ver `plano-cliente-master.md`, resultado da Fase 1) — com a regra "nunca cria" agora valendo também para Metas, esses 18 precisam ser resolvidos manualmente (cadastrados no BPM) antes do backfill, não mais absorvidos automaticamente como o plano antigo previa.

**Nenhum bloqueio restante para esta análise específica do Checklist** — as 3 decisões da seção 3/4/6 e a regra geral do BPM como porta única já estão fechadas. O que falta é propagar a correção da pergunta 5 de Metas no documento do plano geral (já feito nesta sessão) e, na Fase de execução, tratar o saneamento dos 18+3 CNPJs órfãos como passo explícito antes de qualquer backfill.

---

**Registrado por:** Bibble, 2026-08-11, a pedido do usuário (análise de fusão Checklist × Cliente Master).
