# ARCHITECTURE — Mapa de Arquitetura do Projeto

> Mantido por: Echo (backend) e Scribe (cartógrafo)
> Atualizar sempre que novos endpoints, actions ou schemas forem criados.

---

## Stack

<!-- Preencher após instalar no projeto -->

| Área | Tecnologia |
|------|-----------|
| Framework | Next.js + App Router |
| Auth | |
| Banco | |
| ORM | |
| Estilização | |
| Estado | |
| Upload | |
| AI | |

---

## Schema do Banco (tabelas principais)

### Módulo Extratos Bancários (reescrito em 2026-07-09)
```prisma
model Extratos {
  id, cnpj (unique), razaoSocial, nomeFantasia?, dataConstituicao?,
  municipio?, uf?, regimeTributario?, criadoPorNome?, analistaResponsavel?
  periodos PeriodosAnalise[]
  @@index([criadoPorNome]) @@index([razaoSocial])
}
model PeriodosAnalise { id, mes, ano, extratoId → Extratos, bancos BancosVinculados[] }
model BancosVinculados { id, bancoId, nomeBanco, logo, descricao?, anotacao?, periodoId → PeriodosAnalise, transacoes Transacao[] }
model Transacao {
  id, data DateTime?, dataOriginalTexto String?, descricao, valor Float,
  bancoId, mesReferencia, origemArquivo?, BancosVinculadosId → BancosVinculados
  @@index([BancosVinculadosId, data])
}
```
**IMPORTANTE — `Transacao.data` é `DateTime?` (nullable), NÃO `String`.** Migrado em 2026-07-09 (ver `decisions.md`). 273 registros legados têm `data = null` e o texto original preservado em `dataOriginalTexto` (formato "DD/MM" sem ano, sem como recuperar o ano com confiança). Qualquer código que itere transações DEVE tratar `data: null` (exibir "data desconhecida" ou ordenar por último) — nunca assumir que `data` sempre existe.

### Módulo Alpha Presentation Studio (Onda 1 — 2026-07-09)
```prisma
model Apresentacao { id (cuid), titulo, clienteNome?, autorId → usuarios, status (DRAFT|PUBLICADA|ARQUIVADA),
  temaId? → ApresentacaoTema, thumbnailUrl?, slugPublico? @unique, senhaAcesso?, expiraEm?
  slides Slide[], assets ApresentacaoAsset[], versoes ApresentacaoVersao[], colaboradores ApresentacaoColaborador[], comentarios ApresentacaoComentario[]
  @@index([autorId]) @@index([status]) }
model Slide { id (cuid), apresentacaoId → Apresentacao, ordem, nome?, transicaoEntrada?, duracaoAutoplay?, dadosJson Json
  @@index([apresentacaoId, ordem]) }
model ApresentacaoTema { id (cuid), nome, corPrimaria, corSecundaria, corAccent, radius?, fontePrimaria?, fonteSecundaria?, tokensJson Json, isTemplate, criadoPorId? }
model ApresentacaoAsset { id (cuid), apresentacaoId → Apresentacao, tipo (IMAGEM|VIDEO|MODELO_3D|AUDIO|FONTE), url, nomeOriginal, tamanhoBytes }
model ApresentacaoVersao { id (cuid), apresentacaoId → Apresentacao, dadosJson Json, criadoPorId, label? }
model ApresentacaoColaborador { id (cuid), apresentacaoId → Apresentacao, userId → usuarios, papel (EDITOR|VISUALIZADOR|COMENTARISTA), @@unique([apresentacaoId, userId]) }
model ApresentacaoComentario { id (cuid), apresentacaoId → Apresentacao, slideId? → Slide, autorId → usuarios, texto, resolvido }
```
**IMPORTANTE — `Slide.dadosJson` é um blob JSON único por slide** (árvore de componentes: textos, imagens, posições, animações) — decisão deliberada de NÃO relacionalizar em tabela `ComponenteSlide` (ver `decisions.md` 2026-07-09, "arquitetura de dados do slide"). Todo código que gera/lê esse JSON deve validar com Zod discriminated union por `tipo` de componente (recomendação de Scout, a implementar nas ondas seguintes do editor).

**Onda 4 (3D) — 2026-07-10:** `componenteSchema` (`src/lib/validations/slide-componentes.ts`) ganhou 3 novos tipos na union discriminada, todos renderizados via React Three Fiber (`@react-three/fiber` + `@react-three/drei`, instalados nesta onda — compatibilidade confirmada com React 19.2.3/Three 0.185.1 já em uso): `globo` (esfera com textura opcional, rotação automática, `marcadores[]` de lat/lng para uso comex/logística), `particulas` (campo de pontos animados — quantidade/cor/tamanho/velocidade), `objeto3d` (carrega modelo externo `.glb`/`.gltf` via `url`, com `autoRotacao`/`escala`). Sem mudança de schema Prisma — `dadosJson` continua sendo o único ponto de persistência. Ver nota em `known-errors.md` sobre `frameloop` do R3F e visibilidade dentro do iframe do painel.

---

## Endpoints e Server Actions

<!-- Preencher conforme o projeto cresce -->

| Tipo | Caminho | Método | Auth | Descrição |
|------|---------|--------|------|-----------|
| Route Handler | `/api/...` | GET | Sim | |
| Server Action | `src/actions/apresentacoes.ts` | — | Sim | `ListarApresentacoes`, `CriarApresentacao`, `DuplicarApresentacao`, `ExcluirApresentacao`, `AtualizarStatusApresentacao` — ownership: autor ou Admin/CEO |
| Server Action | `src/actions/slides.ts` (Onda 2) | — | Sim | `ListarSlides`, `ObterSlide`, `CriarSlide`, `AtualizarSlide`, `ReordenarSlides`, `ExcluirSlide`, `DuplicarSlide` — ownership sempre sobe até `Apresentacao.autorId`/`colaboradores` via `checarOwnershipApresentacao()` (nunca confia no `Slide.id` isolado). `AtualizarSlide` valida `dadosJson` com `dadosSlideSchema` (Zod) antes de salvar. `ExcluirSlide` bloqueia se for o último slide da apresentação (regra de negócio confirmada com o usuário, ver `decisions.md`). |
| Server Action | `src/actions/apresentacao-temas.ts` (Onda 3) | — | Sim | `ListarTemas` (templates do sistema + temas próprios do usuário), `CriarTema`, `AtualizarTema` (templates só editáveis por Admin/CEO, temas próprios só pelo dono), `AplicarTema` (seta `Apresentacao.temaId`, ownership via `checarOwnershipApresentacao`). `ApresentacaoTema` (model existente desde a Onda 1) recebeu seu primeiro uso real: 5 templates seedados no Turso (Alpha Premium, Dark Glass, Corporate, Minimalista, Apple-style — `isTemplate: true`, `criadoPorId: null`). |
| Route Handler | `POST /api/apresentacoes/gerar-slide` (Onda 5) | POST | Sim | Motor de IA para gerar o conteúdo de 1 slide a partir de prompt livre. Ownership (`checarOwnershipApresentacao`) verificado ANTES de qualquer chamada à IA. Streaming SSE (mesmo formato do chat do Bibble: `{type:"status"}`/`{type:"text"}`/`{type:"done"}`/`{type:"error"}`) — `text` carrega fragmentos do JSON sendo gerado; cliente só faz `JSON.parse`+Zod quando `done` chega. Reaproveita `callCompletion` (extraído para `src/lib/bibble/completion.ts` nesta onda) e o mesmo provedor Ollama local padrão do chat do Bibble (`process.env.BIBBLE_MODEL ?? "gemma4:e4b"`, servidor `ollama.alpha-comex.com` em produção — NÃO Anthropic direta, sem custo de API externa). IA escolhe 1 de 5 templates de layout fixos (`src/lib/apresentacoes-ia/templates-layout.ts`) e preenche só o conteúdo textual — nunca desenha coordenadas x/y/w/h livres. |
| Server Component | `GET /PainelAlpha/Apresentacoes/[id]/apresentar` (Onda 6, Fase 1) | — | Sim | Modo Apresentação fullscreen. Página fina com o mesmo padrão de ownership do editor, busca TODOS os slides ordenados + tema, passa para `ModoApresentacaoClient` (Client Component). Navegação por teclado (setas/espaço/Esc) + clique. Usa `RenderComponente` DIRETO, sem wrapper de seleção do Editor — primeira vez que o RenderEngine roda fora do Editor, resolvendo a lacuna de `stagger` não visível (Onda 3). Transição entre slides via `TransicaoSlide.tsx` (Framer Motion `AnimatePresence`), implementando `Slide.transicaoEntrada` de verdade pela primeira vez (fade/slide-horizontal; valores desconhecidos caem em fade). Fullscreen API tentada como melhor esforço, sem crítica se o browser negar. |

---

### Módulo CS&NPS — CNPJ duplicado permitido por serviço (migrado em 2026-07-13)
```prisma
model clientes {
  id ..., cnpj String (SEM @unique — era @unique até 2026-07-13), servicos String?
  ...
  @@unique([cnpj, servicos])  // constraint composta — permite múltiplos serviços do mesmo CNPJ
}
```
**IMPORTANTE — `clientes.cnpj` deixou de ser globalmente único.** Cada serviço contratado por um CNPJ vira um registro SEPARADO em `clientes` (não concatena string). A UI (`page.tsx`) mescla visualmente registros do mesmo CNPJ em 1 linha. Ligação com Painel de Metas via `buscarServicoContratadoPorCliente(cnpj, servicos)` (`src/actions/Clientes.ts`) — casa por CNPJ + nome do serviço normalizado contra `ContratoComercial`, trazendo `valorContrato`/`formaPagamento`/`closerNome`. Migration real aplicada no Turso via recriação de tabela (SQLite não permite DROP de UNIQUE inline) — ver `decisions.md` (2026-07-13).

**`clientes` ganhou 4 colunas (2026-07-13):** `municipio String?` (cidade, exibida ao lado de UF), `formaPagamento String?`/`valorContrato Float?`/`closerNome String?` (preenchimento MANUAL no cadastro do CS&NPS, fallback quando um registro não tem contrato correspondente vinculado no Metas). `CadastrarCliente`/`salvarAlteracoesGeral`/`criarRegistroClienteAPartirDeContrato` (todas em `Clientes.ts`) atualizadas para aceitar/persistir os 4 campos.

**Sincronização automática Metas → CS&NPS na CONFIRMAÇÃO DE PAGAMENTO (2026-07-13, corrigido na mesma sessão):** `confirmarFechamento` (não `criarContrato`) chama `criarRegistroClienteAPartirDeContrato({ cnpj, razaoSocial, servico, nomeFantasia, dataConstituicao, regimeTributario, uf, dataContratacao, socios })` (`src/actions/Clientes.ts`) — cria/reativa o registro em `clientes` só quando o pagamento é de fato confirmado, não na criação do contrato (contratos nunca confirmados não geram registro no CS&NPS). `dataContratacao` vem de `ContratoComercial.pagamentoConfirmadoEm`. Função também recebe `socios[]` opcional (migrado da lógica antiga) e retorna `clienteId` (usado para vincular `Indicacao` de parceiro quando `criado === true`). Via `findFirst` explícito: não existe → cria (com sócios); existe e "Arquivado" → REATIVA + atualiza campos fiscais/dataContratacao só se vier valor novo não-vazio; existe ativo → idempotente. Havia uma 2ª lógica de sincronização pré-existente (antes desta sessão) dentro de `confirmarFechamento` que reconsultava a Receita Federal e usava `findFirst` só por CNPJ (quebrada pela constraint composta) — foi REMOVIDA e substituída por esta chamada centralizada. Falha na sincronização NUNCA reverte o fechamento do contrato (`try/catch` isolado, só loga).

**`ContratoComercial` ganhou `dataConstituicao`/`regimeTributario`/`uf` (2026-07-13, migration ADD COLUMN nullable):** capturados pelo formulário do Metas (`ModalGerenciamentoLeads.tsx`) na mesma consulta `/api/ReceitaFederal` que já fazia (antes só usava razaoSocial/nomeFantasia da resposta) — sem chamada nova à API externa.

**⚠️ PENDÊNCIA DE SEGURANÇA REGISTRADA (Anubis, 2026-07-13):** a seção "Serviços Contratados" do modal do CS&NPS expõe `valorContrato`/`formaPagamento`/`closerNome` (dados do Metas) para qualquer usuário com a permissão `Cliente`, mas esses dados hoje só são visíveis no módulo Metas restrito a `allowedRoles: ['Lider Comercial']` (`modulos-registry.ts`). Decisão sobre restringir ou manter aberto foi **adiada explicitamente pelo usuário** — ver `decisions.md`. Não é permissão para deixar como está permanentemente.

## Variáveis de Ambiente

<!-- Listar as env vars necessárias -->

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Conexão com banco |
| `ANTHROPIC_API_KEY` | API Claude (Bibble) |
