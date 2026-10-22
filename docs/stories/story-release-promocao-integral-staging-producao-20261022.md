# Story: Release — promover integralmente staging aprovado para produção

## Status e responsáveis

Ready for Review — promoção do **código** de staging para produção explicitamente autorizada pelo usuário em **2026-10-22 às 20:18 UTC**. União integral preparada em checkout isolado; todos os gates locais concluídos, publicação/validação integrada no staging em andamento. Produção ainda sem publicação ou DDL. Autorização genérica de código não substitui consentimento específico para DDL/migração ou operação de banco coberta pelo AGENTS.

`@sm` prepara story; `@devops` inventaria versões/deployments, integra/publica e verifica; `Vault` confere estrutura/backup/plano de banco; `@qa` valida o artefato e a entrega. Esta story não executa código, commit, push ou deploy na preparação.

## Story e autorização

**Como** responsável pelo painel, **quero** promover integralmente o conteúdo aprovado de staging para produção, **para que** a versão aprovada esteja disponível no ambiente oficial, preservando os dados e alterações exclusivas de produção.

Pedido explícito: **“promova tudo que esta em staging para produção, foram aprovados”**. A autorização abrange a promoção de código e publicação em produção após pré-requisitos verificados. Não pedir nova aprovação genérica para o código já autorizado; eventual aprovação adicional deve apontar a alteração específica de banco e sua regra aplicável.

## Snapshot e escopo a fechar pelo preflight

- Conferir remotamente branch staging, branch main, deployments/aliases ativos e ambientes efetivos, sem presumir que `63612d76` seja o staging mais recente ou que main corresponda ao runtime atual. Registrar SHA completo/ID de deployment e instante do inventário para ambos os ambientes.
- Congelar um SHA concreto de staging como fonte da promoção e enumerar **todos** os commits/diffs em relação à produção/main. A promoção é integral: não selecionar apenas a feature do editor nem omitir mudanças concorrentes aprovadas de staging.
- Identificar commits/runtime exclusivos de produção/main e preservá-los por integração normal e revisão de conflitos, sem force push/reset destrutivo. O artefato candidato pode diferir do snapshot de staging para preservar essas mudanças; nesse caso, testar a árvore resultante e explicitar a diferença.
- Preservar as duas stories anteriores com alterações locais e outros arquivos compartilhados/dirty; não presumir que todo dirty local integra staging aprovado. Trabalhar em candidato isolado e definir File List/manifesto da release a partir dos SHAs conferidos.
- Manter banco/dados/credenciais/ambiente de staging separados de produção. Não importar leads fictícios, copiar banco/dados, arquivos de ambiente ou segredos de staging para tornar produção parecida.

## Acceptance Criteria

1. Registrar snapshot verificável do staging aprovado e da produção anterior: SHAs completos, deployment/estado READY, aliases, ambiente e ponto de rollback. Conferir o runtime ativo além das branches; qualquer divergência branch/runtime é resolvida/documentada antes de promover.
2. Gerar manifesto de commits/arquivos e mapa de diferenças do snapshot staging para produção/main. Conservar alterações exclusivas do main/runtime oficial e todo conteúdo aprovado do staging; conflitos são resolvidos no candidato revisável, sem perder funcionalidades concorrentes. Reinspecionar remotos antes do push para não publicar sobre avanço desconhecido.
3. Executar lint/typecheck/test/build exigidos na árvore exata candidata, ou reaproveitar evidência somente quando houver identidade verificável dos bytes executáveis e contexto relevante. Registrar comando, SHA e resultado real; não confundir build local equivalente com script remoto padrão nem promover artefato não coberto pelos gates.
4. Reaproveitar a homologação de staging do editor (`63612d76`, QA PASS e 14 verificações autenticadas) apenas se os arquivos/contratos correspondentes estiverem preservados byte a byte. Mudança material posterior ou conflito exige validação pertinente adicional; essa evidência não comprova automaticamente todos os outros diffs da release integral.
5. Vault realiza inventário somente leitura da estrutura real de produção, incluindo coluna opcional `Cliente.perfilCadastralJson`, tabelas/constraints necessárias e eventual estado de migrations/configurações. Não assumir que uma mudança já aplicada em staging também exista em produção. Registrar somente metadados/evidências sem dados pessoais ou segredos públicos.
6. Se faltar coluna/tabela/pré-requisito estrutural em produção, preparar plano exato com ambiente/banco, comando, impacto/risco, alternativa e rollback, apoiado em backup **completo e verificado de produção com até 48 horas**. Pedir consentimento específico após o resultado concreto e relatório Vault. **Não executar DDL/migration/seed/backfill nem publicar código incompatível antes dessa aprovação**. Se a estrutura já existir corretamente, registrar o fato sem reaplicar DDL.
7. Inventariar diferenças de configuração/dados essenciais ao runtime entre ambientes sem copiar dados em massa. Configuração necessária recebe plano explícito e validação de ambiente/escopo; mudanças sujeitas à política de banco seguem o respectivo gate. Configuração desconhecida, compatibilidade insuficiente ou dependência ausente bloqueiam a publicação até resolução verificável.
8. Publicar pelo fluxo de `@devops` somente após gates e pré-requisitos aprovados. Confirmar novo deployment **READY**, SHA exato, alias de produção e ambiente corretos. Preservar arquivos de ambiente/segredos e serviços externos fora das mudanças necessárias; produção não recebe fixtures, contatos/leads ou dados de staging.
9. Após a publicação, executar smoke remoto e verificação autenticada **somente leitura** das rotas/funcionalidades afetadas, sem criar lead/empresa de teste ou alterar registros reais em produção. Conferir ausência de erros relevantes e preservação dos dados/configurações e serviços fora do escopo. Distinguir teste de leitura de fluxo de escrita não exercitado em produção.
10. Capturar deployment anterior e roteiro de rollback antes da promoção. Em falha, preferir reatribuir o deployment/código oficial anterior compatível e manter coluna opcional aditiva; não executar DROP, reset de banco, restauração integral ou reversão de dados silenciosamente. Incidente e eventual rollback devem ter recibo verificável.
11. QA avalia manifesto/diff, gates da árvore promovida, equivalência com staging e smoke/checagens autenticadas finais; registrar limites reais da validação. Não declarar sucesso só por push concluído ou por um deployment que ainda esteja construindo.
12. Encerrar com SHA/deployment efetivamente promovidos, resultado de QA/checagens, alterações de banco/configuração de fato executadas e limitações pertinentes. Atualizar checklist/File List/evidência da release sem versionar dumps, credenciais ou dados pessoais. Preservar stories/arquivos dirty alheios; não usar atualização documental como motivo para ciclo extra de deploy.

## Plano de execução

1. DevOps conclui preflight somente leitura e fixa fonte/destino/rollback atuais.
2. Preparar candidato isolado integral, manifesto e revisão de conflitos/preservação de main.
3. Concluir gates/QA de código e Vault de produção; apresentar somente eventual pedido específico de banco que ainda faltar.
4. Após cumprir os pré-requisitos, publicar o candidato autorizado, conferir READY/alias e validar produção por leitura.
5. Registrar evidência final e encerrar; se falhar, aplicar o rollback aprovado de código sem alteração destrutiva de dados.

## Tasks / Subtasks

- [x] Registrar autorização explícita de promoção integral de código às 20:18 UTC e distinguir consentimento específico de banco.
- [x] Registrar staging/produção separados, preservação de mudanças exclusivas/dirty e validação sem leads de teste em produção.
- [x] Concluir preflight de branches/runtimes/aliases e fixar snapshot completo de staging/destino/rollback.
- [x] Enumerar todos os commits/diffs e preparar candidato integral preservando main.
- [ ] Concluir inventário Vault de produção, backup/plano e eventual consentimento específico para DDL necessário.
- [ ] Conferir configuração/tabelas/coluna e demais pré-requisitos do artefato promovido.
- [ ] Concluir gates e QA da árvore candidata, com reutilização de evidência somente quando comprovadamente aplicável.
- [ ] Publicar produção, confirmar deployment READY/SHA/alias e executar smoke/validação autenticada somente leitura.
- [ ] Registrar QA final, preservação de dados/serviços, resultado e File List definitivos.

## File List inicial

- `docs/stories/story-release-promocao-integral-staging-producao-20261022.md` — autorização, critérios e plano inicial. Adaptar após preflight ao manifesto real de commits/arquivos e aos relatórios efetivamente produzidos; não assumir escopo por um SHA antigo.
- `docs/crm-promocao-integral-producao-vault-20261022.md` — pré-requisito de produção, backup verificado e plano aditivo a apresentar ao usuário.
- `src/lib/radar/resultado.ts` — classificação compartilhada de resposta inconclusiva, usada na proteção do histórico.
- `package.json` — limite de heap do build4096MB, mantendo um thread/worker; nenhum upgrade de infraestrutura ou variável remota.
- `src/actions/PreAnalise.ts` — proteger persistência de snapshot contra ausência/erro/fallback histórico.
- `src/app/PainelAlpha/SistemaPreAnalise/BlocoResultados.tsx` — fallback de ausência CSV200/404 somente leitura, data de origem e conservação do snapshot em falhas.
- `src/app/api/ConsultaCompleta/route.ts` — reconsulta inconclusiva preserva registro Radar anterior sem upsert e leitura local conserva situação/modalidade.
- `tests/pre-analise/radar-preservacao.test.ts`; `tests/pre-analise/radar-historico-react.test.ts`; `tests/radar/consulta-completa.test.ts` — regressões de ausência/erro/histórico, datas e ausência de escrita.
- Demais arquivos promovidos são os deltas completos dos commits abaixo, sem seleção parcial de recursos; o manifesto de release registra os caminhos integrais.

## Preflight e integração concreta

- Produção anterior: `28651e7f4c6a3ed1be91f7437eb638638d047f0c`, deployment READY `dpl_5qzpMQ8aQAwyY7q7ViNQfrwMFiu4`. Este é o ponto de rollback de código, mantendo a coluna aditiva se sua execução vier a ser autorizada.
- Staging atual: `ab278f1337091e2ba534306b1d975ba8f3dbf56a`, deployment READY `dpl_AaZFpYyhfnKAK96MbiWKVjSTMkm3`. Seu histórico diverge dos recursos previamente aprovados e publicados: não contém o editor nem parte do código oficial. Não promover sua árvore diretamente.
- Staging anterior aprovado: editor `63612d765fd1ac4ddf9b16c0b2f349e416958755`, READY `dpl_FkhYBLopCryLJeu1Ax583xt59Jdn`, fechamento documental `1290e16f4779e38753db0579eb4d2bcb380f8e1e`; notificações `4b7770d66fcde425836d75bec13a3d9024977be9`, READY `dpl_FY5nTbdNKYrqj6AvBYjmiGwQumU5`.
- Candidato por merges normais: produção28651 +1290 +4b +ab = `cf04f23e5d1d41307c2658149a2cda60c642931d`, seguido das correções de preservação de Radar desta story. Nenhum force push/reset. Conflitos somente em duas documentações e teste de assunção: preservar histórico operacional de produção e comportamento aprovado sem anotação técnica Instagram.
- QA conferiu editor/host/DTO/schema/migration e ingestões byte a byte contra1290; o fix Radar da consulta do editor permanece idêntico ao staging aprovado. Diferenças adicionais de runtime limitadas a notificações de leitura, fallback da Pré-Análise e limites de threads do build, antes dos guards desta release.
- CheckList62d1/584856 é somente trabalho local não publicado: não consta no remoto staging nem entre deployments READY; sua story/migration está In Progress e não aplicada. Fica fora desta promoção de **conteúdo de staging**, sem importar sua DDL, backfills ou configuração. Os seis CHECKLIST_* preparados exclusivamente em staging não são usados pelo código promovido e não são copiados para produção.
- Env CLI/build somente `.env.staging.local` explícito e verificado. A API Vercel mascara o URL do banco, portanto não afirmar hash remoto obtido. DevOps verificou leitura SSR autenticada do board, sem abertura de card/primeira vista: fixture exclusiva de staging presente. Cruzar com Vault e confirmar isolamento antes da publicação no staging. Nenhum dado ou credencial de produção copiado.
- Falhas concretas de preservação encontradas no novo fallback CSV foram corrigidas antes de publicar: ausência200/404 e histórico indisponível não substituem dados Radar salvos nem renovam a data histórica. Guard também no servidor e na reconsulta completa; consultas confirmadas continuam persistindo normalmente.

## Gates locais e pré-requisitos verificados

- `npm test` com ambiente staging explícito: **729 arquivos, 5.909 PASS, 4 skipped, 1 todo**, exit0; cobertura gerada. Log `/tmp/crm-promocao-integral-20261022-tests-final.log`. Rodada focal dos guards:28PASS em3arquivos. Nenhum teste foi executado em produção.
- `npm run lint`: exit0, **0 erros**,1.193avisos legados; `/tmp/crm-promocao-integral-20261022-lint.log`.
- `npm run build` padrão: **exit0**, compilação82s e81páginas; `/tmp/crm-promocao-integral-20261022-build-final.log`. Tentativa anterior com heap3072MB excedeu o limite V8/SIGABRT; ajustado somente o script para4096MB, preservando RAYON1/UV1/cpus1, sem alterar plano/máquina/env remoto. Evidência de fracasso anterior mantida no log sem sufixo-final; não confundir com o resultado do script final.
- `npm run typecheck`: **exit0**, executado sequencialmente após o build; `/tmp/crm-promocao-integral-20261022-typecheck.log`. Não executado simultaneamente à regeneração de `.next/types`.
- QA revisou os guards e a equivalência: sem novosP1/P2 confirmados; ratificação integrada depende dos gates concluídos e staging READY/checagem remota.
- Vault: produção2175clientes/337tabelas sem a coluna opcional; únicoDDL pendente `ALTER TABLE "Cliente" ADD COLUMN "perfilCadastralJson" JSONB;`. Backup novo completo22/10/2026 20:22UTC restaurado/verificadoPASS, válido até24/10 20:22UTC. Plano/risco/alternativa/rollback no relatório Vault; **não aplicado**.
- Isolamento remoto cruzado: GETSSR autenticado stage contém cardfixture/empresa3068; SQL readonly stage2178clientes/14colunas/JSONBpresente; Vault confirmou cardfixture eempresa3068 **ausentes na produção**. URLremotaVercel continua mascarada; comprovação não depende de revelar/copiar segredo. Recibos privados `/tmp/crm-promocao-integral-20261022-{staging-runtime-db-crosscheck,known-staging-db-readonly}.json`.
- Manifesto local revisável: `/tmp/crm-promocao-integral-20261022-candidate-manifest.json`,146arquivos de diferença comsha256, trêsfontes ancestrais conferidas e produção preservada. Documentação de resultado pode ser atualizada sem alterar executável aprovado.

## CodeRabbit Integration

Tipo: Release/integração de branches + compatibilidade de runtime/banco. QA deve calibrar o escopo pelo diff integral e pela árvore candidata, preservação de mudanças exclusivas, gates/artefato, rollback e smoke autenticado de leitura. Nenhum parecer QA ou resultado remoto é antecipado nesta preparação da story.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 0.1 | Promoção integral de staging explicitamente autorizada; preflight e eventuais gates específicos de banco ainda pendentes | `@sm` |
