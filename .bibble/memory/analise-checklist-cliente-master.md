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

## 3. Decisão pendente que este documento reabre: `OperacionalClientes.clienteId` obrigatório ou nullable?

O plano já respondeu isso (2026-08-08): **obrigatório**. Mas a resposta foi dada **antes** da medição real ter aparecido no próprio plano (Fase 1, executada depois): **75% dos CNPJs do Operacional (3 de 4) não têm correspondência em `clientes`**. Isso significa que, se a decisão "obrigatório" for mantida como está, **3 dos 4 registros existentes vão gerar um `Cliente` novo automaticamente no backfill** — o que é aceitável (volume baixo, plano já classificou como "risco de execução baixo"), mas há uma implicação de fluxo que meREce sua atenção antes de confirmar:

- **Hoje**, `vincularEmpresaAoCliente` (`src/actions/ClientesOperacional.ts`) cria uma `OperacionalClientes` a partir de CNPJ digitado manualmente no cadastro — **sem nenhuma validação cruzada com `clientes` (CS&NPS)**. Uma empresa pode ser cadastrada no Checklist com uma razão social ligeiramente diferente da que está no CS&NPS para o mesmo CNPJ (nenhum dos dois sabe da existência do outro hoje).
- **Com `clienteId` obrigatório**, o comportamento muda: ao cadastrar uma empresa no Checklist, o sistema primeiro busca `Cliente` por CNPJ normalizado — se existir, reaproveita (e a razão social passa a vir de lá, não mais editável separadamente no Checklist); se não existir, cria um `Cliente` novo. **Isso é uma mudança de comportamento visível para quem usa o módulo hoje**, não só uma migration de schema: a tela de cadastro do Checklist deixa de ser "meu próprio cadastro de empresa" e passa a ser "vincular-se ao cadastro central".

**Pergunta que precisa da sua confirmação explícita (não decidida por mim):** você quer que o cadastro pelo Checklist também **crie** um `Cliente` novo quando não existir (unificação forte), ou prefere que o Checklist só **encontre** clientes já existentes e bloqueie/alerte quando o CNPJ não estiver cadastrado em nenhum outro módulo ainda (unificação mais conservadora, exige que a empresa "já exista" no sistema antes de entrar no Checklist)? A primeira opção é consistente com o padrão já adotado para Metas (`ContratoComercial.clienteId` obrigatório, cria no ato); a segunda é mais rígida e pode gerar fricção real hoje, já que 75% dos casos atuais cairiam nesse bloqueio.

---

## 4. Achado técnico: `DocumentoUnidade` é código morto

Confirmado por grep exaustivo em `src/`: **nenhum arquivo lê ou escreve `db.documentoUnidade`**. O model existe no schema, com FKs reais para `OperacionalClientes` e `ClienteOperacional`, mas não há nenhuma Server Action, rota ou componente que o use. `DocumentoChecklist` (o model realmente usado para documentos, vinculado a `ItemChecklist`) parece ter suplantado a intenção original de `DocumentoUnidade` (talvez pensado para documentos "gerais" da empresa, fora de um item específico do checklist).

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
  clienteId Int → Cliente   // obrigatório ou nullable — ver decisão pendente da seção 3 acima
  embasamento, progresso, mesProtocolo, linkGrupo, pastaChecklistId? — mantidos como estão
  // razaoSocial/nomeFantasia/cnpj/dados fiscais — REMOVIDOS, vêm de Cliente via include
}
```

**`ClienteOperacional` (login), `NotificacaoCliente`, `PastaChecklist`, `Checklist`, `ModeloItemChecklist`, `ItemChecklist`, `DocumentoChecklist` continuam EXATAMENTE como estão** — nenhuma delas referencia dado cadastral de empresa diretamente (sempre passam por `OperacionalClientes`), então a unificação em `Cliente` já as beneficia automaticamente sem precisar tocá-las.

**`DocumentoUnidade`**: recomendação de remover (código morto, seção 4) — decisão a confirmar, não assumida.

### Impacto no código (Server Actions a reescrever, quando a Fase 5/Operacional do plano rodar)

| Arquivo | Mudança necessária |
|---|---|
| `src/actions/ClientesOperacional.ts` — `vincularEmpresaAoCliente` | Passa a resolver/criar `Cliente` por CNPJ normalizado ANTES de criar `OperacionalClientes` (mesmo padrão já descrito no plano para este arquivo) |
| `src/actions/checklist.ts` — `getEmpresasChecklist`, `getEmpresaChecklist` | `include` ganha `cliente: { select: { razaoSocial, nomeFantasia, cnpj, uf, municipio, ... } }` no lugar dos campos que hoje vêm direto de `OperacionalClientes` |
| `src/actions/checklist.ts` — `atualizarEmpresaChecklist` | Deixa de escrever razaoSocial/nomeFantasia/cnpj/dados fiscais em `OperacionalClientes` — esses campos passam a ser editados (se precisarem ser editáveis pelo Checklist) via uma Server Action de `Cliente`, não mais local ao módulo. **Decisão de produto a confirmar:** o Checklist hoje permite editar razão social/dados fiscais livremente — isso devia continuar possível a partir da tela do Checklist (editando o `Cliente` central), ou a edição cadastral vira exclusiva de outro módulo (CS&NPS)? |
| `src/actions/ClientesOperacional.ts` — `verificarCnpjsOperacional` | Passa a checar duplicidade contra `Cliente.cnpj` (normalizado) em vez de `OperacionalClientes.cnpj` isoladamente |

---

## 7. Riscos específicos desta fusão (além dos já catalogados no plano geral)

1. **Primeira dependência estrutural real do módulo Checklist em relação a outra tabela.** Confirmado pelo Scout: `OperacionalClientes` nunca teve FK para `clientes` nem para nenhuma tabela fora do próprio módulo — não fez parte do incidente de 2026-07-13 porque simplesmente não existia essa dependência. Ao ganhar `clienteId → Cliente`, o Checklist passa a herdar, pela primeira vez, o mesmo risco de acoplamento que já existe para Parceiros/Metas/BPM — a regra permanente de checagem cross-módulo (`PRAGMA foreign_key_list` completo antes de qualquer `DROP`/rename em `Cliente`) precisa **passar a incluir `OperacionalClientes`** na lista de tabelas a verificar, a partir do momento em que essa FK existir.
2. **Edição de dado cadastral duplicada em 2 lugares até a migração ocorrer.** Enquanto o plano geral não roda, `OperacionalClientes` e `clientes` continuam sendo 2 fontes independentes para a mesma empresa — isso já é o estado atual (não é piora), mas reforça que não há urgência técnica isolada só para o Checklist; ele deve entrar na fila do plano geral na ordem já desenhada (posição 5, depois de Extratos/Pré-Análise/Radar, antes de Metas/Comissões).
3. **Volume pequeno é uma vantagem real aqui.** Só 4 empresas hoje — é o módulo mais barato de migrar de toda a fila do plano geral, tecnicamente falando. Não há argumento de escala para adiar.

---

## 8. Resumo executivo — o que fazer com isto

1. Este documento **não substitui** `plano-cliente-master.md` — é um adendo específico ao módulo Checklist, a ser incorporado nele (seção "Tabelas auxiliares" já tem a entrada "Operacional", só precisa ser expandida com os itens 3, 4 e 6 acima) quando você confirmar as decisões pendentes.
2. **2 decisões bloqueantes para fechar antes de qualquer execução:**
   - Seção 3: `clienteId` obrigatório com criação automática (como Metas) vs. obrigatório mas só vinculando a `Cliente` já existente (mais rígido, gera fricção hoje).
   - Seção 4: remover `DocumentoUnidade` (código morto) ou manter no schema sem uso.
3. **1 decisão de produto a confirmar:** se a edição de dados cadastrais (razão social, dados fiscais) continua acessível pela tela do Checklist (editando o `Cliente` central) ou se passa a ser exclusiva de outro módulo.
4. **Sem necessidade de generalizar o checklist em si** (seção 5) — a menos que você tenha em mente um caso de uso concreto de checklist fora do módulo Operacional que eu não vi no código.

Nenhuma Fase de execução foi aberta para isto ainda — aguardando suas respostas antes de decidir se isso vira uma extensão do plano geral ou uma fase própria.

---

**Registrado por:** Bibble, 2026-08-11, a pedido do usuário (análise de fusão Checklist × Cliente Master).
