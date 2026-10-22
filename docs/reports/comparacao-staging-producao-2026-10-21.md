# Comparação staging e produção — 21/10/2026

**Resultado: produção atualizada; aplicação e testes equivalentes ao staging validado.** As correções auditadas do CRM e a ordenação concorrente de cards/leads mais recentes primeiro estão publicadas, preservando histórico, configurações próprias e dados dos ambientes.

## Comparação e integração

| Marco | Staging | Produção |
| --- | --- | --- |
| Comparação inicial | `f8ef7312` | `31151e2a` |
| Correções auditadas | `02788143` + documentação `f8ef7312` | merge `5fd0d1c2`, READY e smoke aprovado |
| Ordenação concorrente | `347c61a4`, READY | `824db63c`, descendente de `5fd0d1c2`, READY |

Main tinha árvore idêntica à base `9d44e969`; faltavam 55 caminhos das correções auditadas. O merge `5fd0d1c2` preservou os pais `31151e2a` e `f8ef7312`. Durante o deploy, outro fluxo autorizado publicou a ordenação em staging e depois em produção `824db63c`, sobre esse merge. Aguardou-se o owner, preservando sua entrega; não houve force push nem descarte de trabalho concorrente.

**26.435 entradas Git não documentais** são idênticas entre `824db63c` e staging `347c61a4`: fontes, testes, scripts, Prisma, autenticação, dependências e entradas de build. Apenas duas stories diferiam nesse marco. O fechamento documental posterior mantém a aplicação inalterada. Não houve implementação nova nesta operação de promoção.

## Gates e configuração

Correções: typecheck/lint exit 0 (1.193 avisos existentes); suíte com 686 arquivos/5.278 testes aprovados, quatro skipped e um todo; build integral exit 0 em 221 s. A execução equivalente usa fases Prisma/player/Next oficiais, heap de 4.096 MiB em vez de 3.072 por restrição conhecida, sem alterar fontes/configuração.

Conteúdo combinado com ordenação: reuso transparente dos quatro gates executados pelo outro owner no staging exato `347c61a4`: lint/typecheck/build exit 0 e 688 arquivos/5.287 testes aprovados, quatro skipped e um todo. A primeira suíte teve timeouts CLI durante concorrência; o retry sem mudança de fonte/testes e sem gates concorrentes passou. Estes números não representam nova execução nesta worktree. QA ratificou a equivalência imutável. CodeRabbit indisponível no caminho configurado; Forge, QA e arquitetura independentes aprovados.

Produção recebeu builds Git próprios, target production, sem custom environment staging. Bancos separados por fingerprints privados: `sameDatabaseUrl=false`; ambos perfis correspondem às referências esperadas; metadados ENV inalterados. Limite: staging sensitive não admite leitura de volta na API, usando-se fingerprint do envio verificado, perfil CLI e escopos efetivos. Nenhuma variável, banco, dado ou artefato compilado de staging foi copiado para produção.

Inspeção SELECT-only em produção: 23 tabelas sem colunas esperadas ausentes; três regras com fontes/destinos ativos; Smart preserva ID próprio. Grafos/gatilhos aprovados pelos schemas reais. O responsável específico do grafo central Financeiro→Operacional permanece configurado; o legado/Admin mantém seu fallback anterior. Nenhuma migration, escrita de dados ou execução de worker.

## Publicação e smoke

Produção `dpl_Hd9KHDcuQkfmmJTRxKp5wkqCsukG`, READY, Git SHA `824db63caa1726aeb4d3ff36e40f6b7a0f611eb8`, target production. Staging `dpl_Gb3owd49fCsza2MfEHFKXW2AcPbp`, READY, SHA `347c61a4f54365715f50bc3a5a82375d938ebd3d`, custom staging. Ambos aliases de produção e o target efetivo do projeto conferidos.

Em `https://painel.alpha-comex.com` e `https://painel-alpha-projeto.vercel.app`: raiz/login 200; health/version 200 com SHA `824db63c`; broadcast/banco 200 sem erro; providers credentials e sessão anônima 200; CRM sem sessão 307 para `/?acesso=bloqueado`; três chunks públicos 200 por host. Somente GET; corpos com conteúdo real descartados.

Não se reproduziu E2E autenticado em produção nem se criaram/moveram cards, aprovações ou cobranças. O percurso Admin com três cards, duas execuções e três vínculos, com replays sem duplicação, continua evidência do [reteste no staging](validacao-correcoes-crm-2026-10-21.md). Voz externa 503, latência e cobertura remota de usuário comum/Smart/parceiro conservam os limites anteriores.

## Rollback e rastreabilidade

Rollback de código da ordenação: release CRM saudável `5fd0d1c2` / `dpl_HAMBD1DGJS2dDFjD84KpRfSNkHtZ`. Baseline anterior: `31151e2a` / `dpl_3b5bm53F5xT1mQYsNmZuBwuQzhYh`. Reassociar apenas aliases de produção ao deployment saudável ou publicar reversão rastreável com ENV própria; nenhuma restauração/cópia de banco integra esse rollback.

[Story da promoção](../stories/story-promocao-correcoes-auditoria-crm-producao-20261021.md). Evidência operacional privada e sanitizada em `/var/tmp/alpha-comparacao-promocao-20261021/`: comparação Git, gates, leitura de configuração, aliases e smokes. Worktrees e alterações alheias preservadas.
