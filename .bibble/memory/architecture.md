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

---

## Endpoints e Server Actions

<!-- Preencher conforme o projeto cresce -->

| Tipo | Caminho | Método | Auth | Descrição |
|------|---------|--------|------|-----------|
| Route Handler | `/api/...` | GET | Sim | |
| Server Action | `src/actions/apresentacoes.ts` | — | Sim | `ListarApresentacoes`, `CriarApresentacao`, `DuplicarApresentacao`, `ExcluirApresentacao`, `AtualizarStatusApresentacao` — ownership: autor ou Admin/CEO |
| Server Action | `src/actions/slides.ts` (Onda 2) | — | Sim | `ListarSlides`, `ObterSlide`, `CriarSlide`, `AtualizarSlide`, `ReordenarSlides`, `ExcluirSlide`, `DuplicarSlide` — ownership sempre sobe até `Apresentacao.autorId`/`colaboradores` via `checarOwnershipApresentacao()` (nunca confia no `Slide.id` isolado). `AtualizarSlide` valida `dadosJson` com `dadosSlideSchema` (Zod) antes de salvar. `ExcluirSlide` bloqueia se for o último slide da apresentação (regra de negócio confirmada com o usuário, ver `decisions.md`). |
| Server Action | `src/actions/apresentacao-temas.ts` (Onda 3) | — | Sim | `ListarTemas` (templates do sistema + temas próprios do usuário), `CriarTema`, `AtualizarTema` (templates só editáveis por Admin/CEO, temas próprios só pelo dono), `AplicarTema` (seta `Apresentacao.temaId`, ownership via `checarOwnershipApresentacao`). `ApresentacaoTema` (model existente desde a Onda 1) recebeu seu primeiro uso real: 5 templates seedados no Turso (Alpha Premium, Dark Glass, Corporate, Minimalista, Apple-style — `isTemplate: true`, `criadoPorId: null`). |

---

## Variáveis de Ambiente

<!-- Listar as env vars necessárias -->

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Conexão com banco |
| `ANTHROPIC_API_KEY` | API Claude (Bibble) |
