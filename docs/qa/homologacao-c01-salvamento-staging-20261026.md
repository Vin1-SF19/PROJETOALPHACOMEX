# Homologação C01 — dados registrados nas etapas sem formulário

Data: 2026-10-26. Ambiente: **staging** (`https://staging.alpha-comex.com`).
Versão publicada: `fb0e8546d75e95f96e780f2049b43d75f6466e15`.
Deploy informado READY: `dpl_BCXiMgDkxmJ7Sda528NqvEH3e7ek`.

## Resultado

**Leitura autenticada das cinco colunas concluída; edição e salvamento por UI bloqueados por ausência de fixture.** Todas as cinco etapas exibem zero cards. Não há card fictício com dados preexistentes nessas etapas para abrir o formulário e exercitar o salvamento. Portanto, este relatório não classifica o salvamento por UI dessas etapas como PASS.

| Pipeline | Etapa | Contagem na UI | Evidência |
| --- | --- | ---: | --- |
| Revisão de Radar | Sem viabilidade | 0 | [Tela](/tmp/alpha-salvamento-stage-20261026/c01-ui/radar-sem-viabilidade.png) |
| Financeiro | Stand By | 0 | [Tela](/tmp/alpha-salvamento-stage-20261026/c01-ui/financeiro-stand-by.png) |
| Financeiro | Cancelado | 0 | [Tela](/tmp/alpha-salvamento-stage-20261026/c01-ui/financeiro-cancelado.png) |
| Financeiro | Processos 2x1 | 0 | [Tela](/tmp/alpha-salvamento-stage-20261026/c01-ui/financeiro-processos-2x1.png) |
| Operacional | Cliente cancelado | 0 | [Tela](/tmp/alpha-salvamento-stage-20261026/c01-ui/operacional-cliente-cancelado.png) |

[Leitura estruturada sanitizada](homologacao-c01-20261026/survey.json). As cinco imagens permanecem fora do Git, na pasta de evidências sanitizadas `/tmp/alpha-salvamento-stage-20261026/c01-ui/`.

A navegação usou a sessão autenticada normal do staging e os links de pipeline do CRM. Foram lidas as colunas e suas contagens. Não foram criados, editados, excluídos ou movidos cards; nenhum card real foi aberto para esta prova. Não houve alteração de campos, configuração, permissões, banco ou runtime. As imagens ocultam somente a sobreposição visual da aplicação externa ao módulo durante a captura, para mostrar os títulos e contagens; nenhuma informação de sessão ou dado pessoal foi incluída.

## Evidência funcional anterior ao deploy

O candidato passou **38 testes em quatro arquivos**: os três arquivos `campos-registrados-sem-formulario*.test.ts` e a regressão existente `notificacoes-leads-sqlite.test.ts`. Lint dos seis arquivos C01, typecheck do candidato e diffcheck também passaram. A execução incluiu fixture SQLite privada; nenhum banco real foi usado nesses testes.

A correção mantém um único critério para leitura, salvamento e anexos: somente etapa com `formulario === null` **e zero configurações canônicas de campos** usa o fallback. O servidor revalida esse contexto e restringe o fallback aos campos com valores já registrados no mesmo card e pipeline, respeitando associação, visibilidade, editabilidade, somente leitura e ACL por perfil. Não são introduzidos defaults ou requisitos de entrada/saída nesse caminho.

Quando já existe composição canônica, ela continua usando a hidratação original. A regressão de Vendedor canônico sem linha de valor própria, inclusive o fluxo existente de handoff Financeiro/Operacional, passou. Campos canônicos configurados e seus anexos continuam no caminho original. A suíte existente não foi alterada para encobrir a regressão.

Log da execução focada no ambiente de trabalho: `/tmp/c01-candidate-canonical.log`. Manifesto do pacote funcional: `/tmp/alpha-salvamento-stage-20261026/c01-final-manifest.json`.

## Limite e próxima verificação

A comprovação por UI de editar, salvar, reabrir e confirmar os dados registrados requer um card fictício previamente disponível em cada etapa alvo. Criar um card na etapa inicial não resolveria essa ausência sem movimentá-lo; movimentações financeiras ou operacionais não foram autorizadas nesta homologação. Até existir uma fixture adequada, o resultado de salvamento por UI permanece **BLOCKED_NO_FIXTURE**. A passagem dos testes de backend não substitui essa homologação.
