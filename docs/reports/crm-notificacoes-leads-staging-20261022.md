# CRM — notificações de leads e recepção por setor no staging

Entrega publicada e validada no escopo descrito abaixo em **22/10/2026**, em https://staging.alpha-comex.com. Produção não foi publicada nem configurada por esta entrega.

## Comportamento entregue

A central existente reúne pendências de Instagram, site e encaminhamentos por setor, com detalhes e chegada. Instagram usa roxo; site comprovado usa azul; demais origens seguem o padrão. Ler, fechar toast ou limpar notificações comuns não resolve o lead. O clique abre o destino; assumir continua sendo uma ação explícita e autorizada.

Financeiro e Operacional recebem uma recepção pendente quando um encaminhamento cria o destino. Quem pode visualizar no setor recebe; a ação Assumir exige também elegibilidade, acesso à etapa e guardas de trabalho. Responsável técnico herdado não significa assunção. Responsáveis anteriores e vendedor comercial são preservados. Legados e cards criados manualmente não ganham pendência por inferência.

## Publicação e verificações

Feature `67f14b93`, integrada em `60ae49ff` com a data original de formulário Instagram de `f7ceefdb`, preservando ambas as alterações. O GitHub registrou Vercel **Deployment has completed** para `60ae49ff` e `dpl_x5PS1gz68aTR611tBtH3dBD2hSMa`; o HTML do domínio canônico referenciou o mesmo deployment, inclusive na segunda leitura. Raiz, providers, sessão anônima e leitura de banco `/api/broadcast` retornaram 200; CRM anônimo redirecionou ao login.

A API Vercel com credencial existente respondeu 403: não houve reautenticação nem alteração de credenciais. A prova operacional usa o vínculo commit/deployment no GitHub e o ID nos assets do domínio, sem alegar leitura nova dos metadados imutáveis de ambiente pela API. O perfil CLI de staging foi conferido por fingerprints privados antes de cada leitor; nenhuma variável de ambiente foi alterada.

| Gate real | Resultado |
| --- | --- |
| Base: typecheck oficial / lint / build supervisionado equivalente | Exit 0 nos três; lint com zero erros e 1.193 avisos existentes |
| Base: suíte completa com cobertura | 720 arquivos, 5.739 aprovados, zero falhas, quatro skipped e um todo |
| Integração preservadora: typecheck / lint dos cinco fontes afetados | Exit 0 |
| Integração: suíte completa com cobertura | 720 arquivos, 5.756 aprovados, zero falhas, quatro skipped e um todo |
| Custódia e merge | Fingerprints estáveis; caminhos sem sobreposição idênticos; três sobreposições conferidas por merge independente |
| Build combinado publicado | Conclusão Vercel e domínio correspondentes ao commit; sem reutilizar deploy de outro ambiente |

O build local combinado não foi repetido: QA aprovou o reaproveitamento dos builds-base e revisão dos hunks, condicionado à conclusão do build remoto final, cumprida. Tentativa frontend anterior com heap de 4 GiB terminou em OOM antes de diagnósticos; o gate oficial de tipos com 8 GiB passou. Não somar suítes focadas e globais como testes distintos.

## Validação remota efetiva

Admin real criou uma empresa claramente fictícia pela UI e encaminhou Comercial → Financeiro → Operacional pelas ações normais. Os dois quadros exibiram **Aguardando assumir**, os painéis mostraram o responsável comercial e o impedimento de claim para Admin fora do setor. Vendedor responsável exibiu nome na UI. A consulta autenticada de alertas do Admin completou três páginas sem pendências da fixture, conforme sua audiência.

Uma leitura independente confirmou três cards, três vínculos e duas recepções PENDENTE, sem assunção. Vendedor comercial permaneceu preservado, origem Orgânico e estados de elaboração/envio/assinatura/pagamento/NF vazios; nenhum documento ou anexo foi fabricado. Mover o Financeiro para a etapa Concluido não resolveu sua recepção nem concluiu seu lifecycle. O Operacional não recebeu um responsável financeiro inventado enquanto aquele setor ainda não havia assumido.

Diagnóstico CLI invocou os helpers canônicos com as permissões persistidas dos atores Financeiro e liderança Operacional, usando Prisma guardado somente leitura em todas as páginas e no singleton padrão do processo: **109 operações de leitura, zero writes, raw SQL, transações ou bloqueios**. Cada ator recebeu exatamente a pendência fictícia de seu setor e capacidade de assumir no próprio card; o setor oposto permaneceu negado. Isso comprova o read-model e sua autorização corrente, sem representar login, sessão ou claim real dessas contas.

O acesso CRM da liderança Operacional foi habilitado pelo CRUD administrativo normal já autorizado pelo usuário. Verificação independente confirmou um único override aditivo, preservando papel, status, permissões anteriores e regras de setor. Não houve SQL manual de escrita, migration, seed, backfill ou execução manual de worker/global.

## Limites e observações

- Ingestão ao vivo Instagram/site, toast multicliente e assunção positiva com sessões Financeiro/Operacional não foram exercitados remotamente; têm cobertura automatizada local de autorização, concorrência, navegação e conciliação. A fixture Comercial era nativa e atribuída ao Admin, não um lead virtual.
- Não houve pageerror JavaScript no navegador de homologação. Cinco respostas 503 de voz Bibble e avisos de geolocalização, allowfullscreen e descrição de diálogo foram observados; não declarar console/rede inteiramente limpos nem atribuir sua correção a esta entrega.
- O harness de captura de resposta após criar a fixture falhou, mas quadro e snapshot comprovaram uma única criação; não houve repetição. O primeiro diagnóstico CLI exigiu ativação do loader ESM TypeScript para um import dinâmico. Ambos são limites da automação de teste, não defeitos adicionais declarados do aplicativo.
- Evidências brutas, credenciais, dados pessoais e arquivos privados permanecem fora do Git. Rollback de código disponível na revisão anterior `f7ceefdb`; nenhuma operação de rollback de banco foi necessária.

[Story e parecer final de QA](../stories/story-crm-notificacoes-leads-sem-responsavel-20261022.md).


## Adendo — observação TI/Admin solicitada posteriormente

Após o fechamento em `60ae49ff`/`69047dee`, o usuário informou que TI não recebeu notificações e pediu a visualização. A audiência setorial anterior explica o resultado: a consulta Admin sem entradas registrada acima é **baseline histórico**, não a regra de leitura pretendida após esta correção.

TI e Admin passam a receber as pendências autorizadas de Instagram/site e recepções Financeiro/Operacional como observadores. Essa inscrição usa papel persistido e acesso vigente; não transforma observação em permissão de assumir. Claims nativos continuam exigindo setor, elegibilidade e as guardas existentes, inclusive Boas-vindas. CEO não entra automaticamente nessa nova exceção. Lookup é somente leitura; o clique não promove lead, assume card ou envia automaticamente. Primeira visualização/SLA preexistentes do detalhe permanecem preservados.

A correção local passou pelos quatro gates reais: typecheck oficial e lint exit0 (1.193 avisos existentes), novo build Prisma/player/Nextwebpack exit0 e suíte completa **720 arquivos/5.784 testes aprovados, zero falhas, quatro skipped e um todo**. Fonte congelada idêntica antes/depois. Segurança90 e SQLite9 são coberturas focadas incluídas no conjunto, não totais adicionais.

Um client Prisma compartilhado de outra worktree estava incompatível com a fixture; foi substituído apenas no ambiente de validação por client privado gerado do schema fonte, com output local explícito. Nenhuma dependência/versão, schema ou client compartilhado foi alterado; nenhum banco remoto foi conectado pelos gates.

Este registro antecede a publicação da correção e permanece **Ready for Review**, com o teste visual autenticado TI/Admin remoto ainda pendente. A conclusão do deploy, alias e teste visual será guardada em evidências privadas após execução, sem outro commit apenas para registrar o próprio SHA. Evidências locais: `/var/tmp/alpha-crm-notificacoes-ti-observador-20261022/forge/`. Produção permanece fora do escopo.
