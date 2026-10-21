# Ferramentas de desenvolvimento

## Staging antes de produção

Desde 2026-10-20, o fluxo autorizado é desenvolvimento → staging → validação → promoção para produção mediante pedido explícito do usuário.

- Ambiente de homologação: `https://staging.alpha-comex.com`, branch `staging` e ambiente customizado `staging` da Vercel. O serviço systemd e o script de releases locais são infraestrutura legada; não representam o staging ativo.
- Toda alteração de código ou configuração de negócio começa no staging. A publicação da branch `staging` não autoriza atualizar `main` nem promover um deploy para produção.
- CLI: selecione `.env.staging.local` explicitamente e confira o banco efetivo antes de qualquer escrita. `.env.local` ainda contém o acesso de produção e não deve ser usado por suposição. O Next em desenvolvimento usa o banco de staging configurado em `.env.development.local`; esses arquivos contêm credenciais e ficam fora do Git.
- A etapa/automação CRM é configuração do banco, portanto publicar código não a replica entre bancos. Aplique o ajuste administrativo delimitado no staging e confira os IDs de origem/destino nesse ambiente.
- Execute os gates do projeto e registre commit/deploy, URL e validações reais. Para a promoção futura, utilize a mesma versão homologada e revalide separadamente a configuração de negócio necessária em produção.
- Nunca sincronize banco inteiro, dados ou segredos de produção para staging como parte da entrega. Migrations e mutações em massa continuam sujeitas à política Vault do AGENTS.md.

Exemplo de prévia da configuração Assessoria Smart no staging:

```bash
node --conditions=react-server --import tsx scripts/configurar-assessoria-smart-revisao.mts --env-file=.env.staging.local
```

## Fluxo local de desenvolvimento

Esta configuração integra Spec Kit 1.2.0 (Codex e Claude) e Claude Squad.
Leia AGENTS.md, CLAUDE.md e .specify/memory/constitution.md antes de agir.
As ferramentas não substituem as instruções, autoridades ou aprovações locais.

1. Abra `alpha-dev open painel-alpha --agent codex` (ou `--agent claude`).
2. No Claude Squad, crie uma sessão com `n`: ela terá branch e worktree próprios.
   As configurações deste piloto são incorporadas pelo wrapper antes do agente.
3. Use `$speckit-specify`, `$speckit-plan`, `$speckit-tasks` e
   `$speckit-implement` no Codex; no Claude, `/speckit-specify`,
   `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`.
4. Vincule `specs/<feature>/` à story em `docs/stories/`. Não invente uma
   segunda tarefa divergente. Leia regras e memória antes de implementar.
5. Valide o resultado e registre os comandos realmente executados.

Para retomar uma especificação existente, informe ao agente o caminho completo
de `specs/<feature>/spec.md` e `tasks.md`; não assuma que a branch do Squad
identifica a feature. O Spec Kit persiste essa seleção em `.specify/feature.json`.
Inspeção: `alpha-dev list`, `alpha-dev doctor`, `alpha-dev tasks painel-alpha`.

### Trabalho no Painel e na API

Crie uma story/tarefa correspondente em cada repo, com referência recíproca.
Registre método, caminho, payload, autenticação e respostas num contrato em
`specs/<feature>/contracts/`, incluindo erros e compatibilidade. Primeiro valide
a API local com dados simulados, depois o consumidor do Painel e a integração.
Mudanças de contrato devem prever consumidores existentes e ordem de entrega.
Cada repo tem sua branch, testes e revisão; a central não sincroniza commits.

### Limites da sessão

O worktree parte do HEAD, sem as alterações não commitadas do checkout original.
O wrapper copia somente o snapshot de ferramentas enumerado no manifesto.
Não copia `.env`, tokens, dependências ou código em andamento. Dependências e
ambiente de teste precisam ser preparados separadamente para a tarefa.
Worktrees não isolam bancos, portas ou serviços; nunca assuma um banco de teste.
Comece com até dois agentes; a central impede duas interfaces gerenciadas ao
mesmo tempo. Instâncias abertas fora da central não estão sob esses controles.

`auto_yes` fica desligado. Não use `cs -y` nem flags de bypass dos agentes.
Os atalhos nativos `s` (commit/push) e `c` (checkout/commit) não substituem os
gates locais. Virtus continua manual quando aplicável; DevOps mantém sua
autoridade. Esta instalação não autoriza publicação, alteração de banco,
reinício de serviço ou acesso a provedores de negócio.

### Atualização e reversão

Os arquivos novos deste piloto constam em
`/home/ialpha/projetos/central-dev/manifests/painel-alpha.json`.
O snapshot é uma ponte até uma futura publicação revisada destas configurações.
Se um arquivo existente diferir, o wrapper para e preserva o arquivo; não
reaplique `specify init --here --force` para resolver o conflito. Revise e
regenere snapshots/manifestos ao atualizar a configuração.
Para desativar, feche as sessões, deixe de usar `alpha-dev` e siga o README da
central. Não exclua specs de trabalho ou arquivos modificados por terceiros.
