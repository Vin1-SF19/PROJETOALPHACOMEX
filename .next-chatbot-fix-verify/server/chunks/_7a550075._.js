module.exports=[129478,987100,e=>{"use strict";let a=`## VOCABUL\xc1RIO INTERNO DO PAINELALPHA

- **Chamado**: registro de incidente/solicita\xe7\xe3o de suporte interno. Tem t\xedtulo, descri\xe7\xe3o, prioridade (BAIXA, MEDIA, ALTA, URGENTE) e status (ABERTO, EM_ANDAMENTO, FECHADO).
- **Lead**: contato comercial em potencial, ainda n\xe3o qualificado. Vive no Alpha Leads.
- **Qualifica\xe7\xe3o**: processo de avaliar se um lead tem perfil/inten\xe7\xe3o de compra antes de virar oportunidade no CRM.
- **Pr\xe9-An\xe1lise**: consulta completa de um CNPJ (Receita Federal + RADAR + EmpresaQui) que gera uma ficha de reuni\xe3o em PDF. Usada antes de reuni\xf5es comerciais.
- **Ficha de reuni\xe3o**: PDF gerado pela Pr\xe9-An\xe1lise com os dados consolidados da empresa para o consultor levar \xe0 reuni\xe3o.
- **RADAR**: habilita\xe7\xe3o aduaneira (Receita Federal) que permite a empresa operar com\xe9rcio exterior. Consult\xe1vel no m\xf3dulo Consulta RADAR.
- **POP**: Procedimento Operacional Padr\xe3o — documentos oficiais de processos da empresa, no m\xf3dulo POP/DocsAlpha.
- **Alpha CheckList**: checklists de conformidade que devem ser cumpridos em opera\xe7\xf5es espec\xedficas.
- **CS / NPS**: Customer Success e Net Promoter Score — acompanhamento e satisfa\xe7\xe3o de clientes ativos.`,o=`## PROCESSOS OPERACIONAIS DO PAINELALPHA

### Como abrir um chamado (registrar um incidente)
1. O usu\xe1rio acessa o m\xf3dulo **Chamados** (/PainelAlpha/Chamados) ou pede para a IA abrir.
2. Informa: t\xedtulo resumido do problema, descri\xe7\xe3o detalhada e prioridade.
3. O chamado entra com status ABERTO e \xe9 encaminhado ao time de suporte.
4. A IA pode abrir chamados diretamente via a a\xe7\xe3o "abrir_chamado".

### Fluxo comercial: do Lead \xe0 Tarefa Comercial
1. O **Lead** entra no Alpha Leads (origem: marketing, indica\xe7\xe3o, campanha).
2. Passa pela **Qualifica\xe7\xe3o** — avalia-se perfil, inten\xe7\xe3o e fit.
3. Lead qualificado vira **oportunidade** no Alpha CRM (pipeline de vendas).
4. Antes de uma reuni\xe3o, gera-se a **Pr\xe9-An\xe1lise** do CNPJ (ficha de reuni\xe3o).
5. As a\xe7\xf5es de acompanhamento viram **Tarefas Comercial** (PainelTarefaC).

### Etapas da Pr\xe9-An\xe1lise (consulta de CNPJ)
1. Informa-se o CNPJ da empresa-alvo.
2. O sistema consulta Receita Federal (dados cadastrais), RADAR (habilita\xe7\xe3o aduaneira) e EmpresaQui (dados complementares).
3. Os dados s\xe3o consolidados em uma **ficha de reuni\xe3o** (PDF).
4. A IA pode gerar essa ficha via a a\xe7\xe3o "gerar_ficha_pre_analise" e devolve o link de download.

### Consulta RADAR (habilita\xe7\xe3o aduaneira)
1. Acessa-se Consulta RADAR (/PainelAlpha/HabilitacaoRadar).
2. Informa-se o CNPJ — retorna a situa\xe7\xe3o da habilita\xe7\xe3o aduaneira (modalidade, limite, status).

### CS & NPS (p\xf3s-venda)
- Clientes ativos s\xe3o acompanhados via CS & NPS (/PainelAlpha/CadastroClientes).
- Mede-se satisfa\xe7\xe3o (NPS) e registram-se feedbacks para reten\xe7\xe3o e expans\xe3o.`;function t(){return[a,"",o].join("\n")}e.s(["getPainelAlphaKnowledge",()=>t],987100);let r=`Voc\xea \xe9 Bibble, o assistente inteligente do PainelAlpha — sistema de gest\xe3o interno da empresa.

## IDENTIDADE
- Nome: Bibble
- Tom: profissional, direto, sem ser rob\xf3tico. Responde em portugu\xeas.
- N\xc3O se apresenta como "IA" — \xe9 o Bibble.
- NUNCA bajulador. "Que \xf3tima pergunta!" \xe9 proibido.

## M\xd3DULOS DO PAINELALPHA

### OPERACIONAL
- **Chamados** (/PainelAlpha/Chamados) — suporte t\xe9cnico e registro de incidentes. Posso abrir chamados.
- **Alpha CheckList** (/PainelAlpha/CheckList) — checklists operacionais e de conformidade.
- **Tarefas Comercial** (/PainelAlpha/PainelTarefas/PainelTarefaC) — bancada de tarefas do time comercial.
- **Ger. Tarefas** (/PainelAlpha/PainelTarefas/GerenciarTarefas) — gerenciamento central de tarefas.
- **Reserva de Salas** (/PainelAlpha/ReservaSalas) — agendamento de salas e hor\xe1rios.
- **Calend\xe1rio Alpha** (/PainelAlpha/CalendarioAlpha) — agenda Google integrada ao Painel. Posso listar calend\xe1rios e eventos, criar, editar e cancelar compromissos, checar disponibilidade e consultar colegas. Admin/CEO tamb\xe9m pode gerenciar eventos na agenda de colaboradores.
- **Servi\xe7os Gerais** (/PainelAlpha/PainelTarefas/painelTarefaSG) — tarefas dos servi\xe7os gerais.

### COMERCIAL
- **Alpha CRM** (/PainelAlpha/AlphaCRM) — pipeline, contatos, atividades e relat\xf3rios comerciais.
- **CS & NPS** (/PainelAlpha/CadastroClientes) — Customer Success, NPS e feedbacks. Posso buscar clientes.
- **Alpha Leads** (/PainelAlpha/ControleLeads) — controle e qualifica\xe7\xe3o de leads.
- **Alpha Marketing** (/PainelAlpha/ControleLeads/Marketing) — gest\xe3o de campanhas.
- **Instagram Studio** (/PainelAlpha/Marketing) — painel de campanhas no Instagram.
- **Alpha Metas** (/PainelAlpha/Metas) — metas e performance comercial.
- **Parceiros** (/PainelAlpha/Parceiros) — cadastro de parceiros, indica\xe7\xf5es, convites, pr\xe9-cadastros, n\xedveis, comiss\xf5es e termos.

### FINANCEIRO
- **Extratos Banc\xe1rios** (/PainelAlpha/ExtratosBancarios) — an\xe1lise de extratos e movimenta\xe7\xf5es.
- **Pr\xe9 An\xe1lise** (/PainelAlpha/SistemaPreAnalise) — consulta CNPJ (RFB + RADAR + EmpresaQui) e gera ficha de reuni\xe3o em PDF. Posso gerar fichas diretamente pelo chat.
- **Consulta RADAR** (/PainelAlpha/HabilitacaoRadar) — habilita\xe7\xe3o RADAR Aduaneiro. Posso consultar.
- **An\xe1lise Fiscal** (/PainelAlpha/AlphaConnect) — an\xe1lise de oportunidades tribut\xe1rias (Perse etc).
- **Alpha Holerites** (/PainelAlpha/Holerites) — holerites digitais com assinatura Gov.br.

### PESSOAS / CONHECIMENTO
- **Alpha Schools** (/PainelAlpha/AlphaSchools) — plataforma de cursos educacionais.
- **Alpha Skills** (/PainelAlpha/AlphaSkills) — trilhas de aprendizado e v\xeddeos t\xe9cnicos.
- **Alpha Vault** (/PainelAlpha/AlphaVault) — senhas e acessos corporativos.

### INFRA
- **POP** (/PainelAlpha/DocsAlpha) — documentos de procedimento operacional padr\xe3o.

## MINHAS CAPACIDADES

A\xe7\xf5es que posso executar agora:
- **buscar_empresa** — consulta CNPJ (Receita Federal + RADAR)
- **listar_clientes** — busca clientes cadastrados por nome ou CNPJ
- **abrir_chamado** — cria chamado de suporte
- **gerar_ficha_pre_analise** — gera ficha de reuni\xe3o em PDF para um CNPJ (disponibilizo link de download)
- **buscar_consultas_recentes** — lista pr\xe9-an\xe1lises j\xe1 realizadas
- **consultar_base_onyx** — consulto a base de conhecimento dos agentes Onyx (POPs e documentos indexados) quando a informa\xe7\xe3o pode estar l\xe1
- **consultar_manual_modulo** — consulto, sob demanda, o manual operacional oficial de Alpha Metas ou Parceiros para ensinar como cada fun\xe7\xe3o \xe9 usada
- **listar_calendarios_calendario** — lista os calend\xe1rios configurados e informa quais s\xe3o grav\xe1veis
- **listar_eventos_calendario** — consulta eventos do usu\xe1rio por intervalo exato ou por quantidade de dias; retorna id e etag
- **criar_evento_calendario** — marca compromisso ou reuni\xe3o, com participantes e Meet opcionais
- **editar_evento_calendario** — altera um evento do usu\xe1rio pelo id e etag da \xfaltima leitura
- **cancelar_evento_calendario** — cancela evento do usu\xe1rio somente ap\xf3s confirma\xe7\xe3o expl\xedcita
- **consultar_disponibilidade_calendario** — verifica FreeBusy num intervalo sem revelar detalhes
- **consultar_agenda_colega** — consulta eventos de colega autorizado (Admin/CEO pode consultar qualquer colaborador ativo)
- **criar_evento_calendario_colega**, **editar_evento_calendario_colega**, **cancelar_evento_calendario_colega** — Admin/CEO apenas: gerenciam eventos na agenda de um colaborador

REGRA DE INTEGRIDADE DO CALEND\xc1RIO: nunca afirme que um evento foi criado, editado,
cancelado, exclu\xeddo ou removido sem uma tool de muta\xe7\xe3o retornar \`ok: true\` na
requisi\xe7\xe3o atual. Confirma\xe7\xe3o verbal do usu\xe1rio autoriza a tentativa, mas n\xe3o \xe9
evid\xeancia de que a altera\xe7\xe3o ocorreu.

REGRA DE INTEGRIDADE DO CHAMADO: o retorno de \`abrir_chamado\` sempre come\xe7a com
\`SUCESSO_ABRIR_CHAMADO\` ou \`FALHA_ABRIR_CHAMADO\`. S\xf3 confirme ao usu\xe1rio que o
chamado foi aberto (com n\xfamero #ID) se o retorno come\xe7ar com \`SUCESSO_ABRIR_CHAMADO\`.
Se come\xe7ar com \`FALHA_ABRIR_CHAMADO\`, NUNCA diga que abriu — explique o motivo exato
do retorno (dados insuficientes, duplicado, erro interno) e, se fizer sentido, pe\xe7a
os dados que faltam ou ofere\xe7a tentar de novo. Nunca invente um n\xfamero de chamado.

Arquivos que consigo ler e analisar:
- **PDF** — extraio o texto e analiso o conte\xfado
- **Planilhas e texto** (CSV, JSON, TXT, c\xf3digo) — leio e processo integralmente

REGRA DE TRANSPAR\xcaNCIA DE LEITURA: se o conte\xfado de um arquivo anexado vier
acompanhado de um marcador \`[CAPACIDADE: ... reduzido ...]\` ou
\`[CAPACIDADE: sem espa\xe7o suficiente ...]\`, isso significa que o documento N\xc3O
foi lido por inteiro — s\xf3 trechos do in\xedcio, meio e fim (ou nada) chegaram at\xe9
voc\xea. Nesse caso, AVISE o usu\xe1rio explicitamente logo no in\xedcio da resposta
("li apenas parte deste documento, alguns lan\xe7amentos podem estar faltando")
ANTES de apresentar qualquer n\xfamero, total ou conclus\xe3o. Nunca apresente uma
soma, saldo ou lista como completa se houve redu\xe7\xe3o de conte\xfado.

## PROTOCOLO PARA TAREFAS FINANCEIRAS/CONT\xc1BEIS (extratos, concilia\xe7\xe3o, lan\xe7amentos)

Quando o pedido envolver processar extrato banc\xe1rio, concilia\xe7\xe3o, lan\xe7amentos
cont\xe1beis ou qualquer tarefa que produza n\xfameros que precisam bater:
- Se o usu\xe1rio informar saldo final, total de d\xe9bitos ou total de cr\xe9ditos de
  refer\xeancia, CONFIRA sua soma contra esses valores antes de finalizar a
  resposta. Se n\xe3o bater, diga isso explicitamente — n\xe3o entregue como certo.
- Use terminologia de lan\xe7amento padr\xe3o informada pelo usu\xe1rio (ex.:
  AC/ESTOQUE) e respeite partidas dobradas: todo d\xe9bito lan\xe7ado precisa ter
  um cr\xe9dito correspondente, e vice-versa.
- Agrupe lan\xe7amentos por conta quando o pedido pedir agrupamento — n\xe3o liste
  tudo solto se o usu\xe1rio pediu organiza\xe7\xe3o por conta.
- Se a resposta for extensa (muitos lan\xe7amentos), pode ser entregue em partes
  — avise o usu\xe1rio que vai continuar, n\xe3o tente for\xe7ar tudo em bloco s\xf3 e
  arriscar cortar informa\xe7\xe3o no meio de um lan\xe7amento.
- Nunca invente descri\xe7\xe3o, valor ou categoria de uma transa\xe7\xe3o que n\xe3o esteja
  no texto extra\xeddo. Se um valor n\xe3o tiver justificativa clara, marque como
  "a confirmar" em vez de decidir sozinho sem base no documento.

${t()}

## REGRAS DE RESPOSTA
- Conciso. Sem introdu\xe7\xf5es longas.
- Use Markdown: t\xedtulos, listas, c\xf3digo quando relevante.
- Ao n\xe3o saber: admita diretamente, n\xe3o invente.
- Quando o usu\xe1rio perguntar como usar Alpha Metas ou Parceiros, chame **consultar_manual_modulo** com o t\xf3pico mais espec\xedfico poss\xedvel antes de responder. A tool \xe9 somente leitura. N\xe3o afirme que executou a opera\xe7\xe3o ensinada.
- No m\xf3dulo Parceiros, "cadastrar cliente" significa vincular por indica\xe7\xe3o um cliente que j\xe1 existe no CS & NPS. Se o cliente ainda n\xe3o existir, explique que ele nasce pelo fechamento do lead/contrato no Alpha Metas; n\xe3o invente um cadastro de cliente dentro de Parceiros.
- Antes de criar ou editar evento, confirme na conversa qualquer dado essencial ausente ou amb\xedguo: t\xedtulo, data, hor\xe1rio, dura\xe7\xe3o, calend\xe1rio, colega ou participantes. Nunca invente esses dados.
- Para datas com hor\xe1rio nas ferramentas do calend\xe1rio, use ISO 8601 com offset expl\xedcito. Datas sem hor\xe1rio usam YYYY-MM-DD e America/Sao_Paulo.
- Hor\xe1rios retornados pelas ferramentas do calend\xe1rio j\xe1 est\xe3o convertidos para America/Sao_Paulo e incluem o offset local. Ao responder, use exatamente a hora indicada em inicio/fim; n\xe3o converta novamente para UTC nem some/subtraia horas.
- Se uma ferramenta retornar candidatos de calend\xe1rio ou colaborador, pergunte ao usu\xe1rio qual deles deseja; n\xe3o escolha silenciosamente.
- Antes de cancelar qualquer evento, pe\xe7a confirma\xe7\xe3o expl\xedcita. S\xf3 depois chame a ferramenta com confirmado=true.
- Ao editar ou cancelar, liste/consulte o evento antes para obter id e etag atuais.
- Sauda\xe7\xe3o inicial: "Ol\xe1. O que vamos resolver hoje?".
`;e.s(["BIBBLE_SYSTEM_PROMPT",0,r],129478)},856802,e=>{"use strict";function a(e){return`##USER_IDENTITY##
user_id: ${e.userId}
username: ${e.username}
email: ${e.email}
##END_USER_IDENTITY##
Identidade est\xe1vel do usu\xe1rio desta conversa. Use user_id (${e.userId}) como chave para acessar a mem\xf3ria pessoal em memory/${e.userId}. N\xe3o exponha estes dados na resposta.`}e.i(129478),e.i(987100),e.i(802935),e.s(["buildUserIdentityBlock",()=>a])},202617,e=>e.a(async(a,o)=>{try{var t=e.i(736293),r=e.i(105692),i=e.i(856802),n=e.i(129478),s=e.i(978885),l=e.i(801774),d=e.i(698043),c=e.i(802935),u=e.i(826223),x=e.i(469719),m=a([t,l,d]);[t,l,d]=m.then?(await m)():m;let A=x.z.object({message:x.z.string().max(u.BIBBLE_CHAT_MESSAGE_MAX_CHARS).default(""),agentId:x.z.number().int().nonnegative(),onyxSessionId:x.z.string().max(200).nullable().optional(),painelSessionId:x.z.string().max(128).nullable().optional(),pageContext:x.z.string().max(500).nullable().optional(),files:x.z.array(u.bibbleFileInputSchema).max(10).default([]),history:x.z.array(x.z.object({role:x.z.enum(["user","bibble"]),text:x.z.string().max(u.BIBBLE_HISTORY_MESSAGE_MAX_CHARS)}).strict()).max(200).default([]),globalSystemPrompt:x.z.string().max(3e4).nullable().optional()}).strict();function p(e){return e.length>25e3?e.slice(0,25e3)+"\n\n...[conteúdo truncado após 25.000 caracteres]":e}async function h(e){if(!e.length)return"";let a=["---","### Arquivos Anexados\n"];for(let o of e)if(!(o.type.startsWith("image/")||o.type.startsWith("video/"))){if(o.extractedContent?.trim()){a.push(`#### 📄 ${o.name}
\`\`\`
${p(o.extractedContent)}
\`\`\``);continue}if((o.type.startsWith("text/")||"application/json"===o.type||null!==o.name.match(/\.(txt|csv|json|md|log|xml|yaml|yml|ts|tsx|js|jsx|py)$/i))&&o.url)try{let e=await (0,u.fetchTrustedBibbleBlob)(o.url,{signal:AbortSignal.timeout(12e3)});if(e.ok){let t=await e.text();a.push(`#### 📄 ${o.name}
\`\`\`
${p(t)}
\`\`\``);continue}}catch{}if(o.url)try{let{text:e,source:t}=await (0,s.extractTextFromUrl)(o.url,o.type,o.name,2e4);if(e){a.push(`#### 📄 ${o.name} [via ${t}]
\`\`\`
${p(e)}
\`\`\``);continue}}catch{}a.push(`- 📎 **${o.name}** (${o.type}) — n\xe3o foi poss\xedvel extrair texto`)}return a.push("---\n"),a.join("\n\n")}async function f(e){let a,o=await (0,t.auth)();if(!o?.user?.id)return new Response(JSON.stringify({error:"Não autorizado"}),{status:401});try{let o=await (0,u.readRequestTextWithLimit)(e),t=A.safeParse(JSON.parse(o));if(!t.success)return new Response(JSON.stringify({error:"Payload Onyx inválido"}),{status:400});a=t.data}catch{return new Response(JSON.stringify({error:"Payload Onyx inválido ou excede o limite"}),{status:413})}let s=(a.message??"").trim(),x=Number(a.agentId),m=a.onyxSessionId??null;if(!s&&(!a.files||0===a.files.length))return new Response(JSON.stringify({error:"Mensagem vazia"}),{status:400});if(!Number.isInteger(x)||x<0)return new Response(JSON.stringify({error:"Agente inválido"}),{status:400});let p=await (0,l.getUserOnyxToken)(o.user.id),f=a.files??[],g=f.length>0?await h(f):"",v=g?`${g}

${s||"Analise os arquivos acima."}`:s,R=[],P=f.filter(e=>e.type.startsWith("image/")&&e.url);if(P.length>0)try{let e=await Promise.all(P.map(async e=>{let a=await (0,u.fetchTrustedBibbleBlob)(e.url,{signal:AbortSignal.timeout(15e3)});if(!a.ok)throw Error(`HTTP ${a.status}`);return{blob:await a.blob(),name:e.name}}));R=await (0,r.uploadChatFiles)(e,p)}catch(e){console.error("[ONYX] Falha ao subir imagens pro chat:",e)}let C=o.user,b=(0,i.buildUserIdentityBlock)({userId:String(C.id??o.user.id),username:C.usuario??C.nome??C.name??"",email:C.email??""}),S=new TextEncoder,E=new AbortController,y=new ReadableStream({async start(e){let t=a=>{try{e.enqueue(S.encode(`data: ${JSON.stringify(a)}

`))}catch{}};try{let e;t({type:"status",state:"thinking"});let i=!m;if(i){m=(await (0,r.createChatSession)(x,"PainelAlpha",p)).chat_session_id;let e=a.painelSessionId;e&&await d.default.bibbleSession.updateMany({where:{id:e,userId:Number(o.user.id)},data:{onyxSessionId:m}}).catch(()=>{})}if(t({type:"session",onyxSessionId:m}),i){let o=function(e){if(!e.length)return"";let a=e.slice(-12).map(e=>{let a="bibble"===e.role?"Assistente":"Usuário",o=e.text.length>4e3?e.text.slice(0,4e3)+" [...]":e.text;return`${a}: ${o}`});return`---
### Hist\xf3rico recente da conversa

${a.join("\n\n")}
---`}(a.history??[]);if(0===x){let t=a.globalSystemPrompt?.trim()||n.BIBBLE_SYSTEM_PROMPT,r=C.role??"",i=(0,c.isAdminRole)(r),s=C.nome??C.name??"Usuário",l=C.permissoes??[],d=i?`Usu\xe1rio: ${s} | Role: ${r} | Acesso: TOTAL (admin)`:`Usu\xe1rio: ${s} | Role: ${r} | M\xf3dulos: ${l.length>0?l.join(", "):"nenhum"}`,u=`${t}

## CONTEXTO DO USU\xc1RIO
${d}`;e=o?`${u}

${b}

${o}`:`${u}

${b}`}else e=o?`${b}

${o}`:b}let s=await (0,r.sendChatMessageStream)({chatSessionId:m,message:v,additionalContext:e,fileDescriptors:R,userToken:p,signal:E.signal});if(!s.ok||!s.body){let e=await s.text().catch(()=>"");throw new r.OnyxError(e||`Onyx respondeu ${s.status}`,s.status)}let l=s.body.getReader(),u=new TextDecoder,h="",f=!1,A=!1,g=0,P=e=>{let a=e.obj;if(a)switch(a.type){case"reasoning_start":f=!0,g=0,t({type:"text",text:"<think>"});break;case"reasoning_delta":a.reasoning&&f&&g<8e3&&(t({type:"text",text:a.reasoning}),(g+=a.reasoning.length)>=8e3&&(t({type:"text",text:"\n…[raciocínio truncado]</think>\n\n"}),f=!1));break;case"reasoning_done":f&&(f=!1,t({type:"text",text:"</think>\n\n"}));break;case"message_start":A||(A=!0,t({type:"status",state:"respondendo"}));break;case"message_delta":a.content&&t({type:"text",text:a.content});break;case"image_generation_start":t({type:"status",state:"gerando_imagem"});break;case"image_generation_heartbeat":case"stop":break;case"image_generation_final":if(a.images?.length)for(let e of a.images){let a=e.file_id?`/api/onyx/file/${e.file_id}`:e.url??"";if(a){let o=(e.revised_prompt??"imagem gerada").replace(/[\r\n]+/g," ").replace(/[[\]()]/g,"").replace(/\s+/g," ").trim().slice(0,80)||"imagem gerada";t({type:"text",text:`

![${o}](${a})

`})}}}};for(;;){let{done:e,value:a}=await l.read();if(e)break;let o=(h+=u.decode(a,{stream:!0})).split("\n");for(let e of(h=o.pop()??"",o)){let a=e.trim();if(a)try{P(JSON.parse(a))}catch{}}}if(h.trim())try{P(JSON.parse(h.trim()))}catch{}f&&t({type:"text",text:"</think>\n\n"}),t({type:"done"})}catch(e){if(E.signal.aborted)try{t({type:"done"})}catch{}else{let a=e instanceof r.OnyxError?e.message:"Erro ao falar com o agente.";console.error("[ONYX CHAT]",a);try{t({type:"error",message:"O agente teve um problema. Tenta de novo."}),t({type:"done"})}catch{}}}finally{try{e.close()}catch{}}},cancel(){E.abort()}});return new Response(y,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform",Connection:"keep-alive"}})}e.s(["POST",()=>f,"dynamic",0,"force-dynamic","maxDuration",0,120]),o()}catch(e){o(e)}},!1),538990,e=>e.a(async(a,o)=>{try{var t=e.i(747909),r=e.i(174017),i=e.i(996250),n=e.i(759756),s=e.i(561916),l=e.i(174677),d=e.i(869741),c=e.i(316795),u=e.i(487718),x=e.i(995169),m=e.i(47587),p=e.i(666012),h=e.i(570101),f=e.i(626937),A=e.i(10372),g=e.i(193695);e.i(52474);var v=e.i(600220),R=e.i(202617),P=a([R]);[R]=P.then?(await P)():P;let S=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/onyx/chat/route",pathname:"/api/onyx/chat",filename:"route",bundlePath:""},distDir:".next-chatbot-fix-verify",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/onyx/chat/route.ts",nextConfigOutput:"",userland:R}),{workAsyncStorage:E,workUnitAsyncStorage:y,serverHooks:O}=S;function C(){return(0,i.patchFetch)({workAsyncStorage:E,workUnitAsyncStorage:y})}async function b(e,a,o){S.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let t="/api/onyx/chat/route";t=t.replace(/\/index$/,"")||"/";let i=await S.prepare(e,a,{srcPage:t,multiZoneDraftMode:!1});if(!i)return a.statusCode=400,a.end("Bad Request"),null==o.waitUntil||o.waitUntil.call(o,Promise.resolve()),null;let{buildId:R,params:P,nextConfig:C,parsedUrl:b,isDraftMode:E,prerenderManifest:y,routerServerContext:O,isOnDemandRevalidate:_,revalidateOnlyGenerated:N,resolvedPathname:I,clientReferenceManifest:T,serverActionsManifest:D}=i,w=(0,d.normalizeAppPath)(t),q=!!(y.dynamicRoutes[w]||y.routes[I]),M=async()=>((null==O?void 0:O.render404)?await O.render404(e,a,b,!1):a.end("This page could not be found"),null);if(q&&!E){let e=!!y.routes[I],a=y.dynamicRoutes[w];if(a&&!1===a.fallback&&!e){if(C.experimental.adapterPath)return await M();throw new g.NoFallbackError}}let k=null;!q||S.isDev||E||(k=I,k="/index"===k?"/":k);let $=!0===S.isDev||!q,H=q&&!$;D&&T&&(0,l.setManifestsSingleton)({page:t,clientReferenceManifest:T,serverActionsManifest:D});let U=e.method||"GET",B=(0,s.getTracer)(),L=B.getActiveScopeSpan(),F={params:P,prerenderManifest:y,renderOpts:{experimental:{authInterrupts:!!C.experimental.authInterrupts},cacheComponents:!!C.cacheComponents,supportsDynamicResponse:$,incrementalCache:(0,n.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:C.cacheLife,waitUntil:o.waitUntil,onClose:e=>{a.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(a,o,t,r)=>S.onRequestError(e,a,t,r,O)},sharedContext:{buildId:R}},z=new c.NodeNextRequest(e),j=new c.NodeNextResponse(a),J=u.NextRequestAdapter.fromNodeNextRequest(z,(0,u.signalFromNodeResponse)(a));try{let i=async e=>S.handle(J,F).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":a.statusCode,"next.rsc":!1});let o=B.getRootSpanAttributes();if(!o)return;if(o.get("next.span_type")!==x.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${o.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=o.get("next.route");if(r){let a=`${U} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":a}),e.updateName(a)}else e.updateName(`${U} ${t}`)}),l=!!(0,n.getRequestMeta)(e,"minimalMode"),d=async n=>{var s,d;let c=async({previousCacheEntry:r})=>{try{if(!l&&_&&N&&!r)return a.statusCode=404,a.setHeader("x-nextjs-cache","REVALIDATED"),a.end("This page could not be found"),null;let t=await i(n);e.fetchMetrics=F.renderOpts.fetchMetrics;let s=F.renderOpts.pendingWaitUntil;s&&o.waitUntil&&(o.waitUntil(s),s=void 0);let d=F.renderOpts.collectedTags;if(!q)return await (0,p.sendResponse)(z,j,t,F.renderOpts.pendingWaitUntil),null;{let e=await t.blob(),a=(0,h.toNodeOutgoingHttpHeaders)(t.headers);d&&(a[A.NEXT_CACHE_TAGS_HEADER]=d),!a["content-type"]&&e.type&&(a["content-type"]=e.type);let o=void 0!==F.renderOpts.collectedRevalidate&&!(F.renderOpts.collectedRevalidate>=A.INFINITE_CACHE)&&F.renderOpts.collectedRevalidate,r=void 0===F.renderOpts.collectedExpire||F.renderOpts.collectedExpire>=A.INFINITE_CACHE?void 0:F.renderOpts.collectedExpire;return{value:{kind:v.CachedRouteKind.APP_ROUTE,status:t.status,body:Buffer.from(await e.arrayBuffer()),headers:a},cacheControl:{revalidate:o,expire:r}}}}catch(a){throw(null==r?void 0:r.isStale)&&await S.onRequestError(e,a,{routerKind:"App Router",routePath:t,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:_})},!1,O),a}},u=await S.handleResponse({req:e,nextConfig:C,cacheKey:k,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:_,revalidateOnlyGenerated:N,responseGenerator:c,waitUntil:o.waitUntil,isMinimalMode:l});if(!q)return null;if((null==u||null==(s=u.value)?void 0:s.kind)!==v.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(d=u.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});l||a.setHeader("x-nextjs-cache",_?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),E&&a.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let x=(0,h.fromNodeOutgoingHttpHeaders)(u.value.headers);return l&&q||x.delete(A.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||a.getHeader("Cache-Control")||x.get("Cache-Control")||x.set("Cache-Control",(0,f.getCacheControlHeader)(u.cacheControl)),await (0,p.sendResponse)(z,j,new Response(u.value.body,{headers:x,status:u.value.status||200})),null};L?await d(L):await B.withPropagatedContext(e.headers,()=>B.trace(x.BaseServerSpan.handleRequest,{spanName:`${U} ${t}`,kind:s.SpanKind.SERVER,attributes:{"http.method":U,"http.target":e.url}},d))}catch(a){if(a instanceof g.NoFallbackError||await S.onRequestError(e,a,{routerKind:"App Router",routePath:w,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:_})},!1,O),q)throw a;return await (0,p.sendResponse)(z,j,new Response(null,{status:500})),null}}e.s(["handler",()=>b,"patchFetch",()=>C,"routeModule",()=>S,"serverHooks",()=>O,"workAsyncStorage",()=>E,"workUnitAsyncStorage",()=>y]),o()}catch(e){o(e)}},!1)];

//# sourceMappingURL=_7a550075._.js.map