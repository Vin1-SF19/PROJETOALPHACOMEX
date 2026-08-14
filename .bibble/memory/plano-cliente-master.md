# PLANO — Unificação em `Cliente` Master (fonte única de verdade de empresa)

> Status: **PLANEJADO, NÃO INICIADO**. Este documento é o blueprint de referência para quando o usuário autorizar a execução. Nenhuma linha de código ou schema foi alterada ao escrevê-lo. Qualquer sessão que for executar este plano deve reler este arquivo inteiro antes de começar, e seguir o Protocolo de Execução Serial (1 fase por vez, relatório antes de avançar, Vault obrigatório em toda migration real).

**Origem:** diagnóstico do banco pedido pelo usuário em 2026-08-08, seguido do pedido explícito de plano detalhado para uma tabela `Clientes` master que (1) nunca duplica CNPJ, (2) vira fonte da verdade para CS&NPS, Metas, BPM(CRM), Comissões, Parceiros e demais módulos, (3) permite que cada módulo mantenha uma tabela auxiliar própria para dado que não é consumido por ninguém mais. **Atualizado em 2026-08-08 (mesmo dia):** usuário pediu para incluir o cadastro de **pessoas vinculadas à empresa**, com **celular como chave** e podendo estar vinculada a **mais de uma empresa** — isto introduz um segundo conceito master (`Pessoa`, N:N com `Cliente`), tratado na seção 2.4.

---

## 1. Diagnóstico que motiva o plano (resumo — detalhe completo já registrado em `architecture.md`/`decisions.md`)

- `clientes` hoje mistura 2 conceitos na mesma linha: **a empresa** (cnpj/razaoSocial/nomeFantasia/uf/município/regime) e **o serviço contratado por ela** (servicos/status/analistaResponsavel/dataContratacao/dataExito/valorContrato). Por isso `cnpj` deixou de ser `@unique` sozinho em 2026-07-13 (virou `@@unique([cnpj, servicos])`) — mesmo CNPJ pode ter N linhas, uma por serviço.
- Pelo menos **6 tabelas** guardam cópias independentes dos mesmos dados cadastrais de empresa (cnpj/razaoSocial/nomeFantasia/uf/município/regimeTributario/dataConstituicao), sem FK entre si: `clientes`, `ContratoComercial`, `Extratos`, `ConsultaPreAnalise`, `OperacionalClientes`, e os caches de consulta `consultas_radar`/`radar_fiscal`.
- 3 tabelas do módulo Comissões (`CommissionEvent`, `BusinessProcess`, `EligibilityOverride`) têm `clienteId Int?` **solto, sem `@relation` no Prisma** — nenhuma constraint do banco protege contra órfão.
- O único lugar do código que já faz "merge por CNPJ" entre módulos é `ObterDadosEmpresaCardBpm` (`src/actions/bpm/Empresas.ts`), cruzando `clientes` + `consultaPreAnalise` + `radar_fiscal` manualmente via `cnpjsPossiveis` (com/sem máscara). Esse padrão ad-hoc é exatamente o que a tabela master elimina.
- **Incidente real já ocorreu** (2026-07-13): um rename+drop em `clientes` deixou 6 tabelas satélite (`socios`, `log_cs`, `logFeedback`, `crm_oportunidades`, `crm_contatos`, `indicacoes`) com FK fantasma, zerando o conteúdo delas. Toda a Fase 2 deste plano herda esse aprendizado como regra inviolável.
- **Confirmado nesta sessão:** `crm_oportunidades`/`crm_contatos` não existem mais no schema — foram substituídas pelo módulo **BPM** (`BpmCard`, empresa=`clientes`, pessoa=`socios`). Onde este plano falar em "CRM", trata-se do módulo BPM/AlphaCRM real.

---

## 2. Decisão de modelagem

**Separar Empresa (1 linha por CNPJ) de Contratação de Serviço (N linhas por empresa).** Rejeitada a alternativa de manter 1 linha por CNPJ+serviço (a estrutura atual) só trocando FKs soltas por relações — isso preservaria a causa raiz da duplicação (nenhum lugar único para "quem é essa empresa"). Esta escolha segue o próprio padrão que o usuário pediu ("essa tabela não pode duplicar CNPJs") — só é satisfazível com uma tabela `Cliente` 1:1 por CNPJ.

### 2.1 — `Cliente` (tabela master, nova)

Dado cadastral puro da empresa — o que é **igual e reaproveitável** em qualquer módulo que precise saber "quem é essa empresa", nunca informação de negócio de um módulo específico.

```prisma
model Cliente {
  id                  Int      @id @default(autoincrement())
  cnpj                String?  @unique               // nullable — empresa "em constituição" sem CNPJ ainda (decisão da pergunta 11, achado real na Fase 1). 14 chars, A-Z0-9 sem pontuação quando preenchido (CNPJ alfanumérico, RFB jul/2026 — pergunta 1)
  razaoSocial         String
  nomeFantasia        String?
  dataConstituicao    String?                          // mantém String (padrão já usado no projeto todo — nunca DateTime pra esse campo)
  uf                  String?
  municipio           String?
  regimeTributario    String?
  capitalSocial       String?                          // hoje só existe em radar_fiscal/ConsultaPreAnalise — sobe pro master
  situacaoCadastral   String?                          // idem — só em radar_fiscal
  status              String   @default("ATIVO")       // ATIVO | ARQUIVADO — status da EMPRESA em si, não de um serviço
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  servicos            ClienteServico[]
  pessoas             PessoaClienteVinculo[]            // substitui `socios` — ver seção 2.4 (Pessoa é global, N:N)
  contratos           ContratoComercial[]
  indicacao           Indicacao?
  bpmCards            BpmCard[]
  extratos            Extratos?
  consultaPreAnalise  ConsultaPreAnalise?
  consultaRadar       ConsultaRadarHistorico[]          // renomeado — ver seção 4.6
  commissionEvents    CommissionEvent[]
  businessProcesses   BusinessProcess[]
  eligibilityOverrides EligibilityOverride[]
  operacionalVinculo  OperacionalClientes[]

  @@index([razaoSocial])
  @@index([status])
}
```

**Por que `cnpj String @unique` sozinho, sem composição:** é o requisito explícito do usuário ("essa tabela não pode duplicar CNPJs"). Isso resolve na raiz o problema que forçou `@@unique([cnpj, servicos])` em `clientes` — porque lá o "serviço" vivia na mesma linha da empresa; aqui o serviço sai para tabela filha (`ClienteServico`), então a empresa pode ser única por CNPJ sem perder a possibilidade de múltiplos serviços.

**Normalização de CNPJ é pré-condição obrigatória** (ver Fase 1) — hoje há evidência real de CNPJ armazenado com e sem máscara em módulos diferentes (`cnpjsPossiveis` em `bpm/Empresas.ts` já compensa isso manualmente). A tabela master só consegue ser `@unique` de verdade se todo CNPJ for persistido no mesmo formato (recomendação: 14 dígitos, só números, sem pontuação) — decisão a confirmar com o usuário na Fase 1, não assumida aqui.

### 2.2 — `ClienteServico` (substitui o papel de "serviço" que hoje vive dentro de `clientes`)

```prisma
model ClienteServico {
  id                  Int       @id @default(autoincrement())
  clienteId           Int
  cliente             Cliente   @relation(fields: [clienteId], references: [id], onDelete: Cascade)

  servico             String                            // texto normalizado, mesmo catálogo usado hoje
  status              String    @default("Em Andamento") // status DO SERVIÇO (Em Andamento/Concluído/Arquivado) — não da empresa
  analistaResponsavel String?
  dataContratacao     String?
  dataExito           String?                            // gatilho do módulo Comissões — CONTINUA aqui, é dado de serviço, não de empresa
  formaPagamento      String?
  valorContrato       Float?
  closerNome          String?
  ultimoCs            Int?      @default(0)
  nps                 Int?
  feedbackGoogle      Boolean   @default(false)
  nomeGoogle          String?
  embasamento         String?
  origemLead          String?
  canalAquisicao      String?
  canalOutro          String?

  logCs               ClienteServicoLogCs[]
  logFeedback         ClienteServicoLogFeedback[]
  historicoAlteracoes ClienteServicoHistorico[]

  createdAt           DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@unique([clienteId, servico])   // 1 empresa não contrata o MESMO serviço 2x simultaneamente — equivalente ao @@unique([cnpj, servicos]) de hoje, só que via FK
  @@index([status])
}
```

Isso é literalmente o `model clientes` atual, menos os campos cadastrais (que migraram para `Cliente`) e ganhando `clienteId` como FK real em vez de repetir CNPJ. `log_cs`/`logFeedback`/`HistoricoAlteracaoCliente` continuam existindo, só que a decisão de qual nível eles penduram (empresa ou serviço) precisa ser tomada explicitamente — ver seção 2.3. `socios` deixa de ser 1:N preso a uma única empresa e vira o novo model `Pessoa`, global e N:N — ver seção 2.4 (mudança pedida pelo usuário em 2026-08-08).

### 2.3 — Decisão pendente de confirmar com o usuário: logs (`log_cs`/`logFeedback`/`HistoricoAlteracaoCliente`) penduram em `Cliente` ou em `ClienteServico`?

Hoje esses 3 logs têm `clienteId → clientes` (que é hoje "empresa+serviço" junto). Duas opções reais:

- **Opção A — pendurar em `Cliente` (empresa):** Registro de CS (`log_cs`) e feedback tendem a ser da relação com a empresa como um todo, mesmo quando ela tem vários serviços contratados. **Recomendação do Bibble.**
- **Opção B — pendurar em `ClienteServico`:** mantém granularidade por serviço (um log de CS pode ser específico de "declaração" vs "revisão" na mesma empresa). Mais fiel ao comportamento atual, mas obriga toda tela que hoje lê `cliente.log_cs` a decidir "de qual serviço" ou agregar de todos os serviços do CNPJ.

Este plano assume a **Opção A** como padrão de trabalho, mas isso deve ser confirmado explicitamente com o usuário antes da Fase 2 — é uma decisão de modelagem de dados, não um detalhe técnico.

### 2.4 — `Pessoa` (nova, global, celular como chave) — pessoas vinculadas a empresas, N:N

**Pedido do usuário (2026-08-08):** cadastro de pessoas vinculadas a empresa, com **celular como chave**, podendo estar vinculada a **mais de uma empresa**. Isto substitui o comportamento atual de `socios`, onde cada sócio pertence a exatamente 1 `clientes` via FK simples (`clienteId Int`, sem `@unique` composta, mas sem N:N real) — hoje, se a mesma pessoa é sócia de 2 empresas diferentes, ela precisa de 2 linhas distintas em `socios`, sem nenhum vínculo entre elas (o mesmo nome/telefone digitado 2x, sem garantia de consistência).

**Achado relevante do schema atual:** o model `PessoaEmpresaVinculo` **já existe** (criado na leva do BPM/D-049, 2026-08-03) e já modela exatamente essa relação N:N (`pessoaId → socios`, `empresaId → clientes`, `@@unique([pessoaId, empresaId])`) — mas, conforme o levantamento desta sessão confirmou, **nunca teve nenhum fluxo de escrita implementado** (só é lido indiretamente via `some: {}` em 1 único lugar, `bpm/Empresas.ts`). Ou seja, a intenção de "pessoa pode pertencer a mais de uma empresa" já estava reservada no schema, só nunca foi construída de verdade. Este plano agora ativa e generaliza essa intenção.

```prisma
model Pessoa {
  id             Int       @id @default(autoincrement())
  celular        String    @unique                 // CHAVE — normalizado (ver Fase 1, mesma decisão de normalização do CNPJ)
  nome           String
  cpf            String?                            // opcional — nem toda pessoa cadastrada hoje tem CPF capturado (socios.dataNascimento/vinculo já são opcionais)
  dataNascimento String?
  email          String?
  telefoneExtra  String?                            // 2º telefone/whatsapp, quando existir, sem virar chave
  observacao     String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  vinculos           PessoaClienteVinculo[]
  vinculosParceiro   PessoaParceiroVinculo[]           // ver seção 2.4a — ampliação decidida em 2026-08-08 (Parceiros também convergem)

  @@index([nome])
}

// Substitui PessoaEmpresaVinculo (nunca teve escrita real implementada) — N:N Pessoa↔Cliente,
// cada linha carrega o CONTEXTO do vínculo (cargo/função), que é dado da RELAÇÃO, não da pessoa
// nem da empresa isoladamente — mesma pessoa pode ser "Sócio" na Empresa A e "Contador" na Empresa B.
model PessoaClienteVinculo {
  id         Int      @id @default(autoincrement())
  pessoaId   Int
  pessoa     Pessoa   @relation(fields: [pessoaId], references: [id], onDelete: Cascade)
  clienteId  Int
  cliente    Cliente  @relation(fields: [clienteId], references: [id], onDelete: Cascade)

  vinculo    String?                                 // "Sócio" | "Representante" | "Contador" | etc — texto livre, mesmo catálogo usado hoje em socios.vinculo
  cargo      String?                                 // reaproveita conceito já usado em ParceiroResponsavel/ParceiroRepresentante
  principal  Boolean  @default(false)                 // marca o contato principal da empresa, quando houver mais de 1 vínculo
  ativo      Boolean  @default(true)                  // desvincular sem apagar histórico (mesmo padrão de Indicacao.status)
  criadoEm   DateTime @default(now())

  @@unique([pessoaId, clienteId])                     // 1 pessoa não tem 2 vínculos simultâneos com a mesma empresa (evita duplicar linha — ajustar vinculo/cargo em vez de recriar)
  @@index([clienteId])
  @@index([pessoaId])
}
```

**Por que `celular String @unique` como chave, e as implicações reais disso:**
- Resolve o pedido do usuário diretamente — 1 pessoa = 1 celular = 1 linha em `Pessoa`, reaproveitável em qualquer empresa.
- **Risco a auditar na Fase 1 (dado real):** celular é um campo historicamente digitado livre (`socios.telefone String?`, sem máscara nem validação) — pode haver duplicidade real (2 pessoas diferentes com o mesmo número por erro de digitação, número compartilhado familiar/comercial, ou campo vazio/genérico tipo "não informado"). `@unique` sozinho **vai falhar no backfill** se isso existir em volume — a Fase 1 precisa medir antes de travar essa constraint.
- **Celular pode mudar ou ser vazio.** Gente troca de número; cadastros antigos podem não ter telefone algum. Recomendação: campo `celular` fica `String @unique` mas **nullable não é permitido em coluna `@unique` sozinha real necessidade de unicidade** — na prática, para pessoas sem celular capturado, ou (a) exigir preenchimento obrigatório no cadastro novo (bloqueia salvar sem celular), ou (b) usar um sentinela controlado (não recomendado — sentinela quebra unicidade de verdade). **Recomendação do Bibble: tornar `celular` campo obrigatório no cadastro de `Pessoa` daqui pra frente**, e tratar registros legados sem celular como pendência de saneamento na Fase 1 (não migram automaticamente para `Pessoa` até alguém completar o dado, ou entram com celular provisório claramente marcado como "pendente" e sinalizado na UI — decisão de produto a confirmar, ver pergunta 8 na seção 4).
- **Reaproveitamento fora do BPM:** como `Pessoa` passa a ser global (não mais presa a 1 empresa), o mesmo cadastro serve de base para qualquer módulo que precise achar "essa pessoa já existe?" por celular — sócios do CS&NPS **e** (decisão do usuário, 2026-08-08, pergunta 10) responsáveis/representantes de Parceiro.

### 2.4a — Ampliação decidida em 2026-08-08: `Pessoa` também cobre Parceiros (`PessoaParceiroVinculo`)

**Decisão do usuário:** `ParceiroResponsavel`/`ParceiroRepresentante` convergem para o mesmo cadastro `Pessoa` — o escopo original ("pessoas vinculadas a empresa") se amplia para "cadastro único de pessoa física do sistema", vinculável tanto a `Cliente` (via `PessoaClienteVinculo`) quanto a `Parceiro` (via um novo model irmão).

```prisma
// Substitui ParceiroResponsavel e ParceiroRepresentante — mesma lógica de PessoaClienteVinculo,
// mas o contexto do vínculo é com Parceiro, não com Cliente. Campo `papel` distingue os 2
// tipos herdados ("RESPONSAVEL_LEGAL" | "REPRESENTANTE") porque tinham obrigatoriedade de
// campo diferente hoje (cpf/dataNascimento eram obrigatórios em ParceiroResponsavel, opcionais
// em ParceiroRepresentante) — preservado como dado da RELAÇÃO, não da Pessoa.
model PessoaParceiroVinculo {
  id             Int      @id @default(autoincrement())
  pessoaId       Int
  pessoa         Pessoa   @relation(fields: [pessoaId], references: [id], onDelete: Cascade)
  parceiroId     Int
  parceiro       Parceiro @relation(fields: [parceiroId], references: [id], onDelete: Cascade)

  papel          String   // "RESPONSAVEL_LEGAL" | "REPRESENTANTE" — herdado da distinção entre as 2 tabelas antigas
  tipoDocumento  String?  // "PF" | "PJ" — só fazia sentido em ParceiroRepresentante.tipo; ParceiroResponsavel sempre foi PF implícito
  documento      String?  // CPF/CNPJ do vínculo — nem sempre é o CPF cadastrado em Pessoa.cpf se o representante for PJ (ver risco abaixo)
  cargo          String?
  ativo          Boolean  @default(true)
  criadoEm       DateTime @default(now())

  @@unique([pessoaId, parceiroId, papel])
  @@index([parceiroId])
  @@index([pessoaId])
}
```

**Riscos novos introduzidos por esta ampliação (não existiam na versão anterior do plano):**
1. **`ParceiroResponsavel` HOJE NÃO TEM CAMPO DE TELEFONE** — só `nome`/`cpf`/`dataNascimento`/`cargo`. Como `Pessoa.celular` é chave obrigatória (decisão da pergunta 8), **todo responsável legal de parceiro cadastrado até hoje cai automaticamente na categoria "sem celular"** da Fase 1 — nenhum vira `Pessoa` no backfill automático até alguém coletar esse telefone retroativamente. Isso é volume adicional de saneamento manual, maior potencialmente do que o de `socios` (lá o campo ao menos existe, ainda que vazio às vezes). **Consequência direta de produto:** o formulário/wizard onde o responsável legal do parceiro é cadastrado (dentro do fluxo de convite/onboarding, `ModalConvidarParceiro.tsx` e o wizard público de pré-cadastro) precisa ganhar um campo de celular novo — mudança de UI que este plano agora precisa cobrir na Fase 3, não estava no escopo original.
2. **`ParceiroRepresentante.tipo`/`documento` podem ser de PJ**, não só PF — o campo `documento` de um representante PJ (CNPJ) não é a mesma coisa que `Pessoa.cpf` (que é sempre de pessoa física). Precisa decidir na Fase 1/3: representante PJ vira `Pessoa` mesmo assim (guardando o CNPJ em `PessoaParceiroVinculo.documento`, deixando `Pessoa.cpf` vazio), ou fica de fora da unificação (só PF converge)? **Recomendação do Bibble, a confirmar:** só PF converge para `Pessoa`; representante PJ continua como está hoje (não é "uma pessoa", é uma empresa representando o parceiro — conceito diferente).
3. **Dado mais sensível concentrado.** `ParceiroResponsavel.cpf`/`ParceiroRepresentante.documento` são PII de maior sensibilidade que os campos hoje em `socios`. Convergir tudo em `Pessoa` cria um único ponto de dado pessoal usado por CS&NPS, BPM e Parceiros ao mesmo tempo — Anubis deve auditar explicitamente (LGPD: minimização de dado, quem pode ler `Pessoa.cpf` em cada módulo, se o acesso via um módulo vaza dado capturado por outro) antes da Fase 3 tocar Parceiros.
4. **`recalcularNivel`/fluxo de aprovação de pré-cadastro de Parceiro** (`src/actions/parceiros.ts`) hoje cria `ParceiroResponsavel`/`ParceiroRepresentante` diretamente a partir do formulário público de convite (`PreCadastroParceiro`) — esse fluxo de aprovação precisa ser reescrito para resolver/criar `Pessoa` (por celular) + `PessoaParceiroVinculo`, com a mesma lógica de "celular já existe → vincular pessoa existente, não duplicar" que qualquer outro ponto de escrita de `Pessoa` precisa ter (ver risco 7 da seção 6).

`ClienteServicoLogCs`/`ClienteServicoLogFeedback`/`ClienteServicoHistorico` seguem o mesmo formato de hoje (`log_cs`/`logFeedback`/`HistoricoAlteracaoCliente`), só trocando a FK de `clienteId→clientes` para `clienteServicoId→ClienteServico` (se opção B) ou continuando em `clienteId→Cliente` (se opção A, e nesse caso nem precisam de rename, só a FK muda de alvo).

---

## 3. Tabelas auxiliares por módulo (dado que ninguém mais consome)

Regra geral adotada: **campo cadastral de empresa (cnpj/razaoSocial/nomeFantasia/uf/município/regime/dataConstituicao/capitalSocial/situação) nunca mais vive fora de `Cliente`.** Tudo que é específico da lente de um módulo (ex: "progresso do checklist operacional", "dados fiscais detalhados de dívida tributária", "conferência bancária de um extrato") vira tabela auxiliar 1:1 ou 1:N com `Cliente` via FK, sem repetir dado cadastral.

| Módulo | Tabela auxiliar (renomeada/enxugada) | O que continua exclusivo dela |
|---|---|---|
| Metas/Comercial | `ContratoComercial` (mantém nome) | `valorContrato`, `formaPagamento`, `canalAquisicao`, `closerNome`, `status` (ENVIADO/FECHADO), `pagamentoConfirmado*`, `contratoAssinado`, `contaComVenda`, `mes`/`ano`, `usuarioId`. Ganha `clienteId Int → Cliente` **obrigatório, mas SEM criação automática** (decisão corrigida em 2026-08-11 — `criarContrato` só busca/vincula `Cliente` já existente por CNPJ, bloqueia se não encontrar; BPM/CRM é a única porta de entrada de `Cliente` no sistema, ver pergunta 5). **Perde** `cnpj`/`razaoSocial`/`nomeFantasia`/`dataConstituicao`/`regimeTributario`/`uf` como campos próprios — todos passam a vir via `include: { cliente }`, somente leitura a partir de Metas. |
| Extratos Bancários | `Extratos` (mantém nome) | `criadoPorNome`, `analistaResponsavel`, `dataExito`, `periodos`. Ganha `clienteId Int @unique → Cliente` (1:1 real — hoje já é `cnpj @unique`). Perde `cnpj`/`razaoSocial`/`nomeFantasia`/`dataConstituicao`/`municipio`/`uf`/`regimeTributario` como campos próprios. |
| Pré-Análise (consulta Receita) | `ConsultaPreAnalise` (mantém nome) | `dadosBrutos Json` (payload bruto da API), `nomeResponsavel`, `telefoneContato`, `observacoes`, `regimeEA`/`qualificacao`/`submodalidade` (específicos dessa consulta, não do cadastro geral). Ganha `clienteId Int @unique → Cliente`. Perde `cnpj`/`razaoSocial`/`nomeFantasia`/`uf`/`municipio`/`capitalSocial` como campos independentes (viram leitura via `cliente`, ou ficam como **snapshot histórico opcional** — decisão de produto, ver Fase 1 pergunta 3). |
| Radar/Consultas em lote | `ConsultaRadarHistorico` (renomeia `consultas_radar`) | `situacao_radar`, `submodalidade`, `data_situacao`, `contribuinte`, `data_consulta`, `fonte`, `json_completo`, `data_opcao`, `optante_simples`, `arquivo_id`. Vira histórico de consultas (N por `Cliente`, não mais 1:1 `@unique(cnpj)`) — múltiplas reconsultas do mesmo CNPJ ao longo do tempo, ganha valor real de auditoria que hoje se perde no upsert. Ganha `clienteId Int? → Cliente` (nullable — pode consultar CNPJ que ainda não é `Cliente` cadastrado). |
| Dados fiscais consolidados | `radar_fiscal` (mantém nome) | `qualificacao`, `regime_receita`, `regime_ea`, `data_opcao_simples`, `data_exclusao_simples`, `divida_tributaria`, `historico_regime`, `cnaes`, `qsa`, `perse*`. Ganha `clienteId Int? @unique → Cliente`. Perde `razao_social`/`nome_fantasia`/`municipio`/`uf`/`capital_social` como campos próprios. |
| Operacional (portal do cliente) | `OperacionalClientes` (mantém nome) | `embasamento`, `progresso`, `mesProtocolo`, `linkGrupo`, `pastaChecklistId`, vínculo com `ClienteOperacional` (conta de login — **essa não muda**, é autenticação, não cadastro de empresa). Ganha `clienteId Int? → Cliente` (nullable no início — nem toda empresa do Operacional necessariamente é uma empresa contratante do CS&NPS, avaliar na Fase 1 se faz sentido tornar obrigatório). Perde `razaoSocial`/`nomeFantasia`/`cnpj`/`situacaoRadar`/`submodalidade`/`municipio`/`uf`/`regimeTributario`/`capitalSocial`/`dataConstituicao`/`contribuinte`/`dataSituacao` como campos próprios. |
| Comissões | `CommissionEvent`/`BusinessProcess`/`EligibilityOverride` (mantêm nome) | Tudo que já é específico do motor de comissões (valores em centavos, status, regras). `clienteId` deixa de ser `Int?` solto e ganha `@relation` real para `Cliente`. `cnpj`/`razaoSocial`/`nomeFantasia` **continuam existindo como snapshot** em `CommissionEvent` — decisão deliberada, não erro: é auditoria financeira, precisa preservar o nome da empresa como estava NO MOMENTO do evento, mesmo que a empresa seja renomeada depois. Ver seção 5.3. |
| Parceiros | `Indicacao` (mantém nome) | Toda a estrutura atual — só troca o alvo da FK de `clientes` para `Cliente`. Sem mudança de campo. Além disso, `Parceiro` ganha `pessoasVinculadas PessoaParceiroVinculo[]` (relação recíproca — ver seção 2.4a) — `ParceiroResponsavel`/`ParceiroRepresentante` são descontinuados em favor de `Pessoa`/`PessoaParceiroVinculo` (decisão do usuário, 2026-08-08, pergunta 10). |
| BPM/CRM | `BpmCard` (mantém nome) | Toda a estrutura atual (`pipelineId`, `etapaId`, `responsavelId`, etc) — só troca `empresaId → clientes` para `empresaId → Cliente`. Sem mudança de campo. Pessoas de contato do card (hoje `ListarTelefonesCardBpm`, que lê `socios` do cliente) passam a ler `PessoaClienteVinculo`/`Pessoa` — ganho real: telefone fica centralizado e reaproveitável entre módulos, não mais um campo solto por sócio. |

**Princípio geral aplicado em toda a tabela acima:** nenhuma coluna cadastral de empresa (CNPJ, razão social, fantasia, UF, município, regime, data de constituição, capital social, situação cadastral) sobrevive fora de `Cliente` — vira sempre FK + `include`. Colunas de negócio específicas do módulo continuam onde estão.

---

## 4. Decisões técnicas que precisam de confirmação do usuário ANTES da Fase 2

Nada disto é assumido silenciosamente — cada item aqui é uma pergunta real que muda o desenho.

1. ~~**Formato canônico do CNPJ.**~~ **RESPONDIDO (2026-08-08):** normalizar para **14 caracteres, só maiúsculas e dígitos, sem pontuação** (`.replace(/[^A-Z0-9]/g, '')` após `.toUpperCase()`) — **não** `\D` puro. **Atualização crítica levantada pelo usuário:** a Receita Federal lançou em julho/2026 o **CNPJ alfanumérico** — as 12 primeiras posições (raiz + ordem do estabelecimento) agora podem conter letras A-Z além de números; os 2 últimos dígitos verificadores continuam numéricos. É liberação gradual (empresas novas ainda podem sair só numéricas se houver combinação disponível), mas **`Cliente.cnpj` precisa ser `String` capaz de armazenar letras desde já** — qualquer validação/regex existente no projeto que hoje assuma "CNPJ = 14 dígitos numéricos" (máscaras de input, Zod schemas, `formatCnpj`/`parseCnpj` helpers, validação de dígito verificador) precisa ser auditada na Fase 1 e corrigida antes do backfill, ou CNPJs alfanuméricos novos vão falhar silenciosamente na validação ou na máscara de exibição. Isso vira um item novo na Fase 1 (ver seção 5).
2. ~~**Logs pendurados em `Cliente` ou `ClienteServico`**~~ **RESPONDIDO (2026-08-08): `ClienteServico`** (Opção B da seção 2.3) — `log_cs`, `logFeedback` e `HistoricoAlteracaoCliente` passam a ter `clienteServicoId → ClienteServico`, não `clienteId → Cliente`. Timeline de CS/feedback/auditoria é por serviço contratado, não por empresa agregada. Toda tela que hoje lê `cliente.log_cs`/`cliente.logFeedback` (ex: `modalDados.tsx`, `modalLogAuditoria.tsx`) precisa decidir explicitamente "de qual `ClienteServico`" ao exibir — se a tela hoje mostra 1 timeline única por empresa (CNPJ), ela vai precisar agregar/concatenar os logs de todos os `ClienteServico` daquele `Cliente`, ordenados por data, ou ganhar um seletor de "qual serviço" — decisão de UI a resolver na Fase 3.6 (Metas/CS&NPS), não antecipada aqui.
3. ~~**`ConsultaPreAnalise`/`consultas_radar`/`radar_fiscal` snapshot ou join?**~~ **RESPONDIDO (2026-08-08): snapshot**, conforme já era a recomendação — essas 3 tabelas mantêm cópia própria de razão social/UF/etc capturada no momento da consulta à Receita Federal, sem depender de `Cliente` para exibir seu próprio histórico. `Cliente` continua sendo o cadastro oficial usado no resto do painel.
4. ~~**`OperacionalClientes.clienteId` obrigatório ou opcional?**~~ **RESPONDIDO (2026-08-08), CORRIGIDO (2026-08-11): obrigatório, SEM criação automática.** Toda empresa cadastrada no módulo Operacional exige um `Cliente` master vinculado — mas, pela regra geral estabelecida em 2026-08-11 (ver item 5 abaixo e `analise-checklist-cliente-master.md`), `vincularEmpresaAoCliente` (`src/actions/ClientesOperacional.ts`) **NUNCA cria** um `Cliente` novo — só busca por CNPJ normalizado e **bloqueia com mensagem clara** ("Esta empresa ainda não está cadastrada no CRM — cadastre-a primeiro no Alpha CRM") se não encontrar. Não cria mais na mesma transação como a versão original desta entrada previa. **Consequência de saneamento:** os CNPJs de `OperacionalClientes` sem correspondência em `clientes` (medidos na Fase 1: 3 de 4) não migram automaticamente — precisam ser cadastrados manualmente no BPM antes do backfill, ou ficam de fora até alguém resolver.
5. ~~**`ContratoComercial.clienteId` obrigatório ou opcional?**~~ **RESPONDIDO (2026-08-08), CORRIGIDO (2026-08-11): obrigatório, SEM criação automática — mesma regra geral.** ⚠️ **Esta entrada foi revertida em relação à decisão original.** Motivo: em 2026-08-11, ao analisar a fusão do módulo Checklist, o usuário estabeleceu um princípio de arquitetura que se aplica a TODO o plano, não só ao Checklist — **"o BPM/CRM é a única porta de entrada de um `Cliente` novo no sistema"** — e confirmou explicitamente, quando perguntado, que **todo negócio real sempre nasce como card no BPM/CRM antes de virar contrato em Metas** (sem exceção, sem fluxo de contrato fechado que pule o Kanban). Isso invalida a decisão original desta linha ("`criarContrato` resolve/cria `Cliente` já na criação do contrato").
   **Nova decisão:** `criarContrato` (`src/actions/ContratoComercial.ts`) passa a **buscar** `Cliente` por CNPJ normalizado — se existir, vincula; se não existir, **bloqueia a criação do contrato** com mensagem clara orientando a cadastrar a empresa no Alpha CRM primeiro. Nunca cria `Cliente` por conta própria.
   **Consequências corrigidas:** (a) a preocupação original ("contratos Enviados que nunca fecham geram Cliente" / "`Cliente` muda de semântica para prospecção") deixa de existir — `Cliente` continua significando "empresa que já entrou pelo BPM", semântica preservada; (b) `criarRegistroClienteAPartirDeContrato` continua sendo só o ponto que cria/atualiza `ClienteServico` (o serviço em si), nunca criou `Cliente` mesmo na decisão antiga corrigida agora — ponto (b) da versão anterior desta entrada estava certo e permanece; (c) o merge de dados fiscais na confirmação deixa de fazer sentido para o `Cliente` (que passa a ser somente leitura para Metas, mesmo princípio do Checklist) — dados fiscais só atualizam campos exclusivos de `ContratoComercial`, nunca o `Cliente` central a partir deste módulo.
   **Saneamento de dado real — lista levantada em 2026-08-12 (Vault aprovou leitura pura, sem backup dedicado por ser SELECT sem escrita):** **17 CNPJs distintos** de `contratos_comerciais` sem correspondente em `clientes` (a Fase 1 original havia contado 18 — a diferença de 1 é ruído de medição, a lista abaixo é a atual e definitiva). Precisam ser cadastrados manualmente no BPM antes do backfill da Fase 2 — maior volume de saneamento manual de todo o plano geral:

   | CNPJ | Razão Social | Status | Arquivado |
   |---|---|---|---|
   | 63169028000177 | BAOSNOW LTDA | ENVIADO | sim |
   | 44933523000166 | CHINA SOURCE TRADE LTDA | ENVIADO | não |
   | 55204002000194 | CONCREBASE SERVICOS DE CONCRETAGEM LTDA | ENVIADO | não |
   | 51578217000114 | ELYSIUM CONSULTORIA E REPRESENTACOES LTDA | ENVIADO | sim |
   | 29860042000184 | EX-CHANGE E-COMMERCE LTDA | ENVIADO | sim |
   | 41903361000125 | FUZZ HB DISTRIBUICAO E COMERCIO LTDA | ENVIADO | não |
   | 10889342000168 | G+ HOLDING E FRANCHISING LTDA | ENVIADO | não |
   | 40500339000171 | GARAG PISCINAS LTDA | ENVIADO | não |
   | 62436066000186 | GIA IMPORTACAO E DISTRIBUICAO DE PRODUTOS PARA A SAUDE LTDA | ENVIADO | não |
   | 07424076000193 | INFINITY IMPORTADORA DE MAQUINAS LTDA | ENVIADO | não |
   | 61844772000102 | M' S TESOUROS ENGENHARIA LTDA | ENVIADO | não |
   | 04795759000169 | MARIOMATIC PECAS E SERVICOS LTDA | ENVIADO | sim |
   | 66929361000125 | MIX IMPORTACAO E EXPORTACAO LTDA | ENVIADO | sim |
   | 42686021000152 | NEWMOTOR CENTER LTDA | ENVIADO | não |
   | 67796827000124 | SBS FLOW INSTRUMENTACAO E AUTOMACAO LTDA | **FECHADO** | não |
   | 54714683000178 | SHGG GROUP - COMERCIO, LOGISTICA, ADMINISTRACAO E GESTAO LTDA | **FECHADO** | não |
   | 41531986000103 | V. S. R. VARGAS UTILIDADES | ENVIADO | não |

   **⚠️ Achado real do levantamento:** 2 dos 17 (SBS FLOW e SHGG GROUP) já têm `status = FECHADO` — são negócios genuinamente fechados que nunca passaram pelo BPM/CRM, contrariando a premissa "todo negócio real sempre nasce no BPM" confirmada em 2026-08-11. **Decisão do usuário (2026-08-12): tratados como exceções históricas** — a regra vale daqui para frente (forward-looking), não retroativamente; esses 2 (e os demais 15) são resolvidos com cadastro manual no BPM antes do backfill, sem reabrir a decisão de arquitetura da pergunta 5.
   **Sem sobreposição com o Checklist** — nenhum dos 17 CNPJs órfãos de Metas coincide com os 3 órfãos de `operacional_clientes` (ver seção do Checklist em `analise-checklist-cliente-master.md`).
6. ~~**`logAlteracao`**~~ **RESPONDIDO (2026-08-08): remover** — não migra para o schema novo.
7. ~~**`PessoaEmpresaVinculo` antigo — descontinuar?**~~ **RESPONDIDO (2026-08-08): manter os dois em paralelo.** `PessoaEmpresaVinculo` (model de 2026-08-03, `socios`↔`clientes`, nunca teve escrita implementada) **permanece no schema, intocado**, mesmo sem uso — não é migrado, não é removido, não recebe FK nova para `Cliente`/`Pessoa`. O par ativo daqui pra frente é `Pessoa`/`PessoaClienteVinculo` (seção 2.4). Nota de manutenção: se um dia alguém decidir implementar escrita em `PessoaEmpresaVinculo`, vai estar apontando para `clientes`/`socios` — modelos que este plano descontinua/esvazia — então esse model antigo efetivamente também fica órfão de uso futuro; mantido só por decisão explícita do usuário de não mexer nele agora.
8. ~~**Celular obrigatório em `Pessoa`?**~~ **RESPONDIDO (2026-08-08): obrigatório a partir da migração.** Cadastro novo de `Pessoa` (em qualquer módulo que a use — CS&NPS/BPM e, pela decisão da pergunta 10, também Parceiros) exige celular preenchido, bloqueando salvar sem ele. Registros legados sem celular (sócios do Turso sem telefone, e agora também responsáveis/representantes de parceiro sem telefone) ficam retidos como pendência de saneamento na Fase 1 — não viram `Pessoa` até alguém completar o dado, listados em relatório dedicado.
9. **Existe hoje, no dado real, mais de uma pessoa com o mesmo celular (número duplicado por erro, celular corporativo compartilhado, etc)?** Só a Fase 1 (auditoria de dado real) responde isso — se houver volume relevante, `@unique` em `celular` pode exigir uma etapa manual de deduplicação/decisão (qual das linhas vira a `Pessoa` real) antes do backfill rodar. **Com a decisão da pergunta 10 (Parceiros também convergem), esta checagem de duplicidade cruza agora 3 fontes** (`socios.telefone`, `ParceiroResponsavel.cpf`+ausência de telefone próprio — ver nota abaixo —, `ParceiroRepresentante.telefone`), não só `socios`. Segue **bloqueante** — Fase 1 não fecha sem essa medição.
10. ~~**`ParceiroResponsavel`/`ParceiroRepresentante` convergem para `Pessoa`?**~~ **RESPONDIDO (2026-08-08): sim, unificar também nesta migração.** Isso amplia o escopo original ("pessoas vinculadas a empresa") para "pessoa física, cadastro único do sistema, vinculável a `Cliente` E a `Parceiro`". Consequências de modelagem, detalhadas na seção 2.4a (nova):
    - `PessoaClienteVinculo` continua sendo o vínculo Pessoa↔Cliente (empresa). Precisa de um **novo model irmão, `PessoaParceiroVinculo`** (Pessoa↔Parceiro), já que os campos de contexto são diferentes (`ParceiroResponsavel` tem `cpf`/`dataNascimento` obrigatórios + `cargo` opcional; `ParceiroRepresentante` tem `tipo`/`documento`/`nome`/`dataNascimento`/`cargo`/`email`/`telefone` — **`ParceiroResponsavel` HOJE NÃO TEM CAMPO DE TELEFONE** — ver risco novo abaixo).
    - **Risco novo, não previsto na versão anterior do plano:** `ParceiroResponsavel` (`src/prisma/schema.prisma`, `model ParceiroResponsavel`) não captura telefone hoje — só `nome`/`cpf`/`dataNascimento`/`cargo`. Como `Pessoa.celular` é a chave obrigatória, **todo responsável de parceiro legado cai automaticamente na categoria "sem celular" da pergunta 8** — nenhum vira `Pessoa` no backfill automático até alguém coletar o telefone. Isso pode ser um volume maior do que os sócios sem telefone (lá pelo menos o campo existe, mesmo que vazio às vezes; aqui o campo nunca existiu). A Fase 1 precisa dimensionar isso separadamente e o formulário de cadastro de responsável de parceiro (`ModalConvidarParceiro.tsx`/wizard de convite) precisa ganhar um campo de celular obrigatório novo, o que é uma mudança de UI adicional fora do que este plano cobria originalmente.
    - Este item também deve ser cruzado com o Vault: `ParceiroResponsavel.cpf`/`ParceiroRepresentante.documento` são dados de PF mais sensíveis que os de `socios` hoje — convergir para um cadastro único aumenta a superfície de dado pessoal concentrado em `Pessoa`, o que é exatamente o tipo de mudança que Anubis deve revisar explicitamente na Fase 3 (LGPD/exposição de dado).
11. ~~**Empresa "em constituição" sem CNPJ real — como `Cliente.cnpj @unique` suporta isso?**~~ **RESPONDIDO (2026-08-10): opção (a), `cnpj String? @unique` (nullable).** "Não tem CNPJ ainda" é `NULL`, não um valor fake — já refletido no `model Cliente` da seção 2.1. Nenhum sentinela artificial (`"PENDENTE-{id}"`) é usado. **Consequências diretas para a Fase 2:**
    - **SQLite (e por extensão o Turso/libSQL) não considera múltiplos `NULL` como colisão de `UNIQUE`** — cada `NULL` é tratado como distinto dos demais nessa constraint, então N empresas "em constituição" simultâneas (`cnpj = NULL`) convivem sem erro. Isso é o comportamento padrão do motor, não uma configuração a fazer.
    - **Script de backfill (Fase 2, item 3) precisa de uma regra explícita de saneamento**: qualquer `clientes.cnpj` igual a `"00000000000000"` (ou outro padrão claramente inválido — todos dígitos iguais, por exemplo) vira `Cliente.cnpj = NULL` no backfill, **nunca** é copiado literalmente. Script deve logar cada caso convertido para o usuário revisar (hoje só há 1 caso confirmado, `clientes.id=277`, mas o backfill deve tratar isso como regra, não como exceção hardcoded de 1 `id` só).
    - **Toda tela/action que hoje assume que `cliente.cnpj` sempre existe** (buscas por CNPJ, `verificarCNPJDuplicado`, exportações, `formatCnpj` na exibição) precisa tratar `null` explicitamente — mesmo padrão de resiliência já usado no projeto para `Transacao.data` nullable (ver `decisions.md`, 2026-07-09): nunca assumir presença, exibir algo como "CNPJ pendente" quando `null`.
    - **`ClienteServico`/demais tabelas satélite que hoje buscam por CNPJ para achar a empresa** (ex: `ObterDadosEmpresaCardBpm`, adapters de Comissões) precisam de um caminho alternativo para empresas sem CNPJ — na prática, sempre navegar pelo `Cliente.id`/FK real em vez de por CNPJ nesses casos, o que já é a direção geral do plano (FK real em vez de string), então não é uma exceção nova de arquitetura, só uma confirmação de que o caminho por CNPJ nunca pode ser o único.

---

## 5. Ordem de execução (fases seriais — protocolo da squad)

Cada fase abaixo é um agente por vez, relatório obrigatório antes de avançar, seguindo `bibble/SKILL.md`. Migrations reais em produção SEMPRE passam por Vault + backup fresco + confirmação explícita, sem exceção — mesmo as classificadas 🟢.

### Fase 0 — Confirmação das decisões pendentes (usuário, sem código) — ✅ CONCLUÍDA (2026-08-10)
Todas as 11 perguntas da seção 4 respondidas (10 em 2026-08-08; a 11ª, nascida do achado real da Fase 1, em 2026-08-10). Fase 2 liberada.

### Fase 1 — Auditoria de dado real (Vault + DataEngineer, só leitura no Turso)
1. Rodar query no Turso real contando: quantos CNPJs distintos existem em `clientes` hoje vs quantas linhas (mede o tamanho real da duplicação por serviço).
2. Checar formato de CNPJ salvo (com/sem máscara) em `clientes`, `ContratoComercial`, `Extratos`, `ConsultaPreAnalise`, `consultas_radar`, `radar_fiscal`, `OperacionalClientes` — decide a normalização da pergunta 1.
2b. **Auditar todo validador/máscara/regex de CNPJ no código** (Zod schemas, componentes de input com máscara, `formatCnpj`/cálculo de dígito verificador) — levantar cada ponto que hoje assume "CNPJ = 14 dígitos numéricos" e precisa aceitar letras A-Z nas 12 primeiras posições (CNPJ alfanumérico, RFB jul/2026). Sem isso, cadastro de empresa nova com CNPJ alfanumérico pode falhar na validação do formulário antes mesmo de chegar no banco — bug silencioso e crescente à medida que a RFB for emitindo mais desses. Esta checagem é independente do Turso (é auditoria de código, não de dado), mas roda na mesma fase por ser pré-requisito do mesmo formato canônico.
3. Checar quantos CNPJs de `ContratoComercial` NÃO têm correspondente em `clientes` (contratos nunca fechados — ficarão com `clienteId = null`).
4. Checar quantos CNPJs de `OperacionalClientes` NÃO têm correspondente em `clientes` (decide a pergunta 4).
5. Checar quantas linhas de `CommissionEvent`/`BusinessProcess`/`EligibilityOverride` têm `clienteId` que não existe mais em `clientes` (órfãos já existentes hoje, antes mesmo da migração — precisam de decisão de saneamento).
6. Checar duplicidade de razão social/CNPJ divergente entre módulos para o mesmo CNPJ (ex: `clientes.razaoSocial` != `ContratoComercial.razaoSocial` para o mesmo CNPJ) — mapear quantos casos existem, decidir critério de desempate (mais recente por `updatedAt`? sempre `clientes` como fonte prioritária, por ser o cadastro "oficial" do CS&NPS?).
7. **Checar formato/preenchimento de `socios.telefone` no Turso real**: quantos registros têm telefone vazio/nulo, quantos têm formato inconsistente (com/sem DDD, com/sem máscara), e — o mais crítico — **quantos números de celular se repetem entre sócios diferentes** (decide se `Pessoa.celular @unique` é viável direto ou exige deduplicação manual antes do backfill, perguntas 8 e 9).
7b. **Medir `ParceiroResponsavel`/`ParceiroRepresentante` no Turso real** (decisão da pergunta 10, 2026-08-08): quantas linhas de `ParceiroResponsavel` existem no total (100% delas ficarão sem `Pessoa` automática, já que a tabela nunca capturou telefone — ver seção 2.4a risco 1); quantas linhas de `ParceiroRepresentante` têm `telefone` preenchido vs vazio; quantas de `ParceiroRepresentante` são `tipo = "PJ"` (decide se convergem ou ficam de fora, ver seção 2.4a risco 2); cruzar celulares de `ParceiroRepresentante.telefone` contra `socios.telefone` normalizado para achar pessoas que já são sócias de uma empresa E representantes de um parceiro (caso real esperado — mesma pessoa em papéis diferentes é exatamente o cenário que `Pessoa` global resolve).
8. **Backup completo do Turso** dedicado a esta auditoria antes de qualquer query de escrita futura — mesmo Fase 1 sendo só leitura, já deixa o backup pronto para a Fase 2.

Relatório da Fase 1 vira input direto do schema final da Fase 2 (pode ajustar nullable/not-null das FKs conforme o dado real, não a suposição).

### Fase 1 — RESULTADO (executado em 2026-08-10, Vault aprovou após backup fresco em `database-backups/pre-change/painelalpha_turso_pre_change_auditoria-cliente-master_2026-08-10T16-38-24-483Z.sql`, 168 tabelas, 33.117 linhas)

| # | Item | Resultado |
|---|---|---|
| 1 | CNPJs distintos vs linhas em `clientes` | 254 linhas, **253 CNPJs distintos** — só 1 CNPJ duplicado por serviço hoje (bem menor do que o plano supunha). |
| 2 | Formato de CNPJ (7 tabelas) | **100% consistente**: `clientes`, `contratos_comerciais`, `Extratos`, `ConsultaPreAnalise`, `consultas_radar` (23.358 linhas!), `radar_fiscal`, `operacional_clientes` — todas com CNPJ **14 dígitos, só números, sem pontuação**, sem outlier de comprimento. Nenhuma máscara salva em produção. **O CNPJ alfanumérico (pergunta 1) ainda não apareceu no dado real** — normalização para 14 chars A-Z0-9 continua sendo a decisão correta para o futuro, mas hoje a migração em si não vai encontrar nenhum caso alfanumérico para tratar. |
| — | **Achado novo, não previsto:** `clientes.id=277`, `cnpj="00000000000000"`, `razaoSocial="Em constituição"` | **Caso de negócio real e legítimo**: empresa nova cujo CNPJ ainda não existe (em processo de abertura), cadastrada com CNPJ zerado como placeholder para não travar o fluxo de trabalho comercial/CS&NPS. **Isto quebra a suposição de `cnpj String @unique` sozinho** — se houver 2+ empresas "em constituição" simultaneamente, `00000000000000` colide. Decisão pendente nova (ver seção 4, pergunta 11): `Cliente.cnpj` precisa aceitar um estado "ainda não tem CNPJ" sem violar unicidade — provavelmente `cnpj String? @unique` (nullable) com um identificador interno separado para o registro "em constituição", ou um valor sentinela único por linha (`PENDENTE-{id}`) em vez de zeros fixos. **Bloqueante para o schema final da Fase 2.** |
| 3 | Contratos sem `Cliente` correspondente | 81 CNPJs distintos em `contratos_comerciais`, **18 sem correspondência em `clientes`** (~22%) — volume real e não-trivial de `Cliente`s que nasceriam automaticamente com a decisão da pergunta 5 (FK obrigatória, criar no ato). |
| 4 | Operacional sem `Cliente` correspondente | 4 CNPJs distintos em `operacional_clientes`, **3 sem correspondência** (75% do módulo) — confirma que a decisão da pergunta 4 (FK obrigatória) vai gerar `Cliente` novo para a maioria das empresas do Operacional hoje. Volume baixo em termos absolutos (só 4 empresas no módulo inteiro), risco de execução baixo. |
| 5 | `CommissionEvent` com `clienteId` órfão | **0 órfãos** de 274 linhas — ótima notícia, nenhum saneamento necessário aqui. 4 linhas com `clienteId` `NULL` (esperado — eventos sem cliente resolvido). `BusinessProcess`/`EligibilityOverride` confirmados vazios (0 linhas cada). |
| 6 | Divergência de razão social `clientes` × `contratos_comerciais` | 65 CNPJs presentes em ambos, **1 divergência** ("FORTY SIX ADMINISTRACAO, IMPORTACAO E COMERCIO LTDA" vs "forty six administradora de bens ltda" — nome da empresa parece ter mudado de ramo/redação entre o cadastro dos dois módulos). Volume desprezível — a Fase 3.6 pode tratar como exceção manual pontual, não precisa de heurística de desempate automática. |
| 7 | `socios.telefone` — vazio e duplicidade | 377 sócios total, **174 sem telefone (46%)**, 191 telefones distintos preenchidos. **11 números duplicados entre sócios diferentes** — incluindo 1 caso real de 3 empresas distintas com o mesmo celular ("CELIO"/"Célio"/"Célio", clientes #24/#77/#79 — quase certamente a mesma pessoa física, sócia/contato de 3 empresas ao mesmo tempo: **prova de campo exatamente do cenário que `Pessoa` global resolve**). Volume de duplicidade é pequeno (11 de 191, ~5.8%) — viável de resolver manualmente na Fase 2, não precisa de heurística automática de desambiguação. |
| 8 | `parceiro_responsavel` | **0 linhas confirmadas** — tabela vazia na prática. Muda a leitura do risco 1 da seção 2.4a: não é "volume grande de saneamento manual", é **zero registros a migrar** — o model pode simplesmente não ter dado legado a tratar (só relevante para cadastros futuros, que já nascem exigindo celular). |
| 9 | `parceiro_representante` — telefone/tipo | 28 total, **20 com telefone (71%), 8 sem (29%)** — bem menos pendência do que o pior cenário do plano. **100% são `tipo = "PF"`** — o risco 2 da seção 2.4a (representante PJ) não se aplica no dado atual; a decisão "só PF converge" fica vazia de exceção real hoje (mas continua valendo como regra para o futuro). Cruzamento de telefone contra `socios`: **0 coincidências** — nenhuma pessoa hoje é sócia de uma empresa E representante de um parceiro ao mesmo tempo (diferente do que a auditoria de sócios já provou entre empresas diferentes). |

**Conclusões que mudam o plano:**
1. **CNPJ está mais limpo do que o previsto** — a Fase 2 não precisa de lógica de deduplicação por máscara/formato. A única exceção real é o CNPJ placeholder "em constituição" (nova pergunta 11, bloqueante).
2. **Volume de "Clientes órfãos que nascem no backfill"**: 18 (Metas) + 3 (Operacional) = pelo menos 21 `Cliente`s novos só por essas duas fontes, antes mesmo de contar o resto. Não é alarmante, mas o usuário deve saber que o `Cliente` master não nasce só com as 253 empresas de hoje.
3. **Duplicidade de celular existe e é real (11 casos), mas é pequena e gerenciável** — não bloqueia a Fase 2, mas exige que o script de backfill trate explicitamente "mesmo celular, sócio de 2+ empresas diferentes" como **o caso de sucesso esperado** (vira 1 `Pessoa` com N `PessoaClienteVinculo`), não como erro.
4. **`parceiro_responsavel` vazio simplifica bastante a Fase 3.1** — não há dado legado para saneamento manual coletivo, só a mudança de formulário para cadastros futuros continua necessária.

### Fase 2 — Schema novo em paralelo (Echo + DataEngineer, sem migration real ainda)
1. Criar `model Cliente`, `model ClienteServico`, `model Pessoa`, `model PessoaClienteVinculo`, `model PessoaParceiroVinculo` (e `ClienteServicoLogCs`/`ClienteServicoLogFeedback`/`ClienteServicoHistorico`, já decidido no nível `ClienteServico` — pergunta 2) no `schema.prisma`, **sem remover ainda os models antigos** (`clientes`/`socios`/`ParceiroResponsavel`/`ParceiroRepresentante` continuam existindo em paralelo por enquanto — migração incremental, não big-bang).
2. `prisma generate` local, validar que o client TypeScript compila.
3. Script de backfill de `Cliente`/`ClienteServico` (Node, `@libsql/client/web`, mesmo padrão já usado no projeto): lê todas as linhas de `clientes`, agrupa por CNPJ normalizado (14 chars A-Z0-9, ver decisão do CNPJ alfanumérico), cria 1 `Cliente` por CNPJ distinto + N `ClienteServico` filhos. Script deve ser **idempotente** (rodar 2x não duplica) e reportar contagem antes/depois.
4. Script de backfill de `Pessoa`/`PessoaClienteVinculo` (script separado, roda DEPOIS do backfill de `Cliente`, pois depende dos `id`s novos): lê todas as linhas de `socios`, agrupa por celular normalizado — celulares iguais entre sócios de empresas diferentes viram **1 única `Pessoa`** com **N `PessoaClienteVinculo`** (é aqui que a promessa "pode estar vinculada a mais de uma empresa" se materializa de fato pela primeira vez). Sócios sem celular capturado (ou com celular duplicado não resolvido pela Fase 1) ficam de fora do backfill automático, listados num relatório à parte para o usuário decidir caso a caso. Também idempotente.
5. Script de backfill de `PessoaParceiroVinculo` (roda depois do anterior, pois pode reaproveitar `Pessoa`s já criadas pelo backfill de sócios se o celular bater): lê `ParceiroResponsavel` (100% ficará pendente — sem telefone, ver Fase 1 item 7b) e `ParceiroRepresentante` (só os com `telefone` preenchido e, conforme decisão a confirmar na Fase 1, só os `tipo = "PF"`), resolve/cria `Pessoa` por celular normalizado, cria `PessoaParceiroVinculo` com `papel` correspondente. Também idempotente, também gera relatório de pendências.
6. Vault revisa os 3 scripts de backfill ANTES de qualquer execução real — dry-run primeiro (só imprime o que faria, não escreve), depois execução real só após aprovação.

### Fase 3 — Migração dos módulos satélite, um de cada vez (nunca todos juntos)
Ordem sugerida (do menor/mais isolado para o maior/mais crítico, para aprender com o menor risco primeiro):
1. **Parceiros** (`Indicacao.clienteId` → `Cliente.id`; `ParceiroResponsavel`/`ParceiroRepresentante` descontinuados em favor de `Pessoa`/`PessoaParceiroVinculo` — decisão do usuário, 2026-08-08). **Nota de reordenação:** este item deixou de ser "menor superfície" com a ampliação de escopo — agora inclui coletar um campo de celular novo no wizard de convite/onboarding de parceiro (`ModalConvidarParceiro.tsx` e o formulário público de pré-cadastro) antes que `ParceiroResponsavel` consiga migrar de verdade. Se o usuário preferir, este item pode ser dividido em **3.1a** (só `Indicacao.clienteId`, baixo risco, roda primeiro) e **3.1b** (convergência de `ParceiroResponsavel`/`ParceiroRepresentante` para `Pessoa`, que depende da mudança de formulário) — reavaliar no início da Fase 3 com Scout.
2. **BPM** (`BpmCard.empresaId` → `Cliente.id`; `ListarTelefonesCardBpm` e `ObterDadosEmpresaCardBpm` passam a ler `PessoaClienteVinculo`/`Pessoa` em vez de `socios`; `PessoaEmpresaVinculo` antigo permanece intocado no schema, sem uso — decisão do usuário, pergunta 7) — superfície média, mas já é o módulo mais "consciente" do conceito de empresa unificada (já faz merge manual por CNPJ hoje) e o primeiro a se beneficiar de verdade da pessoa global.

   **⏸️ PAUSADA em 2026-08-12 (Scout já rodou, blueprint pronto, implementação NÃO iniciada — zero arquivos do BPM tocados).**
   - **Achado do Scout que muda a decisão:** nenhum ponto do BPM cria `clientes` hoje — `CriarCardBpm`/`NovoCardModal.tsx` só vinculam empresa já existente via busca (`BuscarEmpresasBpm`, só leitura). A premissa "BPM é a única porta de entrada de Cliente novo" (seção 4, pergunta 5) não reflete o comportamento atual — é uma funcionalidade a construir, não uma migração de comportamento existente.
   - **Decisão do usuário (2026-08-12):** o botão "+" da coluna **"Novos Leads"** especificamente (distinto das outras colunas do Kanban, que continuam vinculando empresa existente) deve virar o cadastro real e único de lead novo — cria um `Cliente` de verdade (CNPJ com busca automática na Receita, razão social, etc.), substituindo os `BpmCampo` soltos de "CNPJ"/"Nome do responsável" que `plano-novos-leads-bpm.md` (2026-08-10, Coluna 1, item 3) já havia previsto como solução temporária ("seguir com BpmCampo agora, sem bloquear por uma migração maior que ainda está em fase de planejamento" — essa migração maior é este próprio plano, que agora já está pronto).
   - **Motivo real da pausa:** confirmado processo **OpenAI Codex ativo em tempo real** (`--working-dir` = raiz do projeto, iniciado 2026-08-12 17:02) + `npm run dev` de outro fluxo, editando ATIVAMENTE `NovoCardModal.tsx`/`Cards.ts` — exatamente os arquivos que a implementação do botão "+" precisaria tocar. Risco de colisão direta, não just teórico (arquivo mudou de estado entre duas checagens do Scout na mesma sessão). Usuário escolheu pausar e esperar esse outro trabalho terminar antes de retomar.
   - **Ao retomar:** (1) checar `git status`/processos node ativos de novo antes de tocar em qualquer arquivo; (2) Scout deve re-confirmar o estado de `NovoCardModal.tsx`/`Cards.ts`/`PipelineBoardClient.tsx` (podem ter mudado bastante); (3) o resto do blueprint do Scout (schema `BpmCard.empresa clientes→Cliente`, `Empresas.ts::ObterDadosEmpresaCardBpm`/`ObterPerfilEmpresaBpm`, `ListarTelefonesCardBpm`) continua válido e não depende da decisão do botão "+"; (4) o formulário de cadastro do botão "+" é peça nova, específica da etapa "Novos Leads" — decidir com o usuário quais campos exatos (mínimo: CNPJ+busca Receita+razão social; avaliar se junta ou não com os `BpmCampo` já planejados como "Nome do responsável"/"Radar pretendido"/"Confirmar serviço").
3. **Extratos** (`Extratos.cnpj @unique` → `clienteId @unique`) — 1:1 direto, baixo risco.
4. **Pré-Análise** (`ConsultaPreAnalise`) — ganha `clienteId` mantendo snapshot próprio (decisão da pergunta 3).

   **⚠️ ESCOPO REDUZIDO em 2026-08-13 — decisão explícita do usuário.** O Scout original desta fase mapeou 3 tabelas (`ConsultaPreAnalise`, `consultas_radar`→`ConsultaRadarHistorico`, `radar_fiscal`) em 16 arquivos (bem mais que os 4 citados na versão original deste item). Ao apresentar o blueprint, o usuário esclareceu: **"o consulta radar, o sistema do radar é para outra coisa, não se encaixa no CRM"** — confirmado explicitamente que tanto `consultas_radar` (Consulta RADAR em lote/histórico) quanto `radar_fiscal` (Análise Fiscal/AlphaConnect) **ficam FORA do Cliente Master**, permanentemente, não é adiamento. Só `ConsultaPreAnalise` (Sistema Pré-Análise) continua no escopo desta fase.
   **Consequência:** `consultas_radar` NÃO será renomeada para `ConsultaRadarHistorico`, NÃO ganha `clienteId`, continua exatamente como está hoje — incluindo a query pesada sem paginação em `HistoricoRadar/route.ts` (~23 mil linhas), que fica como dívida técnica pré-existente e alheia a este plano, não deve ser tocada por nenhuma sessão futura do Cliente Master. `radar_fiscal` idem, incluindo o `$queryRaw` direto em `AlphaConnect/page.tsx`.
   **Escopo real da Fase 3.4 (só `ConsultaPreAnalise`):** arquivos a tocar — `PreAnalise.ts` (`upsertConsulta` resolve `clienteId` por CNPJ), `gerar-ficha-server.ts` (idem, via `upsertConsulta`). `bpm/Empresas.ts` continua só leitura, sem mudança de lógica (já lê `consultaPreAnalise` por CNPJ, pode opcionalmente ganhar leitura via `clienteId` se decidido na implementação). Padrão de normalização de CNPJ decidido: só `replace(/\D/g,"")`, sem `padStart` — mesmo padrão já usado nas Fases 3.1-3.3, para manter consistência entre módulos do Cliente Master.
5. **Operacional** (`OperacionalClientes.clienteId` **obrigatório** — decisão do usuário, pergunta 4: `vincularEmpresaAoCliente` passa a resolver/criar `Cliente` antes de criar `OperacionalClientes`).
6. **Metas/Comercial** (`ContratoComercial.clienteId` **obrigatório, sem criação automática** — decisão corrigida 2026-08-11, pergunta 5: `criarContrato` busca/vincula `Cliente` já existente por CNPJ, bloqueia com mensagem clara se não encontrar; **18 CNPJs de contratos hoje sem correspondência em `clientes` precisam de saneamento manual antes desta fase**, maior volume de todo o plano; `criarRegistroClienteAPartirDeContrato` é reescrita para lidar só com `ClienteServico`). Maior superfície de Server Actions (11+ funções em `ContratoComercial.ts` + `Metas.ts` + adapters de Comissões que leem contratos).
7. **Comissões** (`CommissionEvent`, `BusinessProcess`, `EligibilityOverride`) — por último e com mais cuidado: é módulo financeiro, `clienteId` hoje é `Int?` solto (sem FK), e os 3 adapters (`cs-nps-adapter.ts`, `metas-adapter.ts`, `exito-detector.ts`, `process-adapter.ts`) precisam ser reescritos para consumir `Cliente`/`ClienteServico` em vez de `clientes`/`ContratoComercial` direto.

   **⚠️ Achado bloqueante do Scout (2026-08-14):** o campo `clienteId` nas 3 tabelas **hoje contém `ClienteServico.id`, não `Cliente.id`** — confirmado com dado real do Turso (263/263 casos testados). O `sync-engine.ts` sempre gravou o retorno de `buscarClientePorCnpjEServico` (um `ClienteServico.id`) nesse campo, apesar do nome sugerir `Cliente.id`. `exito-detector.ts` já documentava essa ambiguidade em comentário, preservada deliberadamente "por compatibilidade" durante a Fase 3.6, sem ser resolvida.
   **Decisão do usuário (2026-08-14):**
   - **Opção B escolhida:** o campo atual é renomeado para `clienteServicoId` (FK real para `ClienteServico`, mesmo valor, zero mudança de comportamento) e um `clienteId` **novo** é adicionado (FK real para `Cliente`, derivado via join a partir de `ClienteServico.clienteId`). Correlação por "mesmo serviço contratado" (usada para casar `CONTRACTING`↔`PROCESS_SUCCESS`) continua via `clienteServicoId`, sem reescrever a lógica de negócio existente.
   - **`BusinessProcess`/`EligibilityOverride` migram de schema mesmo estando vazias** (0 linhas em produção, nunca escritas por nenhum código — features planejadas, nunca ativadas): ganham a mesma dupla `clienteId`/`clienteServicoId` com `@relation` real, sem necessidade de backfill de dado (tabelas vazias). Prepara o terreno para quando a escrita for implementada, sem deixar uma 2ª rodada de migration pendente.
   **Volume real (Turso, 2026-08-14):** `CommissionEvent` 274 linhas (270 com o campo preenchido, 100% íntegras, 0 órfãs; `contratoComercialId` 56/56 batendo com `ContratoComercial.id` real). `BusinessProcess` e `EligibilityOverride`: 0 linhas cada.
   **Campos de snapshot confirmados intencionais** (preservar, não virar FK): `CommissionEvent.cnpj`/`razaoSocial`/`nomeFantasia`/`servico` — usados em busca textual, exibição de card e evento manual sem `Cliente` por trás (`CriarEventoFinanceiro`, único fluxo de escrita fora do sync automático, nunca preenche `clienteId`/`clienteServicoId`, precisa continuar nullable).
   **⚠️ Bug real encontrado e corrigido durante a migration de dados (2026-08-14):** a migration inicial confiou no valor antigo de `CommissionEvent.clienteId` (que virou `clienteServicoId`) para localizar o `ClienteServico` correspondente pelo ID. Isso quebrou silenciosamente: a recriação de `ClienteServico` na Fase 3.6 (autoincrement reiniciado do zero) fez os novos IDs colidirem com os antigos, mas apontando para **empresas diferentes** — 263 de 270 eventos (97%) ficaram vinculados à empresa errada até ser detectado por auditoria manual (leitura via Prisma comparando o snapshot `cnpj`/`servico` do evento contra o `Cliente`/`ClienteServico` resolvido pelo ID). Corrigido resolvendo TODOS os 270 eventos por CNPJ+serviço do próprio snapshot do evento (dado confiável, gravado no momento do evento), ignorando o ID antigo salvo — 269 resolvidos com granularidade de serviço exata, 1 resolvido só por `Cliente` (empresa) porque o serviço mudou de nome/tipo desde que o evento foi gerado. Validação pós-fix: 270/270 corretos, zero violações de FK.
   **Lição permanente para qualquer migration futura deste projeto:** quando uma tabela é recriada com IDs novos (autoincrement do zero), NUNCA copiar um FK numérico antigo de outra tabela sem revalidar contra um campo de negócio estável (CNPJ, chave natural) — o ID sozinho pode coincidir por acaso com um registro completamente diferente na tabela nova. Sempre preferir resolver por chave natural (CNPJ+serviço, celular, etc) em vez de reaproveitar o ID antigo diretamente, mesmo quando "parece" que vai bater.

Para CADA módulo desta lista, o ciclo completo é:
- Scout confirma que o levantamento desta sessão ainda bate com o código real (código muda entre o diagnóstico e a execução).
- Echo reescreve as Server Actions/queries listadas no levantamento (arquivo por arquivo, função por função) para usar `Cliente`/`ClienteServico` em vez de `clientes`.
- Vault aprova a migration real daquele módulo especificamente (ALTER TABLE adicionando `clienteId`, backfill dos valores, só depois disso — nunca antes — remoção das colunas antigas duplicadas), com backup dedicado.
- Forge roda tsc/lint/build.
- Probe verifica que a tela daquele módulo carrega os dados de empresa corretamente via `include: { cliente }`.
- Sage testa edge cases (CNPJ não encontrado, contrato sem cliente ainda, etc).
- **Anubis audita especificamente na Fase 3.1 (Parceiros)**: revisão de LGPD/exposição de dado pessoal concentrado em `Pessoa` (CPF de responsável legal + sócio + representante convergidos num único cadastro lido por múltiplos módulos) — ver seção 2.4a risco 3. Não é opcional, é a única fase deste plano com esse gate extra de segurança explícito.
- Só então o próximo módulo da lista começa.

### Fase 4 — Descontinuação de `clientes` (só depois de TODOS os módulos migrados)
1. Confirmar (via `PRAGMA foreign_key_list` em todas as tabelas, regra permanente desde o incidente de 2026-07-13) que nenhuma tabela do banco ainda referencia `clientes` pelo nome antigo.
2. Confirmar que nenhum arquivo de código ainda importa/chama `db.clientes.*` (grep final de varredura).
3. Vault aprova o `DROP TABLE clientes` (ou rename para `clientes_deprecated_2026xxxx` mantido por um período de segurança, em vez de drop imediato — recomendação: manter renomeada por pelo menos 30 dias antes do drop definitivo, dado o histórico de incidente).
4. Backup final dedicado antes do drop/rename.
5. Kowalski arquiva a sessão completa da migração em `journal.md`.
6. Scribe atualiza `architecture.md`/`codebase-map.md`/`components.md` com o novo modelo definitivo.

---

## 6. Riscos específicos já identificados (herdados do levantamento desta sessão)

1. **`excluirLogCS`/`excluirLogFeedback` usam `$executeRawUnsafe` com SQL cru** (`src/actions/Clientes.ts`) — não aparecem em busca por `db.log_cs.delete`. Se essas tabelas forem renomeadas, essas 2 queries quebram silenciosamente sem erro de tipo do TypeScript (SQL cru não é checado pelo Prisma Client). Precisam ser reescritas para usar o client Prisma normal (ganho colateral de segurança, já que `$executeRawUnsafe` é superfície de risco de SQL injection se algum dia receber input não sanitizado).
2. **`CommissionEvent`/`BusinessProcess`/`EligibilityOverride` já têm `clienteId` órfão hoje, antes mesmo desta migração começar** — precisa ser medido na Fase 1 (item 5) antes de decidir se a nova FK pode ser `NOT NULL` ou precisa ficar `Int?` permanentemente.
3. **`CommissionEvent.cnpj`/`razaoSocial`/`nomeFantasia` são snapshot intencional** (auditoria financeira) — não devem virar FK pura substituindo os campos, e sim GANHAR uma FK adicional (`clienteId → Cliente`) mantendo os campos de snapshot como estão. Confundir isso com "duplicação a eliminar" quebraria a integridade de auditoria financeira.
4. **`ObterDadosEmpresaCardBpm`** é a função mais complexa tocada por esta migração (junta `clientes`+`socios`+`consultaPreAnalise`+`radar_fiscal` com lógica de `cnpjsPossiveis`) — candidata a maior simplificação de código depois da migração (todo esse merge manual vira 1 `include` só), mas também candidata a maior risco de regressão se reescrita apressadamente. Reservar tempo de reconhecimento dedicado (Scout) só para essa função na Fase 3.2 (BPM).
5. **Import em massa do CS&NPS** (`src/lib/cs-nps/importar-dados.ts`) grava em `clientes`/`socios`/`log_cs`/`logFeedback` dentro de uma única `$transaction` — o novo fluxo de import precisa criar `Cliente` (ou reaproveitar existente pelo CNPJ) + `ClienteServico` na mesma transação, **e** resolver `Pessoa` por celular (reaproveitar se já existe, criar se não) + `PessoaClienteVinculo`, mantendo a garantia de atomicidade já existente. Planilha de import de "Sócios" (`Socios(cnpj, razaoSocial, nome, telefone, observacao, dataNascimento, vinculo)`) precisa de uma regra explícita para linha com telefone vazio ou duplicado contra outra `Pessoa` já existente (mesmo cuidado da pergunta 8/9 da seção 4, mas em fluxo de escrita contínua, não só no backfill único).
6. **`recalcularNivel` (Parceiros)** depende de contar indicações — `Indicacao.clienteId` é hoje `@unique` (1 indicação ativa por empresa). Ao trocar o alvo para `Cliente.id`, essa regra de negócio ("1 empresa, 1 parceiro indicador") deve ser preservada exatamente como está — é regra de produto, não acidente de schema.
7. **`Pessoa.celular @unique` cria um novo tipo de conflito de escrita que não existia antes.** Hoje, cadastrar/editar um sócio em `Clientes.ts` (`adicionarSocio`/`atualizarSocio`) nunca falha por causa de outro registro — cada sócio é isolado. Com `Pessoa` global, tentar salvar um celular que já pertence a outra pessoa (erro de digitação, ou a mesma pessoa sendo cadastrada de novo por engano em vez de vinculada) passa a ser um erro de constraint real. Toda tela/action que cria `Pessoa` precisa de UX explícita para esse caso: "esse celular já existe, vincular a pessoa existente em vez de criar nova?" — não pode só estourar erro 500 genérico.
8. **`PessoaClienteVinculo` herda a mesma armadilha de FK fantasma já vivida por `clientes`** (incidente de 2026-07-13) — qualquer rename/recriação futura de `Cliente` ou `Pessoa` precisa, por regra permanente já estabelecida, rodar `PRAGMA foreign_key_list` em TODAS as tabelas antes de qualquer `DROP TABLE`, agora incluindo explicitamente `PessoaClienteVinculo` na lista de tabelas a verificar.

---

## 7. Escopo explicitamente fora deste plano

- Não inclui a decisão de qual código roda a migração real (script Node pontual via `@libsql/client/web`, seguindo o padrão já estabelecido no projeto — `prisma db push`/`migrate` não alcançam o Turso remoto, ver `decisions.md` 2026-07-06).
- Não inclui cronograma de tempo/duração — cada fase é serial e só avança com aprovação explícita, sem prazo pré-definido.
- Não assume qual módulo o usuário quer priorizar primeiro na Fase 3 além da ordem sugerida por risco — o usuário pode reordenar.
- Não decide sozinho as 11 perguntas da seção 4 — são bloqueantes, não default silencioso. **Todas as 11 estão respondidas** (9 pelo usuário em 2026-08-08; a pergunta 9 respondida pela própria Fase 1 em 2026-08-10 com dado real: 11 duplicidades de 191 celulares, volume pequeno e gerenciável; a pergunta 11, nascida do achado real da Fase 1, respondida pelo usuário em 2026-08-10: `cnpj` nullable). **Fase 0 concluída — plano liberado para a Fase 2 (schema novo em paralelo).**

---

**Registrado por:** Bibble, 2026-08-08, a pedido do usuário (diagnóstico + plano de unificação em Cliente Master).
