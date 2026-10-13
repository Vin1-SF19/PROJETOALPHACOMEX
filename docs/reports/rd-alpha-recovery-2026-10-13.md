# Recuperação do histórico e dos serviços RD — 13/10/2026

## Estado

Correção de código implementada; plano especificamente autorizado pelo usuário em 13/10/2026 com “Sim autorizo”. Aplicação no Turso concluída e reconciliada após aprovação final Vault; publicação Vercel em preparação. A carga original continua com 1.212 cards e 10.712 eventos.

## Diagnóstico confirmado

- A produção consultada pelo usuário é a Vercel. O deployment registrado no GitHub às 21:47 UTC estava concluído, no commit `de4d771b`; a instância local 3300 usa outra release e não representa essa produção.
- O componente RD estava somente na aba Jornada. A aba Histórico e o extrator da timeline não incorporavam esses eventos.
- A importação consultava `deal_stages` sem `deal_pipeline_id`: esse endpoint retorna apenas as etapas do funil padrão. Foram encontrados 4.390 eventos sem nome de etapa. Referência: [RD CRM v1 — listar etapas](https://developers.rdstation.com/reference/crm-v1-list-stages).
- A consulta por todos os funis, seguida de consulta por ID das etapas históricas remanescentes, recuperou nomes para 4.389 eventos. Uma etapa responde 404; seu único evento é preservado com indicação amigável da informação ausente.
- As 3.605 atividades contêm texto. Algumas têm problemas de codificação na origem, como `emprÃ©stimo`; os textos brutos permanecem preservados.
- Todos os 1.212 cards importados estavam com `servico` nulo. Há 47 grupos de empresas com mais de um card, totalizando 97 cards; o agrupamento também considera identidade de empresa quando não existe CNPJ.

## Experiência corrigida

- Histórico unificado em ordem de data, incluindo ajustes de data feitos pelo usuário; registros sem data ficam ao final.
- Jornada preservada e timeline geral incluindo eventos RD.
- Passagens de etapa exibem nome, entrada e saída com horário de Brasília. Ausência de saída não é apresentada como prova de que o negócio ainda está na etapa.
- JSON, IDs técnicos e payload bruto removidos da interface. O servidor retorna somente o período original necessário à apresentação, mantendo o material bruto no banco.
- Ajustes exibidos por campo, com antes/depois, autor e data legíveis. Edição usa seletor de data/hora e preserva segundos quando a data não é alterada.
- Correção de codificação na apresentação, inclusive textos mistos e duplamente codificados, sem alterar os dados brutos.
- Erro de carregamento aparece com opção de tentar novamente, sem simular histórico vazio. Troca de card não reaproveita os eventos do anterior.
- Serviço dos cards RD aparece também em Novos leads para distinguir negócios da mesma empresa.

## Prévia revisável de dados

Plano privado, fora do Git: `database-backups/pre-change/rd-recovery/plan.json`.

Fingerprint: `edab800060d21f959c53df0780c2864e857b583e4571b607f86cd88f35fffb6d`.

| Operação | Quantidade |
|---|---:|
| Eventos cujo nome de etapa será recuperado | 4.389 |
| Evento de etapa indisponível, preservado sem inferência | 1 |
| Cards com serviço explícito identificável no negócio RD | 1.068 |
| Desses, com serviço correspondente em ClienteServico | 307 |
| Cards sem evidência suficiente/convergente, sem gravação | 144 |
| Grupos de empresas com serviços diferentes entre os negócios | 12 |
| Grupos com pelo menos um serviço não resolvido | 13 |
| Cards criados ou removidos por esta correção | 0 |

O serviço é derivado por mapeamento explícito dos produtos e do campo “Radar pretendido” do próprio negócio. Isso identifica o serviço da oportunidade, **não comprova contratação**. Não se marca um lead como contratado nem se cria contrato/ClienteServico a partir desse campo. Nos 307 casos correspondentes, o vínculo usa o cadastro de serviço já existente no Alpha. Produtos desconhecidos ou produtos/modalidade divergentes ficam para revisão; não se usa o funil ou apenas o CNPJ como escolha automática.

Os negócios distintos já têm cards separados; os 12 grupos com serviços diferentes serão diferenciados pelo serviço. Não criar mais cópias por simples repetição de CNPJ, nem mesclar/excluir negócios do mesmo serviço.

## Vault: execução e reversão

Banco afetado: Turso remoto configurado em `.env.local`, conferido por hash no plano/manifesto. Nenhuma mudança de schema. O RD permanece somente leitura.

O script `scripts/recuperar-rd-alpha.mjs` oferece:

```sh
node --import tsx scripts/recuperar-rd-alpha.mjs preview
node --import tsx scripts/recuperar-rd-alpha.mjs apply \
  --plan=database-backups/pre-change/rd-recovery/plan.json \
  --confirm=edab800060d21f959c53df0780c2864e857b583e4571b607f86cd88f35fffb6d \
  --backup=database-backups/pre-change/painelalpha_turso_pre_change_2026-10-13T22-29-47-346Z.sql
node --import tsx scripts/recuperar-rd-alpha.mjs verify --plan=database-backups/pre-change/rd-recovery/plan.json
node --import tsx scripts/recuperar-rd-alpha.mjs rollback \
  --plan=database-backups/pre-change/rd-recovery/plan.json \
  --confirm=rollback:edab800060d21f959c53df0780c2864e857b583e4571b607f86cd88f35fffb6d \
  --backup=database-backups/pre-change/painelalpha_turso_pre_change_2026-10-13T22-29-47-346Z.sql
```

Aplicação: atualizações de `projectedJson` restritas aos eventos selecionados, com inserção de auditoria em `BpmEventoExternoCorrecao`; atribuição de `BpmCard.servico` antes nulo, inserção de contexto em `BpmCardServicoContexto` e histórico em `BpmCardHistorico`. Nenhum payload original, cliente, etapa atual, responsável ou contrato é sobrescrito.

As transações usam lotes de até 25 itens, com leituras de guarda e escritas dentro da mesma transação. Uma interrupção ou conflito reverte o lote aberto; lotes já confirmados permanecem retomáveis. A versão inicial por item foi interrompida por lentidão do transporte e substituída por lotes, sem mudar o plano autorizado. Interrupção ou conflito preserva o que já foi confirmado e interrompe o restante; o mesmo plano é retomável por IDs de auditoria sem duplicar operações. O script compara origem, payload, estado anterior, versão e vínculo de serviço antes de cada alteração. A verificação distingue “aplicado anteriormente” de “continua coincidindo com o plano”, preservando edições posteriores.

Rollback seletivo restaura somente projeções/serviços que ainda coincidem com a correção aplicada, remove apenas o contexto de serviço criado por ela e acrescenta auditoria de compensação. Bloqueia diante de alterações posteriores detectadas. Não restaura integralmente o banco sobre trabalho novo. Uma edição de serviço seguida de retorno aos mesmos valores não é identificável por versionamento nesse modelo; revisar uso operacional antes de autorizar rollback.

Riscos: lote parcialmente aplicado se houver interrupção, alteração concorrente que exija nova prévia e serviços sem evidência suficiente que continuam pendentes. Não há indisponibilidade planejada. Alternativa: publicar apenas a apresentação amigável e manter a correção dos dados aguardando autorização.

A revisão Vault identificou e levou à implementação do rollback, da revalidação de vínculos inicialmente nulos e da distinção entre ajustes automáticos e humanos para novas prévias. Backup completo verificado e confirmação específica são necessários antes de executar a gravação.

Revisão Vault final: APROVADO para aplicação do fingerprint acima após confirmação explícita do usuário (“Sim autorizo”). Pendências técnicas resolvidas. A verificação também conta os contextos/vínculos correspondentes ao plano, exceções ainda sem serviço e a presença do evento de etapa indisponível.

## Backup

Backup completo criado às 22:29 UTC em 13/10/2026 e verificado:

- Dump: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-13T22-29-47-346Z.sql`.
- Manifesto correspondente `.manifest.json`, com identidade do banco conferida por SHA-256 da URL, sem registrar credenciais.
- 336 tabelas, 243.974 registros, 301.179.793 bytes.
- SHA-256: `cb32991988570ccf1aab7f1cfc5e03356408f58efdac3f8676421c01fe157854`.
- Restauração SQLite local concluída: `integrity_check` aprovado, `foreign_key_check` sem violações, contagens/hash/tamanho coincidentes.
- As primeiras exportações sofreram desconexão do transporte. O fallback HTTP foi ajustado para ler páginas ordenadas dentro da mesma transação e registrar a identidade do banco no manifesto.
- Verificação antes da aplicação: 1.212 cards, 10.712 eventos, nenhum registro ausente, nenhum original alterado e zero correções deste plano aplicadas. Não houve escrita remota durante a preparação.
- Revalidar idade de até 48 horas e integridade antes de aplicar. Rollback exige autorização própria e backup válido do estado imediatamente anterior à reversão, se já houver uso operacional posterior.

## Resultado da aplicação autorizada

- Execução concluída em 13/10/2026. Uma falha inicial de conexão foi retomada; 107 eventos já confirmados foram reconhecidos, seguidos de 4.282 eventos restantes e 1.068 serviços. Nenhuma duplicação de auditoria.
- Vault revisou e aprovou também a otimização em lotes de até 25 itens, sem alteração do fingerprint ou do escopo autorizado. Nove testes CLI passaram, incluindo conflito atômico no lote e retomada entre lotes.
- Reconciliação final: 1.212 cards e 10.712 eventos; 4.389 correções de etapa aplicadas e coincidindo com o plano; 1.068 serviços e 1.068 contextos coincidindo com o plano.
- Dos contextos previstos, 307 usam vínculo com serviço já existente no Alpha e 761 conservam apenas o nome do serviço da oportunidade.
- As 144 exceções continuam sem atribuição; o evento de etapa indisponível permanece presente.
- Zero registros ausentes e zero alterações nos payloads originais verificados por hash contra o plano.
- Evidência local agregada: `/tmp/rd-recovery-after-apply.log`; plano e backup permanecem privados, fora do Git.

## Validação

- Build de produção concluído. Avisos preexistentes de cache webpack/PDF.js.
- Lint: zero erros; 1.192 avisos preexistentes.
- Typecheck: passou.
- Testes direcionados: 53 passaram, incluindo nomes de etapas, API/paginação, acesso, serviços, retomada, backup inválido, rollback, conflitos, apresentação sem JSON e acentos.
- Primeira suíte completa: 4.493 passaram; duas falhas já existentes em `tests/builder/embed.test.ts` por URLs relativas versus absolutas no happy-dom. As duas assertivas foram corrigidas para ler os atributos declarados, sem alteração de comportamento do Builder. A execução seguinte passou 4.499 testes em 608 arquivos.
- Após os ajustes finais de rótulos/serviço/autoria, build, lint e typecheck passaram novamente. Uma tentativa de suíte foi invalidada por outra execução concorrente apagando `coverage/.tmp`; o teste de Alpha Catcher que oscilou nessa execução passou isoladamente (5/5). A suíte final usou diretório de cobertura exclusivo: 608 arquivos aprovados, 4.506 testes passaram, quatro ignorados e um TODO. Alterações concorrentes de Alpha Catcher não integram este commit.
- CodeRabbit CLI ausente. O runtime canônico `Layer2PRAutomation.runCodeRabbit` retornou `pass: true, skipped: true` pela degradação prevista em `.aiox-core/core/quality-gates/layer2-pr-automation.js`; nenhuma revisão automatizada CodeRabbit foi simulada. A revisão manual corrigiu a exposição de evidências/códigos na auditoria de serviços; os testes de descritores passaram.
- Renderização testada com o exemplo de datas fornecido pelo usuário; sem payload/IDs e com acentos corretos. Teste autenticado na Vercel ainda depende da publicação.
