# Contratos pendentes no Comercial — validação de staging

**Resultado: PASS no fluxo manual autenticado com dados fictícios.** Contrato para envio passou de pendente a disponível após validação legítima no Financeiro, atualizou o card Comercial aberto e gerou um aviso interno único ao responsável. Contrato assinado permaneceu pendente. Produção não integra esta entrega.

## Revisão e gates

Staging `https://staging.alpha-comex.com`, runtime `5e3d629c822a78a8e3ec413e6d99f5e87bb420d7`, deployment `dpl_H4JDX3syGmX8mZ3rq2pxn1ZzFwYs`, READY no custom environment staging. Feature `48ebc3c9` integrada com as correções concorrentes até `861e43d7`, sem sobrescrever trabalho de outros fluxos.

Quatro gates reais sobre a árvore integrada 2f: typecheck e lint exit 0 (1.193 avisos existentes); build integral equivalente exit 0 em 180,47 s, com fases Prisma/player/Next e heap controlado; suíte com **704 arquivos/5.451 testes aprovados**, quatro skipped e um todo. Integrações posteriores receberam checagens afetadas aprovadas: b71 com novo typecheck, lint e sete arquivos/104 testes; 861 com typecheck, lint e oito arquivos/187 testes. Esses deltas não são apresentados como nova execução da suíte completa. Forge, Lens/Flux, Sage/Probe/Anubis e QA pré-push aprovaram; CodeRabbit indisponível, com revisão independente documentada.

Não houve mudança de schema, migration, dependência ou ENV. Bancos separados e fingerprints esperados confirmados privadamente. Builds/testes locais usaram fixture SQLite isolada, sem conexão remota. A primeira suíte antiga sobre 87 revelou um mock incompleto de validações no teste de exclusão; a correção preservou suas assertions, e os gates integrados passaram.

## Percurso remoto comprovado

Reteste com sessão Admin real, responsável pelo card Comercial da empresa fictícia 3066. Foi usado PDF claramente fictício no caminho manual já permitido, sem assinatura ou envio externo.

| Verificação | Resultado observado |
| --- | --- |
| Estado inicial | Dois campos pendentes; pulsação discreta de 2 s e animação desativada com reduced motion. |
| Somente upload no Financeiro | Comercial continuou pendente; arquivo isolado não foi tratado como contrato validado. |
| Validação manual vigente | Após marcar Elaborado = Sim por edição normal, Contrato para envio ficou verde sem fechar o card Comercial. |
| Assinado independente | Permaneceu PENDENTE, com uma pulsação; consulta autenticada de documento ausente retornou 404. |
| Acesso documental | PDF autenticado 200, application/pdf, 1.173 bytes, assinatura de formato %PDF-, nosniff e cache privado/no-store; preview abriu pela UI. |
| Aba Anexos | Badge e lista com um documento, somente leitura, sem ação de excluir projeção. |
| Aviso real | Sino do responsável mostrou Enviar contrato, horário 16:40 de Brasília, empresa/PDF e mensagem de contrato pronto para envio. Um aviso correspondente. |
| Reabrir/refetch | Mesmo ID de alerta, tarefa e alertaEm antes/depois; contador permaneceu um, sem duplicação. |
| Runtime | Nenhum novo erro da feature; dois 503 de voz preexistentes registrados separadamente. |

Smoke anônimo: raiz, providers, sessão, broadcast/banco e chunks públicos 200; CRM protegido com 307 e os dois slots contratuais com 401. O primeiro GET para envio teve URLError transitório; retry dirigido retornou 401 em 0,23 s. Corpos privados, credenciais, PDF e logs brutos não são versionados.

## Alcance e limites

Geração automática/finalização pelo gerador e documento assinado positivo têm cobertura local, incluindo SQLite e pós-commit; não foram executados neste reteste remoto. A evidência acima valida o caminho manual legítimo e o estado assinado ainda ausente. Não se fabricaram assinatura, pagamento, NF, conclusão financeira ou entrega externa.

Operações CRUD normais da UI financeira usam o orquestrador por card existente, que inclui housekeeping de leases. Não se afirma ausência de todo efeito indireto desse mecanismo. Nenhum worker/flush global foi invocado manualmente por CLI, nenhuma estrutura/configuração foi alterada e nenhum dado foi copiado entre ambientes. O teste remoto de upload assinado foi excluído deste escopo.

[Story e File List](../stories/story-crm-contratos-pendentes-comercial-20261021.md). Evidência operacional privada em `/var/tmp/alpha-crm-contratos-pendentes-20261021/`: `remote-result.json`, `remote-dedup-proof.json` e, em `integrado/`, gates, custódia, publicação, aliases, inventários SELECT-only e smokes sanitizados. O fechamento posterior é exclusivamente documental e mantém o runtime validado.
