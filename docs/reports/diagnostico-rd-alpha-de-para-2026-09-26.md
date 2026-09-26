# Diagnóstico RD Station CRM × Alpha CRM — 2026-09-26

Leitura pontual via conector RD Station CRM v2 e consulta somente leitura ao Turso do Alpha, realizada em 2026-09-26, aproximadamente 18h UTC. Os sistemas podem mudar após a leitura. Nenhum registro foi alterado.

**Escopo deste documento:** inventário do Kanban, comparação com o Alpha, proposta inicial de de/para e limites das consultas complementares. É um diagnóstico, não uma especificação aprovada de migração. Não contém nomes, CNPJs, contatos nem textos de notas de clientes para evitar versionar dados reais.

## Resumo

- RD: 16 funis, 122 etapas (71 ocupadas, 51 vazias), 1.532 negócios únicos. Status: 940 ongoing, 565 won, 26 lost, 1 paused.
- RD: 1.549 organizações, 1.502 contatos, 31 usuários, 35 campos personalizados (34 de negócio, 1 de organização), 1.665 tarefas únicas (125 abertas, 1.521 concluídas, 19 canceladas). Notas não possuem listagem global no conector; não foram contadas.
- Alpha: 3 pipelines, 28 etapas (9 Radar, 6 Financeiro, 13 Operacional), 4 BpmCards, 1.421 Clientes, 572 com CNPJ e 2 vínculos entre cards. BpmCampo e BpmCardCampoValor: 0.
- Funis RD ligados à jornada de revisão de Radar: 1.039 negócios em 10 funis, inclusive um funil vazio. Outros serviços: 493 negócios em 6 funis sem pipeline equivalente atual.
- A listagem paginada geral do RD repetiu IDs. Reconciliamos por funil/etapa, completamos os faltantes por stage_id e conferimos a soma de 1.532 IDs únicos contra o total de cada etapa.

## Funis RD e destino sugerido

| Funil RD | ID | Etapas | Negócios | Interpretação para Alpha |
|---|---|---:|---:|---|
| REVISÃO DE ESTIMATIVA DO RADAR (LEADS) | `6672fd5d2ba7e000181cdba0` | 11 | 556 | Radar comercial, com fim comercial que cruza Financeiro |
| DIRETORIA OPERACIONAL - Vitor | `667ed153478ffa00212d88d7` | 5 | 0 | Operacional |
| DEPTO. FINANCEIRO - Entrada | `6681a7ad67810b001961680c` | 4 | 15 | Financeiro; Êxito requer validação com pós-deferimento |
| DPTO. FINANCEIRO - Êxito | `6681a8952a5fe30016466931` | 5 | 212 | Financeiro; Êxito requer validação com pós-deferimento |
| REVISÃO DO RADAR (OPERACIONAL PROTOCOLO) | `6681bc96f250270010f9b253` | 7 | 8 | Operacional |
| STAND-BY - Processos Revisão de RADAR | `6682e64d5bdb1e00100a3dd9` | 4 | 35 | Radar/Operacional em espera; requer triagem |
| RECUPERAÇÃO TAXA AFRMM | `6682e7f63539c5001e385ae3` | 12 | 135 | Outro serviço, sem pipeline Alpha equivalente |
| BENEFÍCIO TRIBUTÁRIO DE SC (TTD-409) | `6683025f6a652a0020ae3760` | 9 | 17 | Outro serviço, sem pipeline Alpha equivalente |
| HABILITAÇÃO DO RADAR | `668302c9b9963200224cb913` | 11 | 148 | Outro serviço, sem pipeline Alpha equivalente |
| REVISÃO DO RADAR (OPERACIONAL) - Maria | `66881b2f26e5f20010518eee` | 4 | 20 | Operacional |
| RECUPERAÇÕES TRIBUTÁRIAS - Marcelo | `66ce002a83d5f50018fd7981` | 12 | 171 | Outro serviço, sem pipeline Alpha equivalente |
| (Desativado) REC. TRIBUTÁRIAS - Rafael | `67a678d006abe500144ce3a0` | 12 | 21 | Outro serviço, sem pipeline Alpha equivalente |
| DEFERIDOS (PROCESSOS REVISÃO DO RADAR) | `6879613ca7530700145929e8` | 6 | 177 | Operacional concluído e possível cobrança; requer triagem |
| FALAVINHA - Leads indicados | `68fa610ef4aafc0017f7c24e` | 12 | 1 | Outro serviço, sem pipeline Alpha equivalente |
| REVISÃO DO RADAR (OPERACIONAL) -Mariah | `69fa3e31479dc00014f0cab6` | 4 | 15 | Operacional |
| REVISÃO DO RADAR - ASSESSORIA SMART | `6aa89b99ca40910029d7ca7a` | 4 | 1 | Operacional |

## Kanban atual do Alpha

| Pipeline | Etapas em ordem, com quantidade de cards |
|---|---|
| Revisão de Radar | Novo Lead 0 → Agendar Reunião 0 → Reunião Agendada 1 → Em tratativas 0 → Fechado 1; saídas finais: Lost 0, Sem viabilidade 0, Stand By 0, Monitoramento 0 |
| Financeiro | Novo Contrato 0 → Elaboração de Contrato 0 → Formalização 0 → Confirmação de Pagamento 0 → Emissão de Nota Fiscal 0 → Concluido 1 |
| Operacional | Boas vindas 0 → Alinhamento Estratégico Agendado 0 → Envio do Check List Atualizado 0 → Documentação em análise 0 → Revisão 0 → Revisado 0 → Revisão do protocolo 0 → Aguardando despacho 0 → Petição 0 → Exigência Fiscal 0 → Resposta 0 → Processo deferido 1; Processo indeferido 0 |

Os cards Alpha: uma empresa presente em Fechado, Concluido e Processo deferido como três cards vinculados; um card de diagnóstico em Reunião Agendada. O CNPJ da empresa dos três cards vinculados não apareceu como nome de negócio válido nem como CNPJ de organização no inventário RD.

## Inventário de todas as colunas RD

Cada linha indica a posição atual do negócio no Kanban RD. Status de negócio é independente da coluna.

A API de negócios informa o funil e a etapa, mas não expõe a ordem visual dos cards dentro de cada coluna. Portanto, o inventário reproduz a ocupação do Kanban, sem prometer a mesma ordenação vertical.

### REVISÃO DE ESTIMATIVA DO RADAR (LEADS) — 556 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Novos leads | `681925f7bf5d3c00144708b7` | 0 | 0 | 0 | 0 | 0 |
| 2 | Sem qualificação | `6a5a2d1f6352a1001d710cc1` | 15 | 14 | 0 | 1 | 0 |
| 3 | Leads frios - Não fazer follow-up | `67cf28d5cf57c0001f1ab52a` | 19 | 15 | 0 | 4 | 0 |
| 4 | Fechou com a concorrência | `6a5112111b2c7a002e5b54a4` | 95 | 90 | 0 | 5 | 0 |
| 5 | Aguardando retorno para reunião | `68507c6a09145a001e67697b` | 29 | 29 | 0 | 0 | 0 |
| 6 | Stand-by - Folllow-up a 7 dias | `66ad0ad54d4f630023a7814f` | 330 | 319 | 2 | 8 | 1 |
| 7 | Em tratativa avançada | `678a7e9fc8d77c0014db1d0a` | 55 | 54 | 1 | 0 | 0 |
| 8 | Contratos à enviar | `6672fd5e2ba7e000181cdba4` | 1 | 1 | 0 | 0 | 0 |
| 9 | Contratos enviados | `6a761350f253520030676dee` | 12 | 9 | 3 | 0 | 0 |
| 10 | Pagamento recebido | `6a76128f116867002abc0d2e` | 0 | 0 | 0 | 0 | 0 |
| 11 | Contrato assinado | `6a7612ef6d0ded00335ca796` | 0 | 0 | 0 | 0 | 0 |

### DIRETORIA OPERACIONAL - Vitor — 0 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Atribuição ao analista responsável | `6a7611b710b91f0028f2688e` | 0 | 0 | 0 | 0 | 0 |
| 2 | Contratados stand-by | `667f0aab1817ac0018a06561` | 0 | 0 | 0 | 0 | 0 |
| 3 | Envio do checklist e boas vindas | `667ed153478ffa00212d88d9` | 0 | 0 | 0 | 0 | 0 |
| 4 | Documentação em análise - VITOR | `667ed153478ffa00212d88db` | 0 | 0 | 0 | 0 | 0 |
| 5 | CLIENTES CANCELADOS | `68fa54b5752ee90020e19d17` | 0 | 0 | 0 | 0 | 0 |

### DEPTO. FINANCEIRO - Entrada — 15 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Elaborar contrato | `6681a7ad67810b001961680e` | 1 | 0 | 1 | 0 | 0 |
| 2 | STAND-BY | `68796dde30b2830027205458` | 14 | 9 | 1 | 4 | 0 |
| 3 | Pagamento confirmado | `6681a7ad67810b0019616810` | 0 | 0 | 0 | 0 | 0 |
| 4 | Enviar NF - Contratação | `6681a7ad67810b0019616811` | 0 | 0 | 0 | 0 | 0 |

### DPTO. FINANCEIRO - Êxito — 212 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Deferidos - EFETUAR COBRANÇA | `687968ded1e8b20023c07860` | 3 | 0 | 3 | 0 | 0 |
| 2 | Enviar NF - êxito | `6681a8962a5fe30016466933` | 1 | 0 | 1 | 0 | 0 |
| 3 | Pgto confirmado | `6681bb849753840016503883` | 184 | 16 | 168 | 0 | 0 |
| 4 | Clientes processos 2x1 | `68a736f48078d90021670994` | 1 | 0 | 1 | 0 | 0 |
| 5 | Contratos cancelados | `6a761099e2df000033841038` | 23 | 1 | 22 | 0 | 0 |

### REVISÃO DO RADAR (OPERACIONAL PROTOCOLO) — 8 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Processos para revisão | `6681bc96f250270010f9b255` | 0 | 0 | 0 | 0 | 0 |
| 2 | Processos revisado para protocolo | `6866fa9165097a0025c44494` | 0 | 0 | 0 | 0 | 0 |
| 3 | Revisão do protocolo feito | `6681bc96f250270010f9b257` | 0 | 0 | 0 | 0 | 0 |
| 4 | Aguardando despacho | `6681bc96f250270010f9b258` | 5 | 1 | 4 | 0 | 0 |
| 5 | Exigência fiscal | `6876a5be5e21130016b16e2b` | 2 | 0 | 2 | 0 | 0 |
| 6 | Resposta ao fiscal | `68779c1885adc9001b92e7ec` | 1 | 0 | 1 | 0 | 0 |
| 7 | Processo deferido | `687692f1058d2100149b9ce9` | 0 | 0 | 0 | 0 | 0 |

### STAND-BY - Processos Revisão de RADAR — 35 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Sem contato | `6682e64d5bdb1e00100a3ddb` | 9 | 1 | 8 | 0 | 0 |
| 2 | Revisão ILIMITADO | `6682e64d5bdb1e00100a3ddc` | 2 | 0 | 2 | 0 | 0 |
| 3 | Previsão para andamento | `6682e64d5bdb1e00100a3ddd` | 0 | 0 | 0 | 0 | 0 |
| 4 | Sem retorno do cliente | `6682e64d5bdb1e00100a3dde` | 24 | 1 | 23 | 0 | 0 |

### RECUPERAÇÃO TAXA AFRMM — 135 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Leads interessados | `6683015ee7b150000fb01aa2` | 0 | 0 | 0 | 0 | 0 |
| 2 | Em tratativa | `6879775ae4dca2001bf7c675` | 6 | 1 | 5 | 0 | 0 |
| 3 | Reunião agendada | `6683016fe5e013000f0513eb` | 24 | 0 | 24 | 0 | 0 |
| 4 | Aguardando documentos | `6682e7f63539c5001e385ae5` | 29 | 1 | 28 | 0 | 0 |
| 5 | Aguardando assinatura | `6682e7f63539c5001e385ae6` | 1 | 0 | 1 | 0 | 0 |
| 6 | Processo protocolado | `6682e7f63539c5001e385ae7` | 8 | 3 | 5 | 0 | 0 |
| 7 | Prazo/Aguardando contestação | `67d076a572a55500192079b5` | 4 | 2 | 2 | 0 | 0 |
| 8 | Aguardando sentença | `687e8d84ac6b7100144fd3e7` | 12 | 4 | 8 | 0 | 0 |
| 9 | Prazo/Aguardando recurso | `687e8da6cae0b10014f191ca` | 5 | 2 | 3 | 0 | 0 |
| 10 | Processo deferido | `6682e7f63539c5001e385ae8` | 3 | 2 | 1 | 0 | 0 |
| 11 | Aguardando decisão/Trânsito em julgado | `6879774f759f3f001d1dc085` | 12 | 4 | 8 | 0 | 0 |
| 12 | Cumprimento de sentença | `687e997e6c3b520018058e23` | 31 | 21 | 10 | 0 | 0 |

### BENEFÍCIO TRIBUTÁRIO DE SC (TTD-409) — 17 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Novos leads | `6819264f69371a00279a46e2` | 6 | 6 | 0 | 0 | 0 |
| 2 | Reunião agendada | `6683025f6a652a0020ae3762` | 3 | 2 | 0 | 1 | 0 |
| 3 | Reunião feita | `6683025f6a652a0020ae3763` | 3 | 3 | 0 | 0 | 0 |
| 4 | Aguardando documentação | `6683025f6a652a0020ae3764` | 5 | 4 | 1 | 0 | 0 |
| 5 | Solicitação protocolada | `6683025f6a652a0020ae3765` | 0 | 0 | 0 | 0 | 0 |
| 6 | Benefício aprovado | `6683025f6a652a0020ae3766` | 0 | 0 | 0 | 0 | 0 |
| 7 | Benefício negado | `668302b548ee44001622b41f` | 0 | 0 | 0 | 0 | 0 |
| 8 | Repescagem | `687975bff9755400179745ce` | 0 | 0 | 0 | 0 | 0 |
| 9 | Contato futuro | `68797733a43f8d001ac41df3` | 0 | 0 | 0 | 0 | 0 |

### HABILITAÇÃO DO RADAR — 148 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Novos leads | `681926341d2e7d0014a92926` | 1 | 1 | 0 | 0 | 0 |
| 2 | Leads em tratativa | `67a67ea6960b6a0014355191` | 78 | 76 | 0 | 2 | 0 |
| 3 | Aguardando certificado digital | `668302c9b9963200224cb915` | 3 | 3 | 0 | 0 | 0 |
| 4 | Reunião realizada | `67a67eb364677b001937f0f5` | 2 | 2 | 0 | 0 | 0 |
| 5 | Negócio fechado | `68796fd11334a1001e45e32a` | 0 | 0 | 0 | 0 | 0 |
| 6 | Pagamento confirmado | `68796f20784ab70017445747` | 33 | 15 | 18 | 0 | 0 |
| 7 | Processo protocolado | `668302c9b9963200224cb916` | 0 | 0 | 0 | 0 | 0 |
| 8 | Processo deferido | `668302c9b9963200224cb917` | 11 | 2 | 9 | 0 | 0 |
| 9 | Repescagem | `6879771478a6af001403f4b5` | 1 | 1 | 0 | 0 | 0 |
| 10 | Contato futuro | `68797724f97554001797466c` | 13 | 13 | 0 | 0 | 0 |
| 11 | Desqualificados | `68b5f689079ca8001749f31b` | 6 | 6 | 0 | 0 | 0 |

### REVISÃO DO RADAR (OPERACIONAL) - Maria — 20 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Contratados stand-by | `66881b2f26e5f20010518ef0` | 0 | 0 | 0 | 0 | 0 |
| 2 | Envio do checklist e boas vindas | `66881b2f26e5f20010518ef1` | 5 | 0 | 5 | 0 | 0 |
| 3 | Documentação em análise | `66881b2f26e5f20010518ef2` | 14 | 1 | 13 | 0 | 0 |
| 4 | CLIENTES CANCELADOS | `68fa54d934dd040018128880` | 1 | 0 | 1 | 0 | 0 |

### RECUPERAÇÕES TRIBUTÁRIAS - Marcelo — 171 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Leads Perdidos | `686eccbf97ccbf00190c239f` | 68 | 67 | 0 | 1 | 0 |
| 2 | Lead em tratativa | `66d071b4b850ce00288ddc16` | 20 | 20 | 0 | 0 | 0 |
| 3 | Reunião agendada | `66d071bfdb4d3c001236c555` | 0 | 0 | 0 | 0 | 0 |
| 4 | Reunião realizada | `66ce002a83d5f50018fd7983` | 7 | 7 | 0 | 0 | 0 |
| 5 | Habilitação da procuração eletrônica | `66ce002b83d5f50018fd7984` | 6 | 6 | 0 | 0 | 0 |
| 6 | Em levantamento | `66ce002b83d5f50018fd7985` | 8 | 8 | 0 | 0 | 0 |
| 7 | Apresentação do levantamento | `66ce002b83d5f50018fd7986` | 5 | 5 | 0 | 0 | 0 |
| 8 | Contrato pronto para assinatura | `66ce002b83d5f50018fd7987` | 9 | 9 | 0 | 0 | 0 |
| 9 | Contrato assinado | `66ce00e4474df50015ddb115` | 6 | 6 | 0 | 0 | 0 |
| 10 | Processo em andamento | `66ce010b8c69e50019acd831` | 14 | 14 | 0 | 0 | 0 |
| 11 | Restituição/compensação realizada | `66ce0135f438410013f9a846` | 16 | 16 | 0 | 0 | 0 |
| 12 | Honorários recebidos | `66ce0143a7b40a0027188dff` | 12 | 12 | 0 | 0 | 0 |

### (Desativado) REC. TRIBUTÁRIAS - Rafael — 21 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Leads perdidos | `67a678d006abe500144ce3a2` | 4 | 4 | 0 | 0 | 0 |
| 2 | Leads em tratativa | `67a678d006abe500144ce3a4` | 2 | 2 | 0 | 0 | 0 |
| 3 | Reunião agendada | `67a678d006abe500144ce3a3` | 1 | 1 | 0 | 0 | 0 |
| 4 | Reunião realizada | `67a678d006abe500144ce3a5` | 2 | 2 | 0 | 0 | 0 |
| 5 | Aguardando habilitação da procuração eletrônica | `67a678d006abe500144ce3a6` | 0 | 0 | 0 | 0 | 0 |
| 6 | Em levantamento | `67a679c7bc801100232e21a9` | 7 | 7 | 0 | 0 | 0 |
| 7 | Apresentação do levantamento | `67a67cf3960b6a0022354bc3` | 3 | 3 | 0 | 0 | 0 |
| 8 | Em negociação de honorários | `67a67d0a960b6a0022354bd0` | 0 | 0 | 0 | 0 | 0 |
| 9 | Contrato enviado para assinatura | `67a67d3678a54a0027d0097f` | 0 | 0 | 0 | 0 | 0 |
| 10 | Contrato assinado | `67a67d41e9fbe3001b69128a` | 2 | 2 | 0 | 0 | 0 |
| 11 | Processo em andamento | `67a67d50b6e493002168e76f` | 0 | 0 | 0 | 0 | 0 |
| 12 | Restituição/compensação realizada | `67a67d5ec829cc001b932351` | 0 | 0 | 0 | 0 | 0 |

### DEFERIDOS (PROCESSOS REVISÃO DO RADAR) — 177 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Deferidos - RADAR | `6879613ca7530700145929ea` | 177 | 11 | 166 | 0 | 0 |
| 2 | Reunião agendada | `6879613ca7530700145929eb` | 0 | 0 | 0 | 0 | 0 |
| 3 | Em tratativa - Hot leads | `6879613ca7530700145929ec` | 0 | 0 | 0 | 0 | 0 |
| 4 | Repescagem | `6879613ca7530700145929ed` | 0 | 0 | 0 | 0 | 0 |
| 5 | Contato futuro | `6879613ca7530700145929ee` | 0 | 0 | 0 | 0 | 0 |
| 6 | Sem interesse | `68796360dd39850015ae3c6f` | 0 | 0 | 0 | 0 | 0 |

### FALAVINHA - Leads indicados — 1 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Prontos para levantamento | `68fa610ef4aafc0017f7c250` | 1 | 1 | 0 | 0 | 0 |
| 2 | Levantamento sendo realizado | `68fa610ef4aafc0017f7c251` | 0 | 0 | 0 | 0 | 0 |
| 3 | Informar oportunidades - Alpha Comex | `68fa610ef4aafc0017f7c252` | 0 | 0 | 0 | 0 | 0 |
| 4 | Agendar reunião - Apresentação de resultados | `68fa610ef4aafc0017f7c253` | 0 | 0 | 0 | 0 | 0 |
| 5 | Aguardando retorno do cliente | `68fa610ef4aafc0017f7c254` | 0 | 0 | 0 | 0 | 0 |
| 6 | Negociando honorários | `68fa64c37b93a300181f5d3f` | 0 | 0 | 0 | 0 | 0 |
| 7 | Negociando honorários | `68fa64cfd6b9c500147b927d` | 0 | 0 | 0 | 0 | 0 |
| 8 | Enviar contrato | `68fa64f6009ff8001cd884b0` | 0 | 0 | 0 | 0 | 0 |
| 9 | Contrato assinado | `68fa650734fd5b00140834f5` | 0 | 0 | 0 | 0 | 0 |
| 10 | Kick Off | `68fa672904b7f1001726a034` | 0 | 0 | 0 | 0 | 0 |
| 11 | Aguardando compensação | `68fa6758a8bada00165b8bf0` | 0 | 0 | 0 | 0 | 0 |
| 12 | Aguardando restituição | `68fa67a4d6061c00192c434f` | 0 | 0 | 0 | 0 | 0 |

### REVISÃO DO RADAR (OPERACIONAL) -Mariah — 15 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Contratos Stand-by | `69fa3e31479dc00014f0cab8` | 0 | 0 | 0 | 0 | 0 |
| 2 | Envio do checklist e boas vindas | `69fa3e31479dc00014f0cab9` | 1 | 0 | 1 | 0 | 0 |
| 3 | Documentação em análise | `69fa3e31479dc00014f0caba` | 14 | 2 | 12 | 0 | 0 |
| 4 | CLIENTES CANCELADOS | `69fa3e31479dc00014f0cabb` | 0 | 0 | 0 | 0 | 0 |

### REVISÃO DO RADAR - ASSESSORIA SMART — 1 negócios

| Ordem | Etapa RD | ID da etapa | Cards | Em andamento | Ganhos | Perdidos | Pausados |
|---:|---|---|---:|---:|---:|---:|---:|
| 1 | Contratos Stand-by | `6aa89b99ca40910029d7ca7c` | 0 | 0 | 0 | 0 | 0 |
| 2 | Envio do checklist e boas vindas | `6aa89b99ca40910029d7ca7d` | 0 | 0 | 0 | 0 | 0 |
| 3 | Documentação em análise | `6aa89b99ca40910029d7ca7e` | 1 | 0 | 1 | 0 | 0 |
| 4 | CLIENTES CANCELADOS | `6aa89b99ca40910029d7ca7f` | 0 | 0 | 0 | 0 | 0 |

## Correspondência inicial de etapas

| Origem RD | Destino Alpha proposto | Condição |
|---|---|---|
| Leads / Novos leads | Radar / Novo Lead | Direto, desde que serviço seja revisão de Radar. |
| Leads / Aguardando retorno para reunião | Radar / Agendar Reunião | Validar se reunião já está marcada. |
| Leads / Em tratativa avançada | Radar / Em tratativas | Direto. |
| Leads / Stand-by - Folllow-up a 7 dias | Radar / Stand By ou Monitoramento | Exige decidir diferença entre espera terminal e acompanhamento ativo. |
| Leads / Sem qualificação | Radar / Sem viabilidade ou Lost | Exige motivo/status; nome da coluna não basta. |
| Leads / Leads frios - Não fazer follow-up | Radar / Monitoramento ou Lost | Não gerar tarefas de follow-up automaticamente. |
| Leads / Fechou com a concorrência | Radar / Lost | Verificar status: 90 de 95 estão ongoing no RD. |
| Leads / Contratos à enviar, Contratos enviados | Radar / Fechado + Financeiro / Novo Contrato, Elaboração ou Formalização | A etapa RD cruza dois pipelines Alpha; decidir se serão dois cards vinculados. |
| Financeiro Entrada / Elaborar contrato | Financeiro / Elaboração de Contrato | Direto com revisão do vínculo comercial. |
| Financeiro Entrada / STAND-BY | Financeiro / etapa a definir | Alpha Financeiro não tem coluna de espera. |
| Financeiro Entrada / Pagamento confirmado, Enviar NF - Contratação | Financeiro / Confirmação de Pagamento, Emissão de Nota Fiscal | Direto se cobrança for de contratação. |
| Financeiro Êxito / Deferidos - EFETUAR COBRANÇA, Enviar NF - êxito, Pgto confirmado | Financeiro / fluxo de êxito a definir | Não confundir cobrança de êxito com contratação inicial. |
| Operacional Maria/Mariah/Smart / Envio do checklist e boas vindas | Operacional / Boas vindas ou Envio do Check List Atualizado | Definir se boas-vindas já ocorreram. |
| Operacional Maria/Mariah/Smart / Documentação em análise | Operacional / Documentação em análise | Direto. |
| Operacional Protocolo / Aguardando despacho, Exigência fiscal, Resposta ao fiscal | Operacional / Aguardando despacho, Exigência Fiscal, Resposta | Direto com conferência de serviço e status. |
| Deferidos / Deferidos - RADAR | Operacional / Processo deferido | 177 cards na coluna, mas só 166 won; 11 ongoing exigem revisão. |
| Outros serviços: AFRMM, TTD-409, Habilitação, Recuperações, Falavinha | Novo pipeline/serviço a definir | 493 negócios fora da jornada atual; não inserir em Revisão de Radar. |

## Identidade e campos

- 1.464 negócios RD têm nome que é um CNPJ matematicamente válido; representam 1.389 CNPJs distintos. 69 CNPJs aparecem em mais de um negócio (até 3).
- Alpha tem 572 Clientes com CNPJ válido e único. 510 negócios RD, correspondentes a 476 CNPJs, encontram um Cliente Alpha pelo CNPJ no nome do negócio. Isso sugere vínculo de empresa, não identidade do card.
- 1.528 negócios RD referenciam organização, 1.469 referenciam ao menos um contato, 16 referenciam múltiplos contatos, todos têm owner. O único campo personalizado de organização tem rótulo operacional e não pode ser promovido a campo CNPJ geral sem validação.
- Identidade de migração recomendada: RD deal.id como chave externa estável; Cliente por CNPJ validado quando disponível; serviço + origem RD + posição atual para decidir cards vinculados. Não deduplicar negócios por CNPJ.
- Alpha não possui BpmCampo configurado. Campos RD podem ir para Cliente, para configuração futura de campo por pipeline/etapa, ou permanecer como metadados de importação. Não importar validações de obrigatoriedade automaticamente.

| Campo RD (slug) | Negócios com valor | Tratamento inicial |
|---|---:|---|
| `embasamento-do-processo` | 958 | Campo CRM/serviço a decidir |
| `mes-para-protocolar` | 962 | Campo CRM/serviço a decidir |
| `radar-atual-da-empresa` | 1017 | Campo CRM/serviço a decidir |
| `radar-pretendido` | 984 | Campo CRM/serviço a decidir |
| `regime-tributario-atual` | 1134 | Cliente.regimeTributario (normalizar opção) |
| `data-de-abertura-da-empresa` | 1005 | Cliente.dataConstituicao (converter data) |
| `capital-social` | 956 | Cliente.capitalSocial (normalizar opção) |
| `faturamento-nos-ultimos-5-anos` | 894 | Campo CRM/serviço a decidir |
| `armazem` | 951 | Campo CRM/serviço a decidir |
| `sede-da-empresa-endereco-cnpj` | 944 | Campo CRM/serviço a decidir |
| `faturas` | 847 | Campo CRM/serviço a decidir |
| `atuacao-da-empresa` | 997 | Campo CRM/serviço a decidir |
| `impostos-pagos-no-ultimo-semestre` | 797 | Campo CRM/serviço a decidir |
| `parceiro-indicante` | 205 | Campo CRM/serviço a decidir |
| `valor-acordado-no-contrato` | 909 | Campo CRM/serviço a decidir |
| `forma-de-pagamento` | 877 | Campo CRM/serviço a decidir |
| `tratativa-inicial-sdr` | 832 | Campo CRM/serviço a decidir |
| `estado` | 1259 | Cliente.uf (converter nome para sigla) |
| `opcao-de-recebimento` | 3 | Campo CRM/serviço a decidir |
| `data-de-protocolo-da-restituicao-perdcomp` | 0 | Campo CRM/serviço a decidir |
| `customer-success-cs` | 15 | Campo CRM/serviço a decidir |
| `status-de-deferimento-do-processo` | 406 | Campo CRM/serviço a decidir |
| `possui-cnae-elegivel-para-o-perse` | 210 | Campo CRM/serviço a decidir |
| `exportador` | 243 | Campo CRM/serviço a decidir |
| `deferimento` | 233 | Campo CRM/serviço a decidir |
| `ofertados-os-servicos-da-hai` | 221 | Campo CRM/serviço a decidir |
| `clientes-2x1` | 34 | Campo CRM/serviço a decidir |
| `percentual-de-honorarios-negociados` | 0 | Campo CRM/serviço a decidir |
| `honorarios-totais` | 0 | Campo CRM/serviço a decidir |
| `vendedor` | 814 | Campo CRM/serviço a decidir |
| `prospeccao-lista-logcomex` | 726 | Campo CRM/serviço a decidir |
| `nivel-de-complexidade-para-a-revisao` | 110 | Campo CRM/serviço a decidir |
| `historico-de-tentativas-anteriores-de-revisao` | 97 | Campo CRM/serviço a decidir |
| `formato-da-assessoria` | 85 | Campo CRM/serviço a decidir |

## Riscos e decisões antes de qualquer importação

1. Status ≠ etapa: no RD, 90/95 cards em 'Fechou com a concorrência' estão ongoing; 11/177 em 'Deferidos - RADAR' estão ongoing. Preservar os dois atributos e resolver divergências caso a caso.
2. Mesma empresa pode possuir vários negócios e serviços. A unidade de migração é o negócio RD, com ID externo, e o Alpha pode precisar criar cards vinculados em mais de um pipeline para a mesma jornada.
3. Funis antigos misturam etapas de contratação, operação, êxito e arquivamento. Não cabe um de/para único por nome da coluna; para cada negócio, usar funil, etapa, status, serviço, datas e vínculo com organização.
4. Apenas quatro cards estão hoje no Alpha; todos precisam de proteção contra duplicação no futuro import. Os 1.532 cards RD não foram migrados nesta análise.
5. Tarefas, notas, históricos, anexos e responsáveis exigem uma segunda camada de mapeamento. As 1.665 tarefas, 1.502 contatos, 1.549 organizações e 31 usuários foram extraídos em arquivos locais fora do Git. Notas só podem ser obtidas por negócio e ainda não foram extraídas.
6. O snapshot não congela o RD. Antes de migrar, repetir leitura, comparar IDs novos/alterados e definir corte temporal. Migração em banco exige plano, backup verificado, relatório Vault e aprovação específica.

## Consultas complementares confirmadas

| Dado | Situação em 2026-09-26 | Como obter ou limite |
|---|---|---|
| Anotações dos negócios | Disponível no MCP, por negócio. Duas consultas de amostra retornaram 7 e 6 notas; outra retornou 0. Não foi feita a extração dos 1.532 negócios. | Percorrer `deal_id` e paginar `GET /crm/v2/deals/{deal_id}/notes`; respeitar o limite de 120 requisições/minuto. [Referência RD](https://developers.rdstation.com/reference/crm-v2-list-notes-from-deal). |
| Arquivos/anexos | A API v2 possui listagem por negócio, mas o MCP configurado nesta sessão não expõe essa operação. Nenhum arquivo foi baixado. | Adicionar a operação autenticada `GET /crm/v2/deals/{deal_id}/files` à integração ou usar outro cliente autorizado. O retorno inclui metadados e URL. [Referência RD](https://developers.rdstation.com/reference/crm-v2-list-files-from-deal). |
| Tarefas | 1.665 registros únicos extraídos: 125 abertas, 1.521 concluídas e 19 canceladas. | A lista global permite associar cada tarefa pelo `deal_id`; o mapeamento para tarefas Alpha ainda não foi definido. [Referência RD](https://developers.rdstation.com/reference/crm-v2-list-tasks). |
| Histórico de mudanças de etapa/status | Nenhuma consulta de histórico de transições foi identificada entre as operações do MCP disponibilizadas nesta sessão. Não foi reconstruída a sequência histórica de movimentos. | Investigar exportação nativa ou outra API autorizada antes de prometer cronologia completa. Notas e tarefas são evidências parciais, não substituem uma trilha de transições. |
| Ordem vertical dos cards numa coluna | Não está no objeto de negócio ou nos critérios documentados de ordenação da lista v2. | É possível reproduzir funil, coluna e quantidade, mas não garantir a mesma ordem visual dos cards. [Referência RD](https://developers.rdstation.com/reference/crm-v2-list-deals). |

## Arquivos de apoio produzidos nesta leitura

- Este relatório Markdown é o artefato durável do diagnóstico, sem dados pessoais ou empresariais individualizados.
- `/tmp/rd-alpha-cards-2026-09-26.csv` contém uma linha por negócio, com funil, etapa, status e associação preliminar ao Cliente Alpha por CNPJ.
- `/tmp/rd-alpha-negocios-completos-2026-09-26.jsonl`, `/tmp/rd-alpha-organizacoes-2026-09-26.jsonl`, `/tmp/rd-alpha-contatos-2026-09-26.jsonl`, `/tmp/rd-alpha-tarefas-2026-09-26.jsonl`, `/tmp/rd-alpha-usuarios-2026-09-26.jsonl` e `/tmp/rd-alpha-campos-2026-09-26.jsonl` contêm os registros extraídos por entidade.
- Os arquivos de `/tmp` têm permissão `0600`, contêm dados reais e **não são backups duráveis**. Podem desaparecer na limpeza do sistema; para uma migração futura, repetir a extração em armazenamento privado aprovado e conferir os totais novamente. Não adicionar esses arquivos ao Git.

## Próxima rodada do de/para

1. Definir a política de identidade: `RD deal.id` deve ser preservado como referência externa; CNPJ associa empresa, e não funde negócios distintos.
2. Aprovar o destino das etapas ambíguas: perdas/frios, stand-by, contratação versus cobrança de êxito, clientes cancelados e funis de outros serviços.
3. Definir o destino dos 34 campos personalizados de negócio: Cliente, card, contexto de serviço, histórico ou retenção apenas para consulta. Tratar conflitos entre valores RD e Alpha sem sobrescrever automaticamente.
4. Extrair notas por negócio, listar metadados dos anexos após habilitar a operação e verificar se existe exportação de histórico. Relacionar tarefas, contatos, organizações e responsáveis aos cards candidatos.
5. Produzir uma prévia por `RD deal.id` com destino proposto, grau de confiança, divergências de status e possíveis duplicatas no Alpha. Somente depois considerar importação controlada.
