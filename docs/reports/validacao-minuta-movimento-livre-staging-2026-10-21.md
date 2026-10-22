# Validação de minuta automática por movimento livre — staging

Data: 21/10/2026. Ambiente: `https://staging.alpha-comex.com`. Revisão funcional homologada: `71e3f06fed6890ef346ead946711ea37bcdc4fd3`, deployment `dpl_2eyf3ifNfvM587DptJ7wacBUGMob` READY no custom environment staging. Produção não foi publicada nem configurada nesta correção.

## Problema e correção

No caso relatado, o movimento livre de Admin dispensava requisitos e suprimia todas as automações, inclusive a geração da minuta configurada. O histórico de staging confirmou dois reposicionamentos suprimidos da empresa informada, sem execução de geração. Serviço, condição Radar, template, contratada e campo de arquivo estavam válidos.

A correção permite somente a minuta de uma regra ativa e elegível, com grafo estrito `GERAR_CONTRATO → FIM`, em eventos novos e comprovados pelo servidor. Mantém a supressão das demais ações, as permissões vigentes, o isolamento por card/evento e a conferência do documento. Não cria botão, não reprocessa eventos históricos e não configura automações novas.

## Verificação local e publicação

- Forge real: typecheck e lint exit 0; 1.193 avisos de lint preexistentes; build completo exit 0 em 203,35 s; suíte de **706 arquivos, 5.557 testes aprovados, zero falhas, quatro skipped e um todo**. Fonte congelada e smoke compilado local preservados.
- O avanço concorrente de Instagram `bfff9d36` foi integrado por merge normal, sem conflito. Nove arquivos de runtime/testes da correção e dez caminhos concorrentes foram preservados byte a byte. Checks combinados: typecheck oficial de 8 GiB, lint dos fontes afetados/Apps Script e **11 arquivos, 158 testes**, todos aprovados. A tentativa anterior de typecheck limitada a 4 GiB esgotou heap; log preservado e comando oficial passou sem mudança de fonte.
- Git: feature `55183c0a`, merge preservador `71e3f06f`, push normal somente staging. Alias/SHA/READY e custom environment conferidos. Raiz, banco via endpoint somente leitura, providers e sessão anônima responderam 200; rota documental sem sessão respondeu 401.

## Reteste autenticado e prova independente

Admin real percorreu a UI normal usando somente a nova empresa fictícia `3067`. O Comercial foi encaminhado explicitamente ao Financeiro; em seguida, o card financeiro entrou de Novo Contrato em Elaboração de Contrato. Consultas independentes usaram transações SELECT-only de staging, perfil de banco previamente conferido, sem execução manual de fila/worker.

| Verificação | Resultado comprovado |
| --- | --- |
| Primeira entrada | HTTP 200/success; uma execução documental SUCESSO, uma tentativa; minuta criada em CONFERENCIA e um anexo no campo canônico. |
| Proveniência | Documento pertence à empresa fictícia e contém `__bpmCardId` do Financeiro; evento registra Admin autenticado, supressão ampla e marcador documental novo. |
| Conferência e prévia | UI em conferência, dez cláusulas e oito pendências; preview autenticado 200; PDF de prévia 200, 99.452 bytes e assinatura `%PDF-`. Isso não finaliza o documento. |
| Saída e reentrada | Mesmo documento e mesmo anexo, metadados e campo canônico estáveis; segunda execução SUCESSO reutilizou o documento com `existente=true`. |
| Contagem das execuções | Dois registros SUCESSO, um por entrada elegível; mais um registro IGNORADA ao voltar para Novo Contrato, motivo `DESTINO_DOCUMENTAL_DIVERGENTE`, zero tentativas e nenhum passo executado. Três registros totais, sem duplicação documental. |
| Comercial | Ambos os slots continuam pendentes; rota para envio retorna 404; nenhum alerta correspondente e nenhuma tarefa “Enviar contrato”. Card Comercial permaneceu inalterado. |
| Estados financeiros | Elaborado, enviado, assinado, pagamento e NF não foram confirmados; documento sem finalização e sem PDF final persistido. |
| Fixture anterior | Os dois cards da empresa fictícia `3066`, incluindo seu PDF manual, mantiveram igualdade profunda e hashes idênticos ao baseline. |

Tempos observados das ações na UI: **22,634 s** na primeira entrada e **18,624 s** na reentrada. São medições dessas duas interações, sem teste de carga ou alegação de melhoria de latência.

O navegador também registrou requisições abortadas durante navegação, respostas 503 do serviço de voz preexistente e avisos de política de geolocalização/descrição de diálogo. Esses registros foram separados dos resultados funcionais; não se afirma console inteiramente limpo nem se amplia o escopo desta correção.

## Limites e uso após a correção

A empresa real do relato foi somente diagnosticada: nenhum movimento, contrato ou reprocessamento foi aplicado nela por esta validação. Após atualizar a página de staging, um novo movimento de Novo Contrato para Elaboração de Contrato pode gerar a minuta, se a regra continuar ativa e elegível. A conferência/finalização legítima continua obrigatória antes de disponibilizar o contrato no Comercial e avisar o responsável.

O reteste remoto usou Admin; líder foi coberto localmente, sem credencial de líder exercitada remotamente. Finalização, assinatura positiva, pagamento, NF e envio externo não foram executados neste reteste. Não houve migration, backfill, alteração de configuração/ambiente nem worker global/CLI manual. Ações normais da UI são distintas de mutação administrativa de banco. Nenhuma publicação de produção está incluída.

## Corte de versão do fechamento documental

O reteste de criação/reentrada acima corresponde a `71e3f06f`. Durante o fechamento, outro fluxo publicou `86858e7e`, filho direto dessa revisão, com valores por extenso no GeradorDocumentos e dependência fixa `extenso@3.0.0`. FF preservador manteve os onze caminhos externos e os nove arquivos de runtime/testes desta correção byte a byte iguais. QA conferiu os gates próprios da combinação: typecheck e suíte de 709 arquivos/5.614 testes aprovados. O build padrão remoto dessa revisão ficou READY em Node24.x; a prova completa da minuta continua vinculada ao E2E histórico de `71e3`, complementado por checagem autenticada de leitura na revisão preservada. Smoke autenticado Admin somente leitura em `868`, às 20:51:03 UTC, confirmou preview 200/CONFERENCIA, dez cláusulas, oito pendências, PDF de prévia 200/99.451 bytes/`%PDF-` e Comercial para envio 404, sem movimento de card. Evidência privada: `external-868-authenticated-readonly-smoke.json`. O commit final desta entrega modifica somente documentação, com comparação de árvore contra essa base, sem nova implementação.

## Evidências

Evidências privadas, não versionadas como logs brutos: `/var/tmp/alpha-crm-contrato-elaboracao-20261021/`, incluindo `forge/forge-result.json`, `release/delta-bfff-result.json`, `release/merge-bfff-proof.json`, `release/publication.json`, `remote-browser-result.json`, `draft-ui-proof.json`, `commercial-ui-proof.json`, `first-generation-evidence.json`, `first-entry-proof.json`, `final-generation-evidence.json`, `after-reentry.json` e `reentry-proof.json` (15 assertivas aprovadas). O rascunho inicial do checker que exigia incorretamente somente dois registros totais foi preservado; a prova final distingue duas execuções efetivas do registro ignorado.

Documento relacionado: [story da correção](../stories/story-crm-geracao-minuta-movimento-livre-20261021.md). Logs, tokens, URLs privadas de armazenamento, conteúdo contratual e PDFs não integram esta publicação documental.
