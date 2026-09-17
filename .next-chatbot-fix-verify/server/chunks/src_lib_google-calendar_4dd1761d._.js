module.exports=[313862,e=>e.a(async(a,t)=>{try{var r,n=e.i(666680),o=e.i(698043),i=a([o]);[o]=i.then?(await i)():i;let w=["SYNC_CALENDAR","RENEW_CHANNEL","STOP_CHANNEL","RECONCILE_CHANNEL"],S=["WEBHOOK","MANUAL","SCHEDULED","ADMIN"],C=(r=o.default,{query:(e,a=[])=>r.$queryRawUnsafe(e,...a),execute:(e,a=[])=>r.$executeRawUnsafe(e,...a)});function l(e){return e instanceof Date?e:new Date(e)}function d(e){return null===e?null:l(e)}function s(e){return{...e,availableAt:l(e.availableAt),claimedAt:d(e.claimedAt),claimExpiresAt:d(e.claimExpiresAt),completedAt:d(e.completedAt),deadLetteredAt:d(e.deadLetteredAt),createdAt:l(e.createdAt),updatedAt:l(e.updatedAt)}}function c(e,a,t=255){if(!e.trim()||e.length>t)throw Error(`${a} inv\xe1lido`)}async function u(e,a={}){if(c(e.calendarioId,"calendarioId"),c(e.idempotencyKey,"idempotencyKey"),!w.includes(e.operationType))throw Error("operationType inválido");if(!S.includes(e.source))throw Error("source inválida");let t=e.priority??100,r=e.maxAttempts??8;if(!Number.isInteger(t)||t<0||t>1e4)throw Error("priority inválida");if(!Number.isInteger(r)||r<1||r>50)throw Error("maxAttempts inválido");let o=a.sql??C,i=a.now?.()??new Date,l=e.availableAt??i,d=function(e){if(null==e)return null;throw Error("As operações atuais da Agenda Alpha não aceitam payload persistido")}(e.payload),E=a.createId?.()??(0,n.randomUUID)(),A=await o.query(`
      INSERT INTO "GoogleCalendarPendingOperation" (
        "id", "calendarioId", "pushChannelId", "operationType", "source",
        "idempotencyKey", "payloadJson", "status", "priority", "attemptCount",
        "maxAttempts", "availableAt", "claimToken", "createdAt", "updatedAt"
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 0, ?, ?, 0, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM "GoogleCalendarPendingOperation"
        WHERE "calendarioId" = ?
          AND "operationType" = ?
          AND "status" IN ('PENDING', 'RETRY')
      )
      ON CONFLICT("idempotencyKey") DO UPDATE SET
        "updatedAt" = excluded."updatedAt"
      RETURNING *
    `,[E,e.calendarioId,e.pushChannelId??null,e.operationType,e.source,e.idempotencyKey,d,t,r,l.toISOString(),i.toISOString(),i.toISOString(),e.calendarioId,e.operationType]);if(A[0])return s(A[0]);let g=await o.query(`
      SELECT *
      FROM "GoogleCalendarPendingOperation"
      WHERE "calendarioId" = ?
        AND "operationType" = ?
        AND "status" IN ('PENDING', 'RETRY')
      ORDER BY "priority" ASC, "createdAt" ASC
      LIMIT 1
    `,[e.calendarioId,e.operationType]);if(!g[0])throw Error("Falha ao confirmar operação enfileirada");return s(g[0])}async function E(e,a={}){c(e.workerId,"workerId",128);let t=e.claimDurationMs??12e4;if(!Number.isInteger(t)||t<5e3)throw Error("claimDurationMs inválido");let r=e.operationTypes??w;if(0===r.length||r.some(e=>!w.includes(e)))throw Error("operationTypes inválido");let n=a.sql??C,o=a.now?.()??new Date,i=new Date(o.getTime()+t),l=r.map(()=>"?").join(", "),d=`
    (
      ("status" IN ('PENDING', 'RETRY') AND "availableAt" <= ?)
      OR
      ("status" = 'PROCESSING' AND "claimExpiresAt" <= ?)
    )
    AND "operationType" IN (${l})
  `,u=[e.workerId,o.toISOString(),i.toISOString(),o.toISOString(),o.toISOString(),o.toISOString(),...r,o.toISOString(),o.toISOString(),...r],A=await n.query(`
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "status" = 'PROCESSING',
        "claimedBy" = ?,
        "claimedAt" = ?,
        "claimExpiresAt" = ?,
        "claimToken" = "claimToken" + 1,
        "attemptCount" = "attemptCount" + 1,
        "updatedAt" = ?
      WHERE "id" = (
        SELECT "id"
        FROM "GoogleCalendarPendingOperation"
        WHERE ${d}
        ORDER BY "priority" ASC, "availableAt" ASC, "createdAt" ASC
        LIMIT 1
      )
      AND ${d}
      RETURNING *
    `,u);if(!A[0])return null;let g=s(A[0]);return{operacao:g,workerId:e.workerId,claimToken:g.claimToken}}async function A(e,a={}){let t=a.sql??C,r=a.now?.()??new Date,n=await t.execute(`
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "status" = 'SUCCEEDED',
        "completedAt" = ?,
        "claimedBy" = NULL,
        "claimedAt" = NULL,
        "claimExpiresAt" = NULL,
        "lastErrorCode" = NULL,
        "lastErrorMessage" = NULL,
        "updatedAt" = ?
      WHERE "id" = ?
        AND "status" = 'PROCESSING'
        AND "claimedBy" = ?
        AND "claimToken" = ?
        AND "claimExpiresAt" > ?
    `,[r.toISOString(),r.toISOString(),e.operacao.id,e.workerId,e.claimToken,r.toISOString()]);return 1===n}async function g(e,a={},t={}){let r=a.claimDurationMs??12e4;if(!Number.isInteger(r)||r<5e3)throw Error("claimDurationMs inválido");let n=t.sql??C,o=t.now?.()??new Date,i=new Date(o.getTime()+r),l=await n.execute(`
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "claimExpiresAt" = ?,
        "updatedAt" = ?
      WHERE "id" = ?
        AND "status" = 'PROCESSING'
        AND "claimedBy" = ?
        AND "claimToken" = ?
        AND "claimExpiresAt" > ?
    `,[i.toISOString(),o.toISOString(),e.operacao.id,e.workerId,e.claimToken,o.toISOString()]);return 1===l}async function p(e,a,t={}){let r,n,o=t.sql??C,i=t.now?.()??new Date,l=!0===a.permanent||(r=a.code.trim().toUpperCase(),"400"===r||"401"===r||"403"===r||"HTTP_400"===r||"HTTP_401"===r||"HTTP_403"===r||"INVALID_ARGUMENT"===r||"UNAUTHENTICATED"===r||"PERMISSION_DENIED"===r)||e.operacao.attemptCount>=e.operacao.maxAttempts,d=l?"DEAD_LETTER":"RETRY",s=l?i:new Date(i.getTime()+function(e,a=Math.random){let t=Math.max(1,Math.min(e,10)),r=Math.min(9e5,5e3*2**(t-1)),n=Math.floor(1e3*Math.max(0,Math.min(a(),1)));return r+n}(e.operacao.attemptCount,t.random)),c=a.code.replace(/[\r\n\t]+/g," ").replace(/[^\p{L}\p{N} _.:/-]/gu,"").trim().slice(0,64)||"OPERATION_FAILED",u=(n=c.toUpperCase(),"LOCK_BUSY"===n?"Outro worker mantém o lease deste calendário":"FENCING_PERDIDO"===n?"Lease perdido durante a sincronização":"CLAIM_EXPIRED"===n?"Claim expirado e recuperado automaticamente":n.includes("401")||n.includes("403")||"UNAUTHENTICATED"===n||"PERMISSION_DENIED"===n?"Credencial ou permissão rejeitada pelo provedor":"Falha operacional da Agenda Alpha"),E=await o.execute(`
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "status" = ?,
        "availableAt" = ?,
        "deadLetteredAt" = ?,
        "claimedBy" = NULL,
        "claimedAt" = NULL,
        "claimExpiresAt" = NULL,
        "lastErrorCode" = ?,
        "lastErrorMessage" = ?,
        "updatedAt" = ?
      WHERE "id" = ?
        AND "status" = 'PROCESSING'
        AND "claimedBy" = ?
        AND "claimToken" = ?
        AND "claimExpiresAt" > ?
    `,[d,s.toISOString(),l?i.toISOString():null,c,u,i.toISOString(),e.operacao.id,e.workerId,e.claimToken,i.toISOString()]);return 1!==E?"STALE_CLAIM":d}async function I(e={}){let a=e.sql??C,t=e.now?.()??new Date;return a.execute(`
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "status" = CASE
          WHEN "attemptCount" >= "maxAttempts" THEN 'DEAD_LETTER'
          ELSE 'RETRY'
        END,
        "availableAt" = ?,
        "deadLetteredAt" = CASE
          WHEN "attemptCount" >= "maxAttempts" THEN ?
          ELSE NULL
        END,
        "claimedBy" = NULL,
        "claimedAt" = NULL,
        "claimExpiresAt" = NULL,
        "lastErrorCode" = 'CLAIM_EXPIRED',
        "lastErrorMessage" = 'Claim expirado e recuperado automaticamente',
        "updatedAt" = ?
      WHERE "status" = 'PROCESSING'
        AND "claimExpiresAt" <= ?
    `,[t.toISOString(),t.toISOString(),t.toISOString(),t.toISOString()])}async function h(e={}){let a=e.sql??C,t=await a.query(`
      SELECT "status", COUNT(*) AS "total"
      FROM "GoogleCalendarPendingOperation"
      GROUP BY "status"
    `),r={PENDING:0,PROCESSING:0,RETRY:0,SUCCEEDED:0,DEAD_LETTER:0,CANCELLED:0};for(let e of t)r[e.status]=Number(e.total);return r}e.s(["concluirOperacao",()=>A,"enfileirarOperacao",()=>u,"obterResumoFila",()=>h,"prismaAgendaAlphaSqlExecutor",0,C,"reagendarOuEnviarDlq",()=>p,"recuperarClaimsExpirados",()=>I,"reivindicarProximaOperacao",()=>E,"renovarClaimOperacao",()=>g]),t()}catch(e){t(e)}},!1),570790,e=>e.a(async(a,t)=>{try{var r=e.i(666680),n=e.i(313862),o=a([n]);[n]=o.then?(await o)():o;class A extends Error{constructor(){super("Lease de sincronização perdido"),this.name="AgendaAlphaLeaseLostError"}}function i(e){return{...e,leaseExpiresAt:e.leaseExpiresAt instanceof Date?e.leaseExpiresAt:new Date(e.leaseExpiresAt),heartbeatAt:e.heartbeatAt instanceof Date?e.heartbeatAt:new Date(e.heartbeatAt),createdAt:e.createdAt instanceof Date?e.createdAt:new Date(e.createdAt),updatedAt:e.updatedAt instanceof Date?e.updatedAt:new Date(e.updatedAt)}}function l(e,a){if(!e.trim()||e.length>128)throw Error(`${a} inv\xe1lido`)}async function d(e,a={}){l(e.calendarioId,"calendarioId"),l(e.ownerId,"ownerId");let t=e.leaseDurationMs??9e4;if(!Number.isInteger(t)||t<1e4)throw Error("leaseDurationMs inválido");let o=a.sql??n.prismaAgendaAlphaSqlExecutor,s=a.now?.()??new Date,c=new Date(s.getTime()+t),u=await o.query(`
      INSERT INTO "GoogleCalendarSyncLease" (
        "id", "calendarioId", "ownerId", "fencingToken",
        "leaseExpiresAt", "heartbeatAt", "createdAt", "updatedAt"
      )
      VALUES (?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT("calendarioId") DO UPDATE SET
        "ownerId" = excluded."ownerId",
        "fencingToken" = "GoogleCalendarSyncLease"."fencingToken" + 1,
        "leaseExpiresAt" = excluded."leaseExpiresAt",
        "heartbeatAt" = excluded."heartbeatAt",
        "updatedAt" = excluded."updatedAt"
      WHERE "GoogleCalendarSyncLease"."leaseExpiresAt" <= ?
         OR "GoogleCalendarSyncLease"."ownerId" = excluded."ownerId"
      RETURNING *
    `,[a.createId?.()??(0,r.randomUUID)(),e.calendarioId,e.ownerId,c.toISOString(),s.toISOString(),s.toISOString(),s.toISOString(),s.toISOString()]);return u[0]?i(u[0]):null}async function s(e,a={},t={}){let r=a.leaseDurationMs??9e4;if(!Number.isInteger(r)||r<1e4)throw Error("leaseDurationMs inválido");let o=t.sql??n.prismaAgendaAlphaSqlExecutor,l=t.now?.()??new Date,d=new Date(l.getTime()+r),c=await o.query(`
      UPDATE "GoogleCalendarSyncLease"
      SET
        "leaseExpiresAt" = ?,
        "heartbeatAt" = ?,
        "updatedAt" = ?
      WHERE "calendarioId" = ?
        AND "ownerId" = ?
        AND "fencingToken" = ?
        AND "leaseExpiresAt" > ?
      RETURNING *
    `,[d.toISOString(),l.toISOString(),l.toISOString(),e.calendarioId,e.ownerId,e.fencingToken,l.toISOString()]);return c[0]?i(c[0]):null}async function c(e,a={}){let t=a.sql??n.prismaAgendaAlphaSqlExecutor,r=a.now?.()??new Date,o=await t.query(`
      SELECT 1 AS "owned"
      FROM "GoogleCalendarSyncLease"
      WHERE "calendarioId" = ?
        AND "ownerId" = ?
        AND "fencingToken" = ?
        AND "leaseExpiresAt" > ?
      LIMIT 1
    `,[e.calendarioId,e.ownerId,e.fencingToken,r.toISOString()]);return 1===o.length}async function u(e,a={}){if(!await c(e,a))throw new A}async function E(e,a={}){let t=a.sql??n.prismaAgendaAlphaSqlExecutor,r=a.now?.()??new Date,o=await t.execute(`
      UPDATE "GoogleCalendarSyncLease"
      SET
        "leaseExpiresAt" = ?,
        "heartbeatAt" = ?,
        "updatedAt" = ?
      WHERE "calendarioId" = ?
        AND "ownerId" = ?
        AND "fencingToken" = ?
    `,[r.toISOString(),r.toISOString(),r.toISOString(),e.calendarioId,e.ownerId,e.fencingToken]);return 1===o}e.s(["AgendaAlphaLeaseLostError",()=>A,"adquirirLeaseSincronizacao",()=>d,"exigirLeaseSincronizacao",()=>u,"liberarLeaseSincronizacao",()=>E,"renovarLeaseSincronizacao",()=>s]),t()}catch(e){t(e)}},!1),802094,e=>e.a(async(a,t)=>{try{var r=e.i(666680),n=e.i(698043),o=e.i(470166),i=e.i(570790),l=e.i(359793),d=e.i(443156),s=a([n,i,d]);[n,i,d]=s.then?(await s)():s;let f=/^[a-f0-9]{64}$/,m=u("agenda-alpha-invalid-channel");async function c(e,a){let t=`agenda-alpha-push:${process.pid}:${(0,r.randomUUID)()}`,n=await (0,i.adquirirLeaseSincronizacao)({calendarioId:e,ownerId:t,leaseDurationMs:9e4});if(!n)throw Error("Outro processo está alterando os canais deste calendário.");let o=n,l=!1,d=Promise.resolve(),s=setInterval(()=>{d=d.then(async()=>{if(l)return;let e=await (0,i.renovarLeaseSincronizacao)(o,{leaseDurationMs:9e4});if(!e){l=!0;return}o=e}).catch(()=>{l=!0})},3e4);s.unref?.();let c=async()=>{if(await d,l)throw new i.AgendaAlphaLeaseLostError;await (0,i.exigirLeaseSincronizacao)(o)};try{return await c(),await a(c)}finally{clearInterval(s),await d,await (0,i.liberarLeaseSincronizacao)(o).catch(()=>!1)}}function u(e){return(0,r.createHash)("sha256").update(e,"utf8").digest("hex")}function E(e){return e instanceof l.GoogleCalendarError?`GOOGLE_${e.kind.toUpperCase()}`:"PUSH_CHANNEL_OPERATION_FAILED"}async function A(e){var a,t;let o,i,l,d=await n.default.googleCalendarPushChannel.findUnique({where:{googleChannelId:e.googleChannelId},select:{id:!0,calendarioId:!0,googleChannelId:!0,googleResourceId:!0,channelTokenHash:!0,status:!0,expiresAt:!0,lastMessageNumber:!0}}),s=(a=e.channelToken,t=d?.channelTokenHash??m,o=a.length<=256?a:"",i=Buffer.from(u(o),"hex"),l=Buffer.from(f.test(t)?t:"0".repeat(64),"hex"),(0,r.timingSafeEqual)(i,l)&&a.length>0&&a.length<=256&&f.test(t)),c=null!==d&&(null===d.googleResourceId||d.googleResourceId===e.googleResourceId);return!(!d||!["CREATING","ACTIVE"].includes(d.status)||d.expiresAt.getTime()<=Date.now())&&s&&c?{id:d.id,calendarioId:d.calendarioId,googleChannelId:d.googleChannelId,googleResourceId:d.googleResourceId,lastMessageNumber:d.lastMessageNumber}:null}async function g(e,a,t){let i=await (0,d.obterUsuarioGoogleAtivoPorCalendario)(e);if(!i.ok)throw Error("Calendário indisponível para criação de canal push.");let l=a.agora?.()??new Date,s=a.duracaoMs??5184e5,c=a.antecedenciaRenovacaoMs??432e5;if(!Number.isSafeInteger(s)||s<=0||!Number.isSafeInteger(c)||c<0||c>=s)throw Error("Janela de expiração/renovação do canal push inválida.");let A=a.gerarChannelId?.()??(0,r.randomUUID)(),g=a.gerarToken?.()??(0,r.randomBytes)(32).toString("base64url");if(!g||g.length>256)throw Error("Token de canal push inválido.");let p=new Date(l.getTime()+s),I=new Date(p.getTime()-c),h=await n.default.googleCalendarPushChannel.create({data:{calendarioId:e,googleChannelId:A,channelTokenHash:u(g),status:"CREATING",expiresAt:p,renewAfter:I},select:{id:!0}}),w=null;try{if(await t(),(w=await (0,o.iniciarWatchEventos)({emailUsuario:i.emailUsuario,calendarId:i.googleCalendarId,channelId:A,channelToken:g,webhookUrl:function(e){let a=new URL("/api/calendario-alpha/webhook",e);if("https:"!==a.protocol)throw Error("A URL pública do webhook da Agenda Alpha deve usar HTTPS.");return a.toString()}(a.webhookBaseUrl),expirationMs:p.getTime()})).googleChannelId!==A)throw Error("O Google devolveu um identificador de canal divergente.");await t();let e=new Date(w.expiresAt.getTime()-c);return await n.default.googleCalendarPushChannel.update({where:{id:h.id},data:{googleResourceId:w.googleResourceId,resourceUri:w.resourceUri,status:"ACTIVE",expiresAt:w.expiresAt,renewAfter:e,activatedAt:new Date,lastErrorCode:null,lastErrorAt:null},select:{id:!0,calendarioId:!0,googleChannelId:!0,expiresAt:!0,renewAfter:!0}})}catch(e){throw w&&await (0,o.encerrarWatchEventos)({emailUsuario:i.emailUsuario,channelId:w.googleChannelId,resourceId:w.googleResourceId}).catch(()=>void 0),await n.default.googleCalendarPushChannel.updateMany({where:{id:h.id,status:"CREATING"},data:{status:"ERROR",lastErrorCode:E(e),lastErrorAt:new Date}}).catch(()=>void 0),e}}async function p(e,a){return c(e,t=>g(e,a,t))}async function I(e,a,t,r){let i=await n.default.googleCalendarPushChannel.findUnique({where:{id:e},select:{id:!0,calendarioId:!0,googleChannelId:!0,googleResourceId:!0,status:!0}});if(!i||"STOPPED"===i.status||"EXPIRED"===i.status)return!0;if(i.calendarioId!==a)throw Error("Canal push mudou de calendário durante o processamento.");let l=await n.default.googleCalendarPushChannel.updateMany({where:{id:i.id,calendarioId:a,status:{in:["CREATING","ACTIVE","ERROR"]}},data:{status:"STOPPING"}});if(1!==l.count){let e=await n.default.googleCalendarPushChannel.findUnique({where:{id:i.id},select:{status:!0}});if(!e||"STOPPED"===e.status||"EXPIRED"===e.status)return!0;if(t.bestEffort)return!1;throw Error("Canal push não está disponível para encerramento.")}let s=await (0,d.obterUsuarioGoogleAtivoPorCalendario)(a);if(!s.ok){if(await n.default.googleCalendarPushChannel.updateMany({where:{id:i.id,status:"STOPPING"},data:{status:"ERROR",lastErrorCode:"CALENDAR_NOT_ACTIVE",lastErrorAt:new Date}}),t.bestEffort)return!1;throw Error("Calendário indisponível para encerrar canal push.")}try{await r(),i.googleResourceId&&await (0,o.encerrarWatchEventos)({emailUsuario:s.emailUsuario,channelId:i.googleChannelId,resourceId:i.googleResourceId}),await r();let e=await n.default.googleCalendarPushChannel.updateMany({where:{id:i.id,status:"STOPPING"},data:{status:"STOPPED",stoppedAt:new Date,lastErrorCode:null,lastErrorAt:null}});if(1!==e.count)throw Error("Canal push mudou durante o encerramento.");return!0}catch(e){if(await n.default.googleCalendarPushChannel.updateMany({where:{id:i.id,status:"STOPPING"},data:{status:"ERROR",lastErrorCode:E(e),lastErrorAt:new Date}}).catch(()=>void 0),t.bestEffort)return!1;throw e}}async function h(e,a={}){let t=await n.default.googleCalendarPushChannel.findUnique({where:{id:e},select:{calendarioId:!0,status:!0}});return!t||"STOPPED"===t.status||"EXPIRED"===t.status||c(t.calendarioId,r=>I(e,t.calendarioId,a,r))}async function w(e,a){let t=await n.default.googleCalendarPushChannel.findUnique({where:{id:e},select:{id:!0,calendarioId:!0}});if(!t)throw Error("Canal push não encontrado.");return c(t.calendarioId,async e=>{let r=await n.default.googleCalendarPushChannel.findUnique({where:{id:t.id},select:{id:!0,calendarioId:!0,status:!0,renewAfter:!0}});if(!r||r.calendarioId!==t.calendarioId||"ACTIVE"!==r.status)throw Error("Somente canal ACTIVE pode ser renovado.");let o=await n.default.googleCalendarPushChannel.updateMany({where:{id:r.id,calendarioId:r.calendarioId,status:"ACTIVE",renewAfter:r.renewAfter},data:{renewAfter:r.renewAfter}});if(1!==o.count)throw Error("Canal push mudou durante a renovação.");await e();let i=await g(r.calendarioId,a,e);return await I(r.id,r.calendarioId,{bestEffort:!0},e),i})}async function S(e){let a=e.limite??50;if(!Number.isInteger(a)||a<1||a>200)throw Error("Limite de renovação de canais inválido.");let t=await n.default.googleCalendarPushChannel.findMany({where:{status:"ACTIVE",renewAfter:{lte:e.agora??new Date}},orderBy:{renewAfter:"asc"},take:a,select:{id:!0}}),r=0,o=0;for(let a of t)try{await w(a.id,{webhookBaseUrl:e.webhookBaseUrl}),r+=1}catch{o+=1}return{encontrados:t.length,concluidos:r,falhas:o}}async function C(e={}){let a=e.limite??50;if(!Number.isInteger(a)||a<1||a>200)throw Error("Limite de encerramento de canais inválido.");let t=await n.default.googleCalendarPushChannel.findMany({where:{status:{in:["CREATING","ACTIVE","ERROR"]}},orderBy:{createdAt:"asc"},take:a,select:{id:!0}}),r=0,o=0;for(let e of t)await h(e.id,{bestEffort:!0})?r+=1:o+=1;return{encontrados:t.length,concluidos:r,falhas:o}}e.s(["autenticarCanalPush",()=>A,"criarCanalPush",()=>p,"encerrarCanaisPushAtivos",()=>C,"encerrarCanalPush",()=>h,"renovarCanaisPushProximosExpiracao",()=>S,"renovarCanalPush",()=>w]),t()}catch(e){t(e)}},!1),842986,e=>{"use strict";let a=new Set(["1","true","yes","on"]),t=new Set(["0","false","no","off",""]);class r extends Error{errors;constructor(e){super(`Configura\xe7\xe3o inv\xe1lida da Agenda Alpha: ${e.join("; ")}`),this.name="AgendaAlphaConfigError",this.errors=e}}function n(e,r,n){let o=(e[r]??"").trim().toLowerCase();return!!a.has(o)||!t.has(o)&&(n.push(`${r} deve ser true ou false`),!1)}function o(e=process.env){let a=[],t=n(e,"AGENDA_ALPHA_DISTRIBUTED_LOCK_ENABLED",a),r=n(e,"AGENDA_ALPHA_QUEUE_ENABLED",a),i=n(e,"AGENDA_ALPHA_PUSH_ENABLED",a),l=function(e,a,t){let r=e?.trim();if(!r)return a&&t.push("AGENDA_ALPHA_WEBHOOK_BASE_URL é obrigatória quando push está habilitado"),null;try{let e=new URL(r),a=e.hostname.toLowerCase(),n="localhost"===a||a.endsWith(".localhost")||"127.0.0.1"===a||"::1"===a||a.startsWith("10.")||a.startsWith("192.168.")||/^172\.(1[6-9]|2\d|3[01])\./.test(a);if("https:"!==e.protocol||n||e.username||e.password)return t.push("AGENDA_ALPHA_WEBHOOK_BASE_URL deve ser uma URL HTTPS pública sem credenciais"),null;return e.hash="",e.search="",e.pathname=e.pathname.replace(/\/+$/,""),e.toString().replace(/\/$/,"")}catch{return t.push("AGENDA_ALPHA_WEBHOOK_BASE_URL não é uma URL válida"),null}}(e.AGENDA_ALPHA_WEBHOOK_BASE_URL??e.PAINELALPHA_PUBLIC_URL,i,a);return r&&!t&&a.push("AGENDA_ALPHA_QUEUE_ENABLED exige AGENDA_ALPHA_DISTRIBUTED_LOCK_ENABLED"),!i||r&&t||a.push("AGENDA_ALPHA_PUSH_ENABLED exige fila e lock distribuído habilitados"),{distributedLockEnabled:t,queueEnabled:r,pushEnabled:i,webhookBaseUrl:l,valid:0===a.length,errors:a}}function i(e=process.env){let a=o(e);if(!a.valid)throw new r(a.errors);return a}e.s(["AgendaAlphaConfigError",()=>r,"exigirAgendaAlphaRuntimeConfig",()=>i,"lerAgendaAlphaRuntimeConfig",()=>o])}];

//# sourceMappingURL=src_lib_google-calendar_4dd1761d._.js.map