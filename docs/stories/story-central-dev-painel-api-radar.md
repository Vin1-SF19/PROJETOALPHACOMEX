# Story — Central de desenvolvimento: Painel Alpha e API Consulta Radar

## Status

Ready for Review — integração local instalada; QA das ferramentas PASS (26 testes). Build global do Painel não aprovado por recursos do ambiente; publicação fora do escopo.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools:
  - verificacao-cli-deterministica
  - revisao-preservacao-instrucoes
  - validacao-worktrees
```

## Story

Como responsável técnico da Alpha Comex, quero começar a usar Claude Squad e Spec Kit no Painel Alpha e na API Consulta Radar por uma central local, para organizar especificações e tarefas e abrir o agente no repositório correto, preservando as regras e o trabalho existente.

## Origem e escopo autorizado

- Pedido do usuário: “vamos começar com o painel alpha entao e a api”. Refere-se à proposta anterior de central em `/home/ialpha/projetos/central-dev`, ferramentas globais e configuração por repositório.
- Repositórios do piloto: `/home/ialpha/projetos/alpha-comex/painel-alpha` e `/home/ialpha/projetos/alpha-comex/api-consulta-radar`.
- O usuário autorizou iniciar a adoção local. Esta story não inclui correção funcional do CRM ou da API, migração, deploy, reinício de serviço, commit ou push.
- Não há epic dedicado identificado para esta adoção. Os critérios abaixo derivam do pedido e da proposta aceita, sem atribuir requisitos a um epic inexistente.
- Não depende de concluir as stories de CRM atualmente em andamento; suas alterações devem ser preservadas integralmente.

## Acceptance Criteria

1. O CLI `specify` fica disponível para o usuário local por uma instalação global com `uv`, usando uma versão estável exata, cuja origem e versão sejam registradas. Não instalar a branch `main` sem pin nem substituir silenciosamente outra instalação existente.
2. A central local registra explicitamente apenas os dois repositórios do piloto, com identificadores estáveis e caminhos absolutos. Não transformar `/home/ialpha/projetos` em monorepo Git nem descobrir e inicializar automaticamente cópias antigas, diretórios de build ou outros projetos.
3. A central oferece CLI documentado para listar projetos (`list`), diagnosticar ferramentas e configuração (`doctor`), abrir o projeto com o agente escolhido (`open`) e consultar as tarefas/especificações do projeto (`tasks`). Projetos e agentes desconhecidos falham claramente, sem interpolação insegura em shell nem seleção silenciosa de outro diretório.
4. O diagnóstico informa Git, Claude Squad, tmux, gh, Python, uv, specify, Claude e Codex, verificando disponibilidade e requisitos efetivos da versão instalada. Funciona sem iniciar sessão de IA, chamada paga ou escrita em banco e permite identificar pré-requisito ausente.
5. Cada repositório tem configuração local do Spec Kit e integração para Codex e Claude compatível com a versão fixada. Os arquivos de especificação e tarefas pertencem ao respectivo repositório; não compartilhar uma `.specify` por symlink entre projetos.
6. `AGENTS.md`, `CLAUDE.md`, skills, comandos e configurações existentes são preservados. Qualquer inclusão de instruções é aditiva, delimitada e revisável; inicializar em área temporária e incorporar seletivamente quando necessário. Não aplicar `init --force` indiscriminadamente nem usar reset, clean ou stash para contornar trabalho em andamento.
7. O Claude Squad permanece com `auto_yes: false`, sem habilitar autoaceite experimental. A abertura ocorre no repositório escolhido e o fluxo documenta branch/worktree por tarefa, inclusive que alterações não commitadas do checkout de origem não são copiadas automaticamente ao worktree.
8. As instruções de adoção conectam especificação, plano e tarefas às stories AIOX existentes, preservam a Constitution e as instruções locais, os gates de qualidade e as autoridades Vault/Virtus/DevOps onde aplicáveis. Esclarecem que atalhos nativos de commit/push do Claude Squad não substituem esses gates nem constituem autorização para publicar.
9. Há um procedimento concreto documentado para tarefa que afete Painel + API: uma tarefa/branch/worktree por repositório, contrato compartilhado e ordem de validação explícitos. O piloto recomenda no máximo dois trabalhadores simultâneos inicialmente e não promete coordenação automática entre repositórios.
10. A entrega é validada com comandos determinísticos e testes locais de seleção de projeto, argumentos inválidos, diretório com espaços, ferramentas ausentes e ausência de efeitos colaterais nos modos de inspeção. A validação não inicia Claude/Codex pago, não consulta provedores externos de negócio, não altera banco, não reinicia API e não faz deploy, commit ou push.
11. Há evidências das versões e verificações executadas, limites reais e instrução de reversão da adoção local. A file list e o checklist da story refletem os arquivos efetivamente incorporados, distinguindo arquivos de usuário global de arquivos de cada repositório e da central.

## Tasks / Subtasks

- [x] Registrar autorização, dois repositórios e limites da adoção (AC 2, 10).
- [x] Preparar e validar esta story, sem modificar código de aplicação (AC 8, 11).
- [x] Registrar baseline de instruções/configurações e alterações em andamento nos dois repositórios (AC 6).
- [x] Conferir distribuição e fixar versão estável do Spec Kit; instalar com `uv` e registrar a versão efetiva (AC 1, 4).
- [x] Criar catálogo explícito da central e CLI com `list`, `doctor`, `open` e `tasks` (AC 2–4).
- [x] Gerar configuração Spec Kit para Codex e Claude em área isolada, revisar e incorporar somente os artefatos necessários em cada repositório (AC 5–6).
- [x] Preservar constituições e adicionar orientação de convivência Spec Kit/AIOX/Bibble por projeto (AC 6, 8).
- [x] Conferir configuração global do Claude Squad, manter autoaceite desligado e documentar particularidades de sessões/worktrees (AC 7).
- [x] Documentar fluxo simples e fluxo Painel + API, incluindo contratos e verificações antes de integração (AC 8–9).
- [x] Validar CLI com agentes simulados e repositórios temporários quando necessário; registrar comandos e resultados reais (AC 3–4, 10).
- [x] Conferir preservação dos arquivos existentes e ausência de segredo nos artefatos novos (AC 6, 10–11).
- [x] Registrar execução dos gates aplicáveis, indisponibilidades e falhas preexistentes sem declarar aprovação inexistente (AC 8, 11).
- [x] Atualizar file list efetiva, evidências e estado final desta story (AC 11).

## Dev Notes

### Contexto e fontes locais

- `.aiox-core/constitution.md#i-cli-first-non-negotiable`: a operação começa pela CLI; não há UI nesta story.
- `.aiox-core/constitution.md#iii-story-driven-development-must`: implementação associada a story, critérios claros, checklist e file list atualizados.
- `.aiox-core/constitution.md#ii-agent-authority-non-negotiable`: autoridades Git remotas permanecem com DevOps, respeitando também as exceções explicitamente definidas pelo fluxo local.
- `AGENTS.md#database-safety-and-backup-policy-non-negotiable`: Vault, backup e confirmação específica antes das alterações protegidas. Esta adoção não necessita tocar em banco.
- `AGENTS.md#quality-gates` e `.aiox-core/constitution.md#v-quality-first-must`: lint, typecheck, testes e build, registrando o que foi realmente executado e o que passou.
- `.aiox-core/core-config.yaml`: stories em `docs/stories`, CodeRabbit habilitado e coexistência de configurações para múltiplos agentes/IDEs. Não regenerar o framework nem substituir configurações existentes.

Não foram encontrados `accumulated-context.md`, `.aiox/gotchas.json`, `docs/architecture/index.md` ou os documentos de arquitetura/framework configurados para orientar especificamente esta adoção. A memória `.bibble/memory/architecture.md` registra arquitetura da aplicação, mas não define uma central Claude Squad/Spec Kit. Não há modelo de dados, endpoint ou componente de aplicação a alterar nesta story. Não foi inventado um contrato de API de negócio.

### Constatações do levantamento anterior

O levantamento em leitura identificou Claude Squad 1.0.20, tmux, gh, uv, Python, Claude e Codex instalados e `specify` ainda ausente. `/home/ialpha/projetos` e `/home/ialpha/projetos/alpha-comex` não são repositórios Git. As versões e caminhos precisam ser reconferidos na implementação.

Git worktree é uma cópia de trabalho ligada a uma branch do mesmo repositório. Isola arquivos versionados, mas não isola banco, credenciais, portas, processos ou serviços. Não copiar `.env` ou segredos automaticamente para sessões de agentes. Os requisitos de teste de cada projeto devem orientar a configuração local posterior.

### Referências técnicas externas

- [Claude Squad — README](https://github.com/smtg-ai/claude-squad/blob/main/README.md): sessões, pré-requisitos, worktrees, autoaceite e atalhos Git.
- [Claude Squad — inicialização](https://github.com/smtg-ai/claude-squad/blob/main/main.go): execução dentro de um repositório Git; o launcher seleciona o diretório primeiro.
- [Spec Kit — adoção em projeto existente](https://github.com/github/spec-kit/blob/main/docs/guides/existing-projects.md): adoção delimitada e preservação do projeto existente.
- [Spec Kit — integrações](https://github.com/github/spec-kit/blob/main/docs/reference/integrations.md): conferir os artefatos de integração presentes na versão estável efetivamente selecionada. Os caminhos podem diferir dos exemplos da branch `main`.

### Decisões de preparação

- [AUTO-DECISION] Qual epic/numeração usar? → Usar a story independente solicitada pelo coordenador, com origem no pedido explícito do usuário; não criar epic nem modificar backlog alheio.
- [AUTO-DECISION] Criar item remoto no ClickUp? → Não; não há epic/lista fornecidos e a missão é exclusivamente local. Nenhuma sincronização externa foi executada.
- [AUTO-DECISION] Qual versão estável instalar? → A implementação verificará e fixará a versão disponível; esta preparação não inventa um número de release.
- [AUTO-DECISION] Como validar abertura sem consumo pago? → Testar seleção de diretório e argumentos com executáveis simulados; uso real de IA fica para operação posterior.

## Testing

Os testes desta entrega verificam comportamento da central, não repetem lógica de aplicação. Usar ferramentas locais já disponíveis, sem introduzir dependência de framework desnecessária.

- `list`: exatamente os dois identificadores registrados e seus caminhos corretos; nenhuma inicialização automática de outros projetos.
- `doctor`: resultado coerente com ferramentas disponíveis e ausentes; apenas leitura, sem criar sessão tmux/IA nem revelar segredos.
- `open`: teste com agente simulado confirma cwd do repositório esperado, argumentos preservados e recusa de valores desconhecidos. Teste de caminho com espaços em fixture temporária.
- `tasks`: distingue repositórios, mostra material existente ou ausência informativa; nunca cria tarefa por inspeção.
- Preservação: comparar conteúdo de instruções e configurações anteriores, verificar alterações aditivas delimitadas e ausência de modificação dos arquivos de aplicação por esta adoção.
- Integração: conferir os artefatos Spec Kit gerados para Codex/Claude em cada projeto e `auto_yes: false` no Claude Squad, sem precisar iniciar os agentes.
- Gates do Painel: executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` conforme as regras locais; registrar falhas conhecidas/baseline e evitar atribuir mudanças concorrentes à adoção. Na API, verificar os scripts efetivos de `package.json` antes de executar, sem chamar o serviço de consulta real ou reiniciá-lo.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- Primary Type: Integration.
- Secondary Types: Architecture, configuração de ferramentas locais.
- Complexity: Medium — dois repositórios, configurações globais e convivência com regras existentes; nenhuma mudança funcional de produção.

### Specialized Agent Assignment

- @dev: implementação e verificações locais antes da conclusão.
- @architect: revisão de integração e da preservação das autoridades/instruções.
- @qa: validação dos cenários e evidências quando acionado pelo fluxo executor.
- @devops: revisão da instalação/configuração local quando necessária; ações remotas não fazem parte desta story.

### Quality Gate Tasks

- [x] Pre-Commit local: verificações determinísticas e revisão QA PASS; CodeRabbit indisponível. Não houve commit. Build global do Painel não aprovado, conforme evidências abaixo.
- Pre-PR e Pre-Deployment: não aplicáveis ao escopo atual, que não cria PR nem publica; reavaliar caso haja solicitação posterior.

### Self-Healing Configuration — Story 6.3.3

@dev em modo light, no máximo duas iterações e 15 minutos para achados CRITICAL. HIGH deve ser documentado e avaliado com o responsável pela revisão; não ultrapassar o escopo para corrigir mudanças alheias. Nenhum autoaceite ou publicação decorre desse processo.

### Focus Areas

- Seleção correta de repositório, tratamento de argumentos e ausência de shell injection.
- Preservação de arquivos existentes, configuração por projeto e rastreabilidade da versão instalada.
- Ausência de credenciais nos novos arquivos e de chamadas pagas na validação.
- Instruções de IA consistentes com AIOX, Vault e Virtus, sem prometer bloqueio técnico que a ferramenta não oferece.

## File List

### Central local — /home/ialpha/projetos/central-dev

- `central.py` — CLI e wrapper, versões, seleção Git, lock, bootstrap por manifesto.
- `projects.json` — catálogo dos dois projetos.
- `README.md`, `.gitignore`, `SPEC-KIT-LICENSE` — uso, manutenção, reversão e licença.
- `tests/test_central.py` — 26 testes determinísticos com executáveis simulados.
- `scripts/prepare-scaffolds.py` — geração dos adaptadores a partir do template 1.2.0.
- `manifests/painel-alpha.json`, `manifests/api-consulta-radar.json` — File List completa com SHA-256 de cada artefato incorporado.
- `scaffolds/painel-alpha/` e `scaffolds/api-consulta-radar/` — snapshots dos 42/44 arquivos enumerados nos manifestos.
- `reports/installation.json`, `reports/preservation.json`, `reports/worktree-smoke.json`, `reports/validation.md` — evidências.

### Painel Alpha

- `docs/stories/story-central-dev-painel-api-radar.md` — esta story.
- `docs/dev-tools.md` — fluxo local, tarefas em dois repos, limites e manutenção.
- `.specify/` — 21 arquivos: configuração/integration state, três manifests internos, constituição/template-state, seis scripts bash, cinco templates, workflow e registro.
- `.agents/skills/speckit-*/SKILL.md` — dez skills Codex.
- `.claude/skills/speckit-*/SKILL.md` — dez skills Claude (diretório local ignorado pelo Git existente).
- `.claude/skills/bibble-squad` — alias local para `../../.agents/skills/bibble-squad`; origem rastreada existente, sem cópia dos agentes.
- `.aiox/project-status.yaml` — estado gerado pelo AIOX atualizado durante ativação; nenhuma regra ou código alterado nele manualmente.

### API Consulta Radar

- `.specify/` — os mesmos 21 caminhos da distribuição, com constituição própria.
- `.agents/skills/speckit-*/SKILL.md` e `.claude/skills/speckit-*/SKILL.md` — dez skills por integração.
- `AGENTS.md`, `CLAUDE.md`, `docs/dev-tools.md` — arquivos novos com regras próprias para a API.

### Usuário local

- `/home/ialpha/.local/bin/specify` e ambiente uv de `specify-cli==1.2.0` — instalação nova, não versionada no projeto.
- `/home/ialpha/.local/bin/alpha-dev` — symlink novo para o launcher.
- `/home/ialpha/.claude-squad/config.json` — configuração nova: auto_yes=false, perfis via wrapper, branch_prefix alpha/.

## Dev Agent Record

**Escopo concluído:** piloto local instalado nos dois repos e central pronta para novas sessões. Nenhuma alteração funcional de aplicação, publicação ou operação de banco foi executada.

**Verificações:** 26 testes da central e revisão QA PASS. Doctor real verifica versões, snapshots e todos os arquivos locais. Integration status de ambos OK, zero modified/missing. Bootstrap real em dois linked worktrees com agentes simulados passou; nenhum .env copiado. Os dois worktrees temporários foram removidos por `git worktree remove` normal, após remoção apenas de novos arquivos idênticos aos manifestos e checagem de status limpo.

**Gates de aplicação executados:** Painel lint PASS (0 erros, 1193 avisos), typecheck PASS, `npm test` PASS (644 arquivos, 4847 testes passaram, 4 skipped e 1 todo). API typecheck e build isolado PASS; não há lint/test genéricos. Smoke externo não executado. Build do Painel em cópia isolada tentou duas vezes: EDQUOT em /tmp e heap V8 esgotado com limite de 3072 MiB em disco. Não declarado aprovado nem alterado package.json para contornar. CodeRabbit ausente; QA local revisou o código e os critérios do piloto.

**Preservação:** HEADs iguais ao baseline; 81 arquivos preexistentes do Painel e 22 da API conferidos. Apenas o estado gerado .aiox/project-status.yaml diferiu; instruções/configurações anteriores e arquivos de aplicação conferidos permaneceram idênticos. AGENTS/CLAUDE do Painel não foram modificados. Cópias de build descartadas; snapshots/relatórios preservados.

**Evidências:** `/home/ialpha/projetos/central-dev/reports/validation.md` contém resultados, limites e caminhos dos logs; os demais receipts JSON registram instalação, preservação e smoke. File List exata de scaffolds nos dois manifestos centrais.

**Reversão:** procedimento conservador no README da central; desativar entrada local, conferir origem/hash antes de remover somente artefatos novos intactos, preservar specs/stories/arquivos editados, estado de sessões e configurações preexistentes. Nenhuma reversão foi executada.

**Limite:** aprovação QA cobre tooling local. Não é aprovação global de build/publicação do Painel e não substitui os gates Vault/Virtus/DevOps.

## Validação de preparação — @sm

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado em YOLO à story completa.

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Story, origem explícita, escopo e dependências registrados |
| Orientação técnica | PASS | AC, contrato CLI, arquivos planejados e limites de integração |
| Referências | PASS | Fontes locais e documentação primária vinculadas com finalidade |
| Autocontenção | PASS | Decisões, worktrees, casos de erro e preservação explicados |
| Testes | PASS | Cenários determinísticos e gates por projeto definidos |
| CodeRabbit | PASS | Tipo, responsáveis, gates, self-healing e focos registrados |

Resultado: **READY para implementação**, mantendo Status Draft até o fluxo executor registrar sua transição. Clareza: 9/10. Nenhuma lacuna bloqueante; versão estável e nomes finais dos artefatos serão registrados após conferência pelo executor. Este parecer valida a preparação documental, sem afirmar instalação, teste de aplicação ou publicação.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-16 | 1.0 | Preparação do piloto local Painel Alpha + API Consulta Radar e aplicação do checklist de story | @sm River |

| 2026-10-16 | 1.1 | Piloto instalado, 26 testes e QA PASS, evidências/file list e limite de build registrados | DevOps / QA |
