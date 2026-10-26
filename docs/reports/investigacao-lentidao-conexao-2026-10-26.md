# Investigação da lentidão e das falhas de conexão — 26/10/2026

Diagnóstico de produção, realizado aproximadamente entre 20:54 e 20:58 UTC (17:54–17:58 em Brasília). Escopo: investigação solicitada pelo usuário; nenhuma correção, publicação, alteração de configuração ou mutação de banco executada.

## Conclusão

**As falhas continuam em produção e têm evidência direta no transporte do banco e na validação de acesso.** Não são explicadas pelos avisos de geolocalização. O código publicado impõe cinco segundos a cada chamada HTTP do banco; leituras podem ultrapassar esse prazo. Existem também ações sem tratamento de rejeição no cliente, tráfego para versões anteriores e falhas da integração Onyx. A causa de rede/servidor das demoras atuais ainda não foi isolada.

## Fonte efetivamente publicada

- Alias `painel.alpha-comex.com`: deployment `dpl_GJYimTvUq5cLBDAbHML3bf4FVH8p`, READY, target production, commit `ca156313eec5e484e3efe64d64abc477ab3fc769`.
- O deployment tem origem `redeploy`, metadados `action=promote`, original `dpl_7zNz6Kqr3WcsNUPrxEqWWSaMsLu7`, Git ref `staging`. Isso identifica o artefato; não determina a autorização da promoção anterior.
- Alias staging: `dpl_7zNz6Kqr3WcsNUPrxEqWWSaMsLu7`, custom environment staging, mesmo commit.
- O checkout local está em staging e contém trabalho anterior não publicado nesta investigação. A análise do comportamento atual foi feita também diretamente nos blobs do commit publicado, por `git show ca156313:<arquivo>`.

## Evidências atuais

Consulta dos logs runtime de produção entre 18:54:59 e 20:54:59 UTC: **595 entradas error/warning**, sem página adicional informada pela API. São mensagens, não usuários nem requisições únicas.

No deployment atual, entre 20:15:17 e 20:54:34 UTC, aparecem 462 entradas:

- 351 contêm `Database transport deadline exceeded`.
- 74 contêm `AUTH_UNAVAILABLE`.
- 289 pertencem ao heartbeat; as categorias acima podem se sobrepor.
- Também há três falhas de unicidade `BpmTarefa.id`, dois registros P2028 e um registro contendo SQLITE_BUSY. São achados secundários, sem prova de explicar a indisponibilidade geral.

Exemplos correlacionáveis, sem dados pessoais:

| Horário UTC | Rota | Evidência |
| --- | --- | --- |
| 20:54:34.827 | `/api/heartbeat` | `usuarios.updateMany`: prazo de transporte excedido; request `htdcp-1793048060829-90071ef4faf3` |
| 20:54:33.245 | `/PainelAlpha` | `userNotesWorkspace.upsert`: prazo de transporte excedido; digest `1176582698` |
| 20:54:16.666 | `/PainelAlpha/CheckList` | `AUTH_UNAVAILABLE`; digest `2013556161` |
| 20:54:17.606 | `/PainelAlpha/cadastro` | `AUTH_UNAVAILABLE`; digest `899125570` |
| 20:53:17.547 | `/PainelAlpha/CalendarioAlpha` | `AUTH_UNAVAILABLE`; digest `1650521809` |

Na consulta de requests da última hora, o limite de 1.000 registros cobre apenas **20:52:23–20:54:47 UTC**, com paginação restante. Nessa amostra há 58 respostas 500 e 43 respostas 503, todas atribuídas ao deployment atual. Isso não é uma taxa representativa de toda a hora. A amostra também contém 137 requests para deployments anteriores. Logs de versões anteriores ainda registram execuções encerradas após 300 segundos; portanto, a experiência de usuários com páginas antigas pode diferir da versão atual. Não foi comprovado erro de identificador de Server Action.

## Banco: sonda mínima e limite de cinco segundos

Foram executadas somente três consultas sequenciais `SELECT 1`, usando cliente `@libsql/client/web`/HTTPS e credenciais do binding production obtidas em memória. O fingerprint da URL foi conferido com o registro histórico de produção e é distinto do staging. Nenhuma tabela de negócio foi consultada ou alterada.

| Horário UTC | Tempo | Resultado |
| --- | --- | --- |
| 20:56:01.747 | 1.703 ms | Sucesso |
| 20:56:07.250 | 5.502 ms | Sucesso |
| 20:56:07.721 | 472 ms | Sucesso |

**Limite da medição:** sonda a partir desta máquina de diagnóstico, não de uma função Vercel. Três amostras não medem p95 nem capacidade. Demonstram acessibilidade e variação; não demonstram normalização do serviço nem que as demoras sejam exclusivamente de rede.

O commit publicado conecta `src/lib/prisma.ts` a `criarFetchBanco()`, em `src/lib/db-fetch.ts`. Esse wrapper cancela a chamada e o corpo da resposta após `DB_ROUNDTRIP_TIMEOUT_MS = 5_000`. A validação de acesso em `src/lib/auth/acesso-painel.ts` tem orçamento independente de 5.000 ms. O erro predominante dos logs é a mensagem criada pelo próprio wrapper.

Assim, uma chamada que levaria mais de cinco segundos pode ser abortada pelo aplicativo. O orçamento reduz esperas indefinidas, mas não recupera conectividade e pode recusar respostas lentas que acabariam concluindo. A sonda de 5.502 ms reforça a necessidade de calibrar esse prazo com medições no runtime real. Não basta aumentar indiscriminadamente o timeout.

O adapter instalado também serializa operações por mutex; uma chamada lenta pode atrasar as seguintes na mesma instância. É um mecanismo compatível com espera em cascata, ainda sem medição da fila em produção nesta investigação.

## Incidente do provedor e desconexões

O [incidente oficial do Turso](https://status.turso.tech/incident/1103861?mp=true) informa falha de load balancer em AWS us-east-1: publicado às 16:18 UTC e resolvido às 17:58 UTC (13:18–14:58 em Brasília), após transferência do tráfego para outro balanceador. O [status geral](https://status.turso.tech/) consultado indicava serviços operacionais.

O diagnóstico privado anterior, de 16:39 UTC, já havia correlacionado o mesmo request de página a uma falha Turso `UND_ERR_SOCKET`, seguida de recusa de autenticação, apesar de uma leitura separada confirmar usuário ativo. A versão antiga tratava falha de leitura como bloqueio da sessão. O código atual já distingue `INDISPONIVEL` de `NEGADO`, preservando claims para recuperação e recusando temporariamente o acesso protegido.

**As falhas de 20:54 UTC são posteriores à resolução anunciada.** A evidência não permite atribuí-las integralmente ao incidente encerrado nem afirmar que o banco está permanentemente desconectado. A cadeia atual comprovada é: prazo do transporte/validação excedido → acesso temporariamente indisponível → 503 nas rotas com tradução explícita ou erro de RSC/Server Action nas demais.

## Mapeamento dos erros do console

| Erro | Diagnóstico |
| --- | --- |
| Geolocalização bloqueada | `next.config.ts` envia `geolocation=()`, enquanto `BibbleWeatherWidget.tsx` e `BibbleSpriteCompanion.tsx` chamam `navigator.geolocation`. Conflito confirmado, separado da conexão com o banco. |
| `Allow attribute ... allowfullscreen` | O iframe declara `allow="autoplay; fullscreen"` e `allowFullScreen` simultaneamente. Aviso de configuração redundante; sem evidência de causar os 5xx. |
| POST de `/PainelAlpha` e módulos com 500 | Logs atuais mostram indisponibilidade de autorização e timeout em ações como `userNotesWorkspace.upsert`. O log do navegador sozinho não identifica qual Server Action originou cada POST. |
| Promise rejeitada / erro genérico de Server Components | `useNotasLembretesPendentes` chama `void VerificarLembretesPendentes()` sem catch; `NotesGlobalTaskbar` possui chamadas de sincronização/persistência sem tratamento de rejeição. Uma falha de autorização ou banco pode escapar e gerar o erro genérico exibido. |
| `/api/bpm/tarefas/alertas` 503 | Existe tratamento temporário; a correção de retry específica para `UND_ERR_CONNECT_TIMEOUT` não cobre automaticamente o novo erro de prazo com code 23. Não significa que o transporte foi recuperado. |
| `/api/bibble/models` 503 | Pode vir da validação de acesso indisponível ou configuração inválida. A falha comum de conexão ao modelo nesse handler retorna JSON com status 200; portanto, não interpretar todo 503 como servidor de IA desligado. |
| `/api/bibble/voice` 503 | Pode vir da validação de acesso ou do health/config da voz. Sem corpo autenticado da resposta, não é possível distinguir cada ocorrência. |
| `/api/onyx/agents` 502 | O client em `src/lib/onyx/client.ts` traduz falha de conexão ao Onyx para 502 e também propaga 502 do upstream. Requer diagnóstico próprio da integração, além do banco. |

Busca direcionada, limitada ao deployment atual, entre 19:56 e 20:56 UTC: 39 requests, sem página adicional: voz 29×503; models 2×503 e 3×200; Onyx 3×502 e 2×503. Um models 200 não comprova saúde do modelo, pois o handler também retorna erros em JSON com 200.

As chaves de configuração dos três serviços constam no deployment e no projeto production. A API omitiu seus valores sensitive; isso **não significa variáveis ausentes**. Não houve tentativa de contornar essa restrição, nem teste direto dos upstreams. O digest/corpo de cada resposta e a saúde desses serviços permanecem pendências.

## Amplificadores de carga e prioridade de correção

1. **Transporte e prazo:** medir conexão, espera por headers/corpo e fila no runtime Vercel; calibrar o prazo de 5 s e os budgets de autorização juntos. Se houver nova falha regional, levar requests/horários ao Turso. Não repetir automaticamente escritas após timeout, pois o resultado da operação pode ser desconhecido.
2. **Carga recorrente:** heartbeat escreve a cada 20 s por aba principal; broadcast consulta a cada 15 s e o componente não evita execução em iframes; notificações usam polling frequente. Abas de módulos inativas continuam montadas. Consolidar consultas globais, impedir sobreposição e aplicar espera progressiva durante falhas, validando primeiro em staging. O volume observado de broadcast é evidência de frequência, não prova isolada de saturação do banco.
3. **Ações compartilhadas:** tratar rejeições de notas, lembretes e demais ações do shell; preservar rascunhos e apresentar indisponibilidade recuperável. Verificar as ações específicas dos POSTs com 500 antes de alterar módulos indiscriminadamente.
4. **Integrações IA:** capturar o código público dos 503 autenticados e testar saúde/alcance do Onyx e da voz pelos caminhos autorizados. Separar falha de autenticação/banco de falha do upstream.
5. **Versões antigas e ruído:** orientar recarga controlada após preservar trabalho; corrigir a tentativa de geolocalização incompatível com a política e remover a configuração redundante de fullscreen. Recarga não corrige conectividade do banco.

Qualquer implementação deve ocorrer primeiro em staging. Não há justificativa comprovada nesta investigação para migration, alteração de schema, restauração de backup, troca de credenciais ou rollback automático.

## Evidências e limites operacionais

- Artefatos privados: `/tmp/alpha-investigacao-20261026-2055/` — runtime/requests, consulta dirigida de IA, medição SELECT 1 e anotação de limitação de inspeção dos upstreams. Diretório fora do Git.
- Evidência anterior consultada: `/home/ialpha/.config/painel-alpha/incidente-painel-banco-20261026/` e recibos de publicação em `/home/ialpha/.config/painel-alpha/sessao-resiliencia-20261026/`.
- Vinculado à investigação anterior da `docs/stories/story-bpm-alertas-timeout-conexao.md`; o escopo da implementação encerrada nessa story não foi ampliado.
- Sem alteração de código, dados, ambientes ou deploy. Não foram executados lint/typecheck/test/build: esta entrega é diagnóstica e documental, não valida mudanças de aplicação.
