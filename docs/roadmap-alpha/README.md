# Roadmap Alpha — operação

## Acesso

- UI: `/PainelAlpha/Roadmap`.
- Leitura: usuários ativos com a permissão `roadmap`; Admin, CEO e TI possuem acesso administrativo.
- Mutações globais: somente Admin, CEO e TI.

## Fluxo

1. Um administrador cadastra o objetivo, escolhe um módulo e a prioridade global.
2. Objetivo e job de documentação são gravados na mesma transação.
3. A tarefa agendada `PainelAlpha-RoadmapWorker` consome a fila por prioridade.
4. O Qwen configurado em `ROADMAP_QWEN_MODEL` devolve um manifesto validado por Zod.
5. As fases são persistidas no banco e projetadas atomicamente em:

   `prompt-phases/roadmap-alpha/<module-key>/<objective-code>/rNNNN/`

6. Uma edição material cria uma nova revisão; mudar apenas a prioridade não regenera a documentação.

A UI consulta o estado automaticamente a cada dois segundos enquanto houver item na fila. O painel mostra a transição **Na fila → Documentando → Documentado** e exibe as fases assim que a publicação termina, sem recarregar a página.

O worker de documentação apenas cria os prompts. A aba **Produção local**, quando habilitada, executa separadamente as fases documentadas e mantém todas as mudanças sem commit para revisão humana.

Na criação e edição, os campos textuais possuem **Melhorar com IA**. O botão usa exclusivamente o Qwen 3.8 configurado para ampliar clareza e critérios verificáveis, preservando a intenção e sem salvar o texto até o administrador confirmar o formulário.

## Ciclo de vida dos objetivos

- **Pendentes**: objetivos ativos que ainda não entraram em implementação.
- **Em desenvolvimento**: o worker de Produção iniciou uma fase da revisão atual.
- **Concluídos**: todas as fases terminaram e o relatório final foi publicado.
- **Arquivados**: objetivos retirados da fila sem exclusão automática.
- **Excluídos**: lixeira com retenção de três dias. Depois desse prazo, a próxima consulta autenticada ao Roadmap remove definitivamente o objetivo e seus registros dependentes.

Arquivar ou excluir cancela jobs ainda abertos. Esses estados ficam fora da prioridade ativa; criar, editar ou reenfileirar um objetivo usa apenas a sequência dos objetivos ativos.

## Produção local com Bibble

- A navegação **Produção** aparece para Admin/CEO/TI e usuários com o override `roadmapProduction`.
- Somente Admin/CEO/TI veem **Configurar IA** e **Acessos**.
- Ollama/Qwen é o motor padrão. Codex CLI e Claude Code permanecem indisponíveis até que seus adapters seguros e CLIs sejam diagnosticados como prontos.
- A gaveta **Agentes** deriva dos skills instalados em `.claude/skills/bibble-squad/` e destaca agente, fase e atividade em andamento.
- O executor oferece apenas leitura/busca, escrita textual confinada e gates allowlisted. Não há tool de Git mutável, shell arbitrário, banco ou migration.
- Configuração, retomada, arquivos alterados e telemetria ficam em `.roadmap-production/`, ignorado pelo Git.

Comandos CLI:

```powershell
npm run roadmap:production:doctor
npm run roadmap:production:status
npm run roadmap:production:once
npm run roadmap:production:retry -- --execution=<objective-id>:v<version>
npm run roadmap:production:control -- --execution=<objective-id>:v<version> --action=pause
npm run roadmap:production:control -- --execution=<objective-id>:v<version> --action=resume
npm run roadmap:production:control -- --execution=<objective-id>:v<version> --action=retry
npm run roadmap:production:control -- --execution=<objective-id>:v<version> --action=exclude
```

Instalar ou atualizar o supervisor singleton:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-roadmap-production-worker.ps1 -Start
Get-ScheduledTask -TaskName PainelAlpha-RoadmapProductionWorker
Get-Content .roadmap-production/worker.log -Tail 30
```

Remover o supervisor:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/uninstall-roadmap-production-worker.ps1
```

O usuário revisa o working tree e realiza `git add`/`git commit` manualmente. O worker nunca executa essas operações.

Na **Fila por prioridade global**, cada execução possui controles administrativos de tentar novamente, pausar/retomar e excluir. Pausar ou excluir durante uma fase ativa é processado com segurança após a fase atual. Uma execução falha ou bloqueada permanece visível, mas não impede revisões novas ou outros objetivos de avançarem.

A fila apresenta cada objetivo como um accordion. Clicar no cabeçalho abre ou fecha sua gaveta de prompts; apenas um objetivo permanece expandido, priorizando automaticamente o que está em desenvolvimento. Dentro da gaveta, o prompt ativo recebe destaque e, ao clicar nele, seu Markdown ocupa o painel amplo à direita. Quando a última fase termina, o worker cria atomicamente `99-relatorio-conclusao.md` na pasta da revisão; esse documento registra resultado final, arquivos alterados, agentes, tentativas, o que foi feito e como foi feito, e também aparece como o último item clicável da execução.

Cada card de objetivo possui um único **Relatar erro**. O administrador descreve o problema da implementação completa, pode usar **Melhorar com IA** para tornar o feedback mais claro e confirma em **Refazer com este feedback**. O worker registra o relato, invalida temporariamente o relatório anterior e reenfileira todas as fases do objetivo. Todos os agentes recebem o feedback como requisito obrigatório dentro do escopo original. Na nova conclusão, `99-relatorio-conclusao.md` lista cada relato, se houve melhoria com IA, quando a correção foi concluída e quantas vezes o objetivo completo precisou ser refeito.

Reprovações de verificação entram no ciclo de autocorreção: o relatório do Probe volta para a última fase de implementação, o agente `dev` corrige os itens apontados e a verificação é executada novamente. Bloqueios de implementação e falhas transitórias do provider também são reenfileirados automaticamente após cinco segundos. A UI mostra **Correção automática** e o contador; após 12 tentativas da mesma fase, o worker preserva o bloqueio para intervenção administrativa, evitando um loop local sem controle. Erros de autorização, configuração inválida, objetivo substituído ou proteção de segurança nunca são repetidos automaticamente.

Se o manifesto atribuir por engano uma fase com título explícito de implementação ao Scout, Forge ou Probe, o worker mantém o agente solicitado no histórico, mas roteia a execução para Nova (frontend/UI) ou Echo (backend). Essa reconciliação também corrige execuções locais que já estavam bloqueadas antes da atualização.

Fases `CLOSURE` do Scribe que exigem README, CHANGELOG ou atualização de `.bibble/memory/` recebem escrita confinada para documentação. Se forem bloqueadas por modo read-only, o diagnóstico anterior é reutilizado e a própria fase é retomada automaticamente.

## Comandos

```powershell
npm run roadmap:doctor
npm run roadmap:check-modules
npm run roadmap:enqueue
npm run roadmap:worker:once
npm run roadmap:reconcile
npm run roadmap:export
```

Validação ponta a ponta descartável, somente quando não houver objetivos reais cadastrados:

```powershell
npm run roadmap:e2e:revision
```

O teste recusa execução se o Roadmap não estiver vazio e remove apenas o objetivo técnico que ele próprio criou.

## Worker persistente no Windows

Instalar ou atualizar a tarefa:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-roadmap-alpha-worker.ps1 -Start
```

Consultar estado e log:

```powershell
Get-ScheduledTask -TaskName PainelAlpha-RoadmapWorker
Get-Content .roadmap-worker/worker.log -Tail 30
```

Remover a tarefa:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/uninstall-roadmap-alpha-worker.ps1
```

O supervisor usa mutex singleton, reinicia o CLI após falha, rotaciona o log acima de 10 MB e encerra o processo filho quando o supervisor é parado. A tarefa também possui um watchdog de um minuto: se o processo for encerrado, o Agendador do Windows o inicia novamente automaticamente.

## Fonte canônica e recuperação

- O banco Turso/libSQL é a fonte canônica de objetivos, jobs, tentativas e artefatos.
- `prompt-phases/roadmap-alpha/` é uma projeção persistente e não deve ser editada manualmente.
- `npm run roadmap:reconcile` detecta arquivos ausentes ou divergentes.
- `npm run roadmap:export` recria projeções ausentes sem sobrescrever conteúdo divergente.
- `npm run roadmap:enqueue` recria jobs ausentes de objetivos ainda não documentados.

## Diagnóstico

Antes de investigar a fila, execute `npm run roadmap:doctor`. O comando confirma configuração, catálogo e tag exata do modelo sem imprimir token ou URL autenticada. Erros persistidos e logs usam apenas códigos sanitizados.

Estados de objetivo mais comuns:

- `PENDING`: aguardando worker.
- `DOCUMENTING`: geração em andamento.
- `RETRY_WAIT`: falha transitória aguardando backoff.
- `DOCUMENTED`: revisão atual publicada.
- `FAILED`: tentativas esgotadas; use **Gerar nova revisão** na UI após corrigir a causa.
- `SUPERSEDED`: objetivo arquivado ou revisão substituída.

## Banco e migration

A migration aditiva está em `prisma/migrations/20260815130000_add_roadmap_alpha/migration.sql`. O preflight, backup validado, aplicação e verificações remotas estão registrados em `docs/roadmap-alpha/migration-preflight-2026-08-15.md`.
