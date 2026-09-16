# Story: Alpha Explorer — pastas compartilhadas SMB do QNAP com acesso efetivo por usuário

## Status

Approved for incremental implementation — external exposure remains gated by Security/DevOps

## Executor Assignment

executor: `@dev`
quality_gate: `@architect`
quality_gate_tools: `["identity-adr", "threat-model", "explorer:smb:doctor", "explorer:smb:identity", "explorer:smb:list", "explorer:smb:smoke", "lint", "typecheck", "tests", "build", "coderabbit"]`

## Story

**Como** usuário autenticado do Painel Alpha,
**quero** navegar e operar no Alpha Explorer somente as pastas compartilhadas SMB do QNAP às quais minha identidade corporativa realmente tem acesso,
**para que** eu trabalhe nos arquivos departamentais existentes sem receber acesso amplo do usuário técnico, sem expor credenciais do NAS e sem transferir arquivos grandes através da Vercel.

## Contexto e correção de escopo

A primeira story do Alpha Explorer implementou um catálogo próprio sobre QuObjects e Vercel Blob. As pastas esperadas pelo usuário, porém, são diretórios da share SMB `ONYX`, não prefixes do bucket QuObjects. Logo, importação de metadados do bucket não resolve o requisito.

Contexto confirmado em 2026-09-15:

- o QNAP está na rede local;
- a share `//192.168.35.50/ONYX` está montada no Linux Server `ialpha` em `/mnt/qnap-onyx` por uma conta técnica;
- o mount CIFS usa SMB 3.0 e contém diretórios departamentais, além de diretórios internos do QNAP;
- o ambiente de stage executa no `ialpha` e a produção executa na Vercel;
- o navegador não fala SMB e a Vercel não alcança diretamente o mount local;
- a listagem feita pela montagem técnica representa os privilégios da conta técnica, não os privilégios individuais do usuário do Painel;
- as contas atuais são locais do QNAP; não existe AD/LDAP integrado neste momento;
- o usuário não deve redigitar a senha do NAS a cada acesso;
- as opções de identidade abaixo ainda não foram decididas nem validadas contra o QNAP real.

Esta story substitui **somente o backend navegável do Alpha Explorer para o escopo SMB**. Ela não remove QuObjects, Vercel Blob, objetos já registrados, links legados, tabelas existentes nem a fundação de storage. O rollout deve ser reversível por feature flag e permitir retorno ao backend atual.

Prioridade: identidade e autorização → integridade de filesystem → CLI → observabilidade → transferência de bytes → UI.

## Gate arquitetural obrigatório — identidade

Antes de implementar leitura ou escrita SMB para usuários finais, `@architect` deve produzir e aprovar uma ADR com prova contra o QNAP real. A ADR deve comparar e definir a transição entre duas opções explícitas:

1. **Recomendada/estado-alvo — SSO por AD/LDAP integrado ao QNAP:** identidade do Painel vinculada a uma identidade de diretório, com grupos/ACLs do QNAP como fonte autoritativa. Esta é a solução de longo prazo, mas depende de implantação e governança de diretório ainda inexistentes.
2. **Piloto — vinculação única com credential escrow cifrado por envelope em cofre externo/KMS:** um administrador vincula, uma única vez, o usuário interno do Painel ao principal local do QNAP. A senha/credencial NAS é cifrada por envelope e armazenada exclusivamente em secret manager/cofre externo; o Turso guarda somente um `secretRef` opaco, o identificador do principal NAS e metadados não secretos mínimos. O gateway recupera e decifra o segredo apenas em memória, pelo tempo mínimo para abrir a sessão SMB, sem devolvê-lo ao navegador. Rotação, revogação, expiração, acesso ao KMS e trilha de leitura do segredo são obrigatórios.

ACL espelhada sem autenticação como o principal local do QNAP não satisfaz, sozinha, o requisito de refletir o acesso real existente no servidor. Ela pode complementar políticas do aplicativo, mas não substituir a prova de ACL nativa.

A decisão deve registrar fonte da verdade, provisionamento/desprovisionamento, vínculo imutável entre identidades, precedência de allow/deny, revogação, rotação, auditoria, disponibilidade, recuperação e comportamento quando diretório, cofre/KMS ou QNAP estiverem indisponíveis. O piloto exige consentimento explícito e específico do usuário para custodiar a credencial no cofre, além de aprovação de segurança.

**Veto:** não adicionar senha, token SMB, access key ou segredo NAS em texto claro ao cadastro do usuário; não guardar segredo reversível diretamente no Turso; não tratar hash de senha como credencial utilizável; não devolver credenciais/ciphertext ao cliente; não usar browser storage; não usar a conta técnica como justificativa para mostrar toda a share; não inventar correspondência por e-mail ou nome sem vínculo administrativo verificável.

`[AUTO-DECISION] Qual estratégia de identidade usar? → recomendar AD/LDAP como estado-alvo e permitir credential escrow externo somente como piloto condicionado (reason: hoje existem contas locais QNAP e o usuário precisa de vínculo sem redigitar senha, mas custódia e persistência exigem Architecture/Security/Vault e consentimento específicos).`

## Decisões vinculantes já conhecidas

- O acesso SMB ocorrerá apenas em runtime server-side dentro da rede local.
- O mount compartilhado `/mnt/qnap-onyx` autenticado pela conta técnica não será usado para simular ACL individual. No piloto escrow, o gateway precisa abrir conexão/sessão SMB isolada como o principal QNAP vinculado ao usuário; o mount técnico serve apenas a diagnóstico operacional explicitamente autorizado.
- Produção Vercel usará um gateway local autenticado no `ialpha`; não tentará montar SMB nem proxyar arquivos grandes pela Function.
- O gateway terá um contrato único para stage e produção. Stage pode usar transporte local, mas não pode desenvolver uma regra de autorização diferente.
- Transferências grandes seguirão navegador ↔ gateway local por autorização curta e limitada a uma operação/recurso. O control plane do Painel autentica, autoriza e emite a autorização; ele não recebe o body integral.
- O gateway nunca aceitará caminho absoluto, caminho SMB, usuário, raiz ou capacidade como autoridade vinda do navegador.
- O navegador nunca recebe segredo NAS, data encryption key, ciphertext, credencial derivada ou token reutilizável do cofre. Somente recebe autorização curta para a operação já autorizada.
- Todo caminho será resolvido sob uma raiz allowlisted e validado novamente após canonicalização. Escape por `..`, encoding, barra invertida, symlink/reparse point, junction ou corrida de path será negado.
- Diretórios internos como `@Recycle`, `@Recently-Snapshot`, arquivos temporários e metadados do sistema ficam ocultos por padrão até decisão operacional específica.
- Escritas usam arquivo temporário na mesma share, validação de tamanho/estado e rename atômico quando suportado. Arquivo parcial não pode aparecer como concluído.
- Exclusão permanente fica fora desta primeira evolução. A lixeira deve usar mecanismo reversível aprovado na ADR operacional e nunca presumir que snapshot ou `@Recycle` equivale à lixeira do aplicativo.
- QuObjects e Vercel Blob permanecem intactos. Nenhuma migração ou exclusão de legado faz parte desta story.
- Qualquer nova persistência, tabela, coluna, índice, migration, seed ou backfill exige novo checkpoint Vault, backup válido e confirmação específica. Esta story não autoriza mudança de banco.

## Acceptance Criteria

1. Uma ADR aprovada documenta AD/LDAP como estado-alvo e decide, com aprovação de segurança, se o piloto pode usar vinculação única com credential escrow cifrado por envelope em cofre externo/KMS, incluindo revogação, rotação, desativação, grupos, precedência e comportamento fail-closed.
2. Um teste diferencial com pelo menos duas identidades de permissões distintas comprova que cada usuário vê somente diretórios autorizados e que o admin do Painel não recebe automaticamente acesso SMB além da política aprovada.
3. Ausência, ambiguidade, drift, expiração ou falha na resolução de identidade nega listagem e operação; nunca cai silenciosamente para os privilégios amplos da conta técnica.
4. Nenhuma senha/token SMB ou segredo NAS é persistido em texto claro no Turso, Prisma, cookies legíveis pelo cliente, local/session storage, código, `.env.example`, logs, auditoria ou resposta HTTP; hash de senha não é usado como substituto autenticável.
5. No piloto escrow, o Turso contém somente `secretRef` opaco, principal NAS e metadados não secretos aprovados; o segredo cifrado por envelope fica no cofre externo/KMS, é decifrado somente em memória no gateway, tem acesso auditável e nunca é retornado à Vercel ou ao navegador.
6. Existe um gateway server-only no `ialpha`, autenticado mutuamente ou por mecanismo equivalente aprovado, que media metadata e bytes entre o Painel e o QNAP por sessão SMB isolada na identidade vinculada; chamadas diretas não autenticadas são negadas e o mount técnico não concede acesso por usuário.
7. O contrato do gateway é versionado e idêntico para stage e produção; aceita somente operações tipadas, raiz lógica e identificador opaco resolvidos server-side, nunca caminho absoluto arbitrário.
8. O navegador só pode usar autorizações efêmeras, single-purpose, single-resource, vinculadas a usuário, operação, tamanho e expiração; replay, troca de usuário, troca de path e reutilização após revogação são negados.
9. Uploads e downloads grandes trafegam diretamente navegador ↔ gateway, com streaming e backpressure, sem buffer integral em memória, body integral por Server Action/Route Handler da Vercel ou URL permanente.
10. A origem de produção `https://painel.alpha-comex.com` e a origem de stage `https://stagealpha-sistema.alpak.ai` são allowlisted de forma exata no gateway; origem desconhecida, ausência indevida de `Origin` em fluxo browser e CSRF são tratados conforme threat model.
11. Paths normalizam Unicode e separadores e rejeitam NUL, controles, segmentos vazios perigosos, caminhos absolutos, drive letters, UNC input, traversal simples/codificado/duplamente codificado e nomes incompatíveis com a política aprovada.
12. A canonicalização final permanece dentro da raiz SMB autorizada. Symlink, reparse point, bind/alias ou troca TOCTOU não permite escapar da share/pasta autorizada.
13. A listagem é paginada/limitada, não varre recursivamente toda a share, não segue links e omite diretórios internos, arquivos temporários e entradas fora das capacidades efetivas.
14. Busca é escopada às raízes autorizadas, tem limites de profundidade, quantidade, duração e concorrência, e pode responder resultado parcial/assíncrono em vez de bloquear uma request web.
15. Capacidades granulares cobrem ao menos listar, ler, enviar, criar pasta, renomear, mover, excluir para lixeira e restaurar; cada operação é reautorizada no início e antes do commit da mutação.
16. Upload grava primeiro em nome temporário não previsível, valida tamanho real e limite configurado, sincroniza/fecha com erro tratado e publica por rename seguro. Queda de rede, cancelamento, disco cheio e mount indisponível não deixam arquivo parcial com nome final.
17. Download valida novamente identidade, path canonicalizado, tipo de entrada e estado imediatamente antes de abrir o arquivo; headers e `Content-Disposition` são seguros e conteúdo ativo não confiável não é renderizado inline.
18. Rename/move nunca sobrescreve destino silenciosamente. Operações cross-filesystem ou não atômicas são bloqueadas ou executadas por fluxo reconciliável explícito com cópia verificada antes de qualquer remoção.
19. Exclusão é reversível e restauração detecta conflito. A solução diferencia claramente lixeira do Alpha Explorer, recycle bin do QNAP e snapshots; delete físico não é disponibilizado nesta story.
20. Concorrência usa versão/snapshot de metadados confiável para devolver 409 em alteração simultânea, rename versus delete e arquivo modificado durante download/upload, sem depender de ETag S3.
21. O backend atual de QuObjects/Vercel continua disponível atrás de flag de rollback e todos os links/objetos legados mantêm o comportamento anterior; não existe cópia, migração ou exclusão automática entre SMB e object storage.
22. Feature flags server-only separam habilitação do backend SMB, leitura e escrita. O rollout ocorre primeiro no stage, depois leitura em produção, depois escrita para grupo piloto.
23. Antes da UI, existem CLIs operacionais para: doctor de mount/gateway, resolução de identidade, permissão efetiva em path, listagem dry-run, teste de leitura, teste de escrita/rename/cleanup e detecção segura de temporários abandonados.
24. As CLIs têm saída JSON sanitizada, exit codes estáveis, modo dry-run padrão para mutações e confirmação explícita para smoke de escrita; nunca imprimem segredo, token efêmero, path sensível completo ou conteúdo.
25. Logs estruturados e métricas incluem correlation/support ID, identidade interna pseudonimizada, ação, resultado, duração, bytes, gateway/node e erro sanitizado; não incluem segredo, ticket completo, nome/path sensível completo ou conteúdo.
26. Auditoria registra emissão/uso/revogação de autorização, listagem, download, upload, pasta, rename, move, lixeira, restore, negação e mudança de política, distinguindo ação pedida, autorizada e efetivamente concluída.
27. Health checks distinguem aplicação, gateway, mount CIFS, reachability do QNAP e autorização. Mount stale, read-only inesperado, falta de espaço e latência degradada bloqueiam escrita sem expor detalhes internos ao usuário.
28. A UI existente passa a renderizar as raízes SMB efetivamente autorizadas sem expor `/mnt/qnap-onyx`, endereço IP, nome técnico da share, credenciais ou ACLs de terceiros; estados de indisponibilidade e acesso negado são distintos.
29. Autenticação, autorização, rate limit, schemas Zod, support ID, acessibilidade, mobile, tema, React Query e ausência de `useEffect` para fetch preservam os padrões já implantados no Alpha Explorer.
30. Testes unitários, integração, API, componente e E2E cobrem identidade, path, gateway, streaming, concorrência, falhas do mount e isolamento entre usuários; smokes reais usam arquivos sintéticos em pasta de teste aprovada e cleanup verificado.
31. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e todas as CLIs SMB são executados de verdade e registrados; nenhum gate é declarado como aprovado sem evidência.
32. Nenhuma alteração estrutural de banco é feita nesta story sem parar no protocolo Vault. O vínculo `usuário interno ↔ principal NAS ↔ secretRef` exige relatório Vault novo, backup ≤48h verificado, rollback e confirmação específica; a autorização anterior das tabelas QuObjects não cobre esse schema.
33. O enrollment do piloto exige confirmação autenticada do usuário e/ou administrador conforme política aprovada, valida a credencial diretamente contra o QNAP sem registrá-la e grava no cofre somente após sucesso; troca de principal, rotação, desvinculação e usuário desativado revogam sessões/tickets ativos.
34. Falha ou indisponibilidade do cofre/KMS nega novo acesso SMB sem fallback para conta técnica, segredo em ambiente ou credencial em cache persistente; erros e auditoria não revelam existência, valor ou versão do segredo.

## Tasks / Subtasks

- [ ] Task 1 — Architecture Gate de identidade e threat model (AC: 1–5, 8, 10, 32–34)
  - [ ] Inventariar QNAP: tipo de usuários, grupos, ACLs da share, integração AD/LDAP disponível e APIs/sessões suportadas, sem coletar segredos na evidência.
  - [ ] Provar acesso diferencial com duas identidades de teste e documentar por que o mount técnico atual não expressa ACL individual.
  - [x] Comparar AD/LDAP como estado-alvo com escrow externo como piloto, registrar ADR, consentimento, critérios de saída do piloto, rollback e aprovação de `@architect`/segurança antes de implementar acesso de usuário.
  - [x] Produzir threat model para confused deputy, IDOR, traversal, replay, roubo de ticket, TOCTOU, symlink/reparse e vazamento de credencial.
- [ ] Task 2 — Contrato CLI-first do gateway SMB (AC: 6–14, 23–27)
  - [x] Definir contrato versionado de identidade, capabilities, raiz lógica, paginação, stat, stream, mutações e erros.
  - [ ] Implementar doctor, identity, permissions, list e smoke com JSON/exit codes/dry-run.
  - [ ] Validar mount SMB 3, estado read-only/read-write, espaço, timeout, cancelamento e sanitização antes da UI.
- [x] Task 3 — Gateway local e autorização efêmera (AC: 3–12, 25–27, 33–34)
  - [x] Implementar processo server-only no `ialpha` com autenticação de serviço e allowlist de origens exatas.
  - [x] Implementar tickets curtos vinculados a usuário/operação/recurso/tamanho, anti-replay e revogação.
  - [x] Implementar canonicalização segura e acesso filesystem que não siga escape por links nem confie em path do cliente.
  - [x] Implementar enrollment/rotação/desvinculação administrativos no Vault KV v2, sessão SMB em memória, revogação e persistência reconciliada de metadados não secretos no Turso.
- [ ] Task 4 — Operações SMB íntegras (AC: 13–20)
  - [ ] Implementar listagem/pesquisa limitada e download streaming.
  - [x] Implementar upload temporário, verificação e publicação segura, com cancelamento e limpeza reconciliável.
  - [x] Implementar pasta, rename, move, lixeira e restore sem overwrite ou delete físico.
  - [x] Implementar controle de concorrência e respostas 409 para estado obsoleto.
- [x] Task 5 — Integração do Alpha Explorer e rollout (AC: 21–29)
  - [x] Introduzir adapter SMB sem remover adapters QuObjects/Vercel nem alterar links legados.
  - [x] Manter autorização do módulo e substituir raízes fixas por handles resolvidos pela sessão SMB individual.
  - [x] Adicionar flags server-only para backend SMB/leitura/escrita e documentar stage → produção leitura → piloto escrita.
  - [x] Adaptar a UI funcional em componentes isolados, preservando o trabalho visual concorrente e o backend legado.
- [ ] Task 6 — Observabilidade, auditoria e operação (AC: 24–27)
  - [ ] Instrumentar logs/métricas sanitizados, health por camada, alertas de mount stale/espaço e correlação ponta a ponta.
  - [x] Documentar restart do mount/gateway, rotação de credencial, revogação, temporários e rollback por flag.
- [ ] Task 7 — Testes e gates (AC: 2–4, 8–12, 16–22, 30–32)
  - [x] Criar fixtures filesystem isoladas e testes de identidade/capability/path sem tocar dados reais.
  - [x] Criar integração do gateway com SMB simulado e smoke opt-in contra pasta sintética aprovada.
  - [ ] Executar E2E com usuário autorizado, usuário negado e duas identidades com ACLs diferentes.
  - [ ] Executar lint, typecheck, testes, build, CodeRabbit e atualizar checkboxes/File List/evidências.

## Dev Notes

### Estado atual que deve ser preservado

- O Alpha Explorer atual usa `src/lib/alpha-explorer/service.ts` e adapters em `src/lib/storage/` para QuObjects/Vercel. Seu catálogo não representa automaticamente arquivos SMB. [Source: `docs/stories/story-alpha-explorer-modulo-arquivos-nas.md#contexto`]
- A autorização atual combina sessão, permissão de módulo `exploradorArquivos` e ACL de prefixo. O adapter SMB deve preservar a guarda do módulo, mas raízes/capacidades precisam vir da estratégia de identidade aprovada. [Source: `docs/stories/story-alpha-explorer-modulo-arquivos-nas.md#autorização-e-navegação`]
- O prompt original proíbe credencial NAS individual no cadastro comum. Esta story mantém o veto a segredo persistente/em claro; a exceção de piloto considerada é custódia cifrada em cofre externo, referenciada de forma opaca e submetida a Architecture/Security/Vault e consentimento novos. [Source: `docs/stories/story-alpha-explorer-modulo-arquivos-nas.md#decisões-vinculantes`]
- O procedimento operacional atual trata QuObjects e Blob; deve continuar válido como rollback/legado, sem ser confundido com o novo backend SMB. [Source: `docs/operations/alpha-explorer.md#colocação-em-funcionamento`]

### Topologia e fronteiras

```text
Painel (Vercel ou stage)
  ├─ autentica sessão e calcula permissão de módulo
  ├─ resolve identidade/capability aprovada
  └─ autoriza operação curta
            │ control plane
            ▼
Gateway local no ialpha ── sessão SMB 3 do principal vinculado ── QNAP / share ONYX
            ▲
            │ data plane streaming para arquivos grandes
        navegador
```

- Vercel não deve receber o body integral nem acessar IP privado/mount.
- O gateway é um novo limite de confiança: precisa autenticar o emissor, revalidar ticket e path, limitar recurso e registrar resultado.
- A montagem atual usa uma conta técnica e apresenta os diretórios permitidos a ela. Não há como inferir a ACL individual apenas com `find/readdir` nesse mount; o piloto escrow deve autenticar uma conexão SMB separada como o principal local QNAP do usuário.

### Integrações e caminhos previstos

- Reutilizar `src/lib/alpha-explorer/http.ts`, `authorization.ts`, `schemas.ts`, `observability.ts`, `rate-limit.ts` e os handlers existentes onde o contrato permanecer válido.
- Introduzir uma interface de backend do Explorer para evitar condicionais QuObjects/SMB espalhadas pelo serviço.
- Manter `scripts/alpha-explorer.mjs` como entrada CLI e seguir o padrão `explorer:*` do `package.json`.
- Gateway/process manager, configuração de mount e segredo operacional pertencem ao runtime `ialpha`; nenhum valor secreto entra no repositório.
- `.env.example` pode receber somente nomes/documentação, como endpoint público do gateway, audience/issuer e flags. O mecanismo final e os nomes dependem da ADR.
- Não existe `accumulated-context.md` no repositório; para coerência foram usados a story vigente do Explorer, a story de fundação do storage, Constitution e o código atual.

### Banco de dados e Vault

- **Nenhuma migration/schema é autorizada por esta story.** Primeiro reutilizar sessão, permissões e auditoria existentes ou manter estado efêmero no gateway.
- Se a ADR exigir vínculo persistente de identidade, política espelhada, revogação ou job, parar antes de editar Prisma/SQL e acionar Vault com ambiente, DDL, backup ≤48h, restore test, impacto e rollback.
- A autorização Vault anterior das quatro tabelas do Alpha Explorer não autoriza a persistência do novo vínculo. O schema mínimo do piloto deve guardar apenas identificador interno do usuário, principal NAS, `secretRef` opaco, estado/versão e metadados não secretos estritamente necessários.
- O ciphertext/envelope, a data encryption key e a master key não podem ser armazenados no Turso. O secret manager/KMS e sua política de acesso precisam ser definidos na ADR antes do novo Vault.
- Não reutilizar `token_onyx` ou outro campo de credencial para SMB.

### Requisitos operacionais

- Confirmar no QNAP e no mount real: SMB dialect, signing/encryption, ACL semantics, case sensitivity, Unicode normalization, locks, rename atômico, recycle bin, snapshots e comportamento sob reconnect.
- Diretórios internos observados na raiz (`@Recycle`, `@Recently-Snapshot`) permanecem ocultos até política explícita.
- A URL externa do gateway, TLS, autenticação serviço-serviço, firewall e supervisão do processo precisam de aprovação de `@devops`; nenhuma alteração DNS/tunnel é implicitamente autorizada.

### Fora do escopo

- Migrar, duplicar ou apagar objetos QuObjects/Vercel.
- Administrar todo o NAS, shares, usuários ou grupos pelo Painel.
- Expor SMB/WebDAV diretamente ao navegador.
- Guardar senha do QNAP para login automático do usuário.
- Guardar ciphertext reversível diretamente no Turso ou em variável por usuário.
- Prometer acesso “igual ao servidor” sem teste diferencial de identidade.
- Purga física, restauração de snapshot ou disaster recovery do QNAP.

## Testing

### Automatizado

- **Unitários:** identidade/capability, ticket e anti-replay, path/Unicode/encoding, canonicalização, boundary de raiz, nomes reservados, erros sanitizados e flags.
- **Unitários de escrow (se aprovado):** nunca serializar segredo/ciphertext; `secretRef` opaco; zeroização/best-effort do buffer; rotação/revogação; KMS timeout/deny; troca maliciosa de referência.
- **Integração:** gateway autenticado, listagem paginada, streaming/backpressure, cancelamento, arquivo temporário, rename, conflito, lixeira, mount read-only/stale e reconexão.
- **API:** 401/403/404 discreto/409/413/429/5xx com support ID; IDOR; ticket de outro usuário/path/operação; Origin/CSRF; rate limit.
- **Componentes:** raiz permitida, vazio, indisponível, negado, progresso, cancelamento, conflito e teclado/mobile.
- **E2E:** stage no `ialpha` e produção via gateway, com usuário A e B possuindo ACLs diferentes e admin sem bypass SMB implícito.

### Cenários mínimos

1. usuário sem vínculo de identidade;
2. usuário desativado após emissão de ticket;
3. grupo removido durante upload;
4. conta técnica enxerga pasta que o usuário não pode ver;
5. dois usuários com pastas distintas;
6. prefixos/nomes semelhantes;
7. `../`, `..\\`, UNC, absoluto, NUL e encoding duplo;
8. Unicode NFC/NFD, case collision, ponto/espaço final e nome muito longo;
9. symlink/reparse point apontando para fora da raiz;
10. path trocado entre validação e abertura;
11. arquivo modificado durante download;
12. duas abas renomeando/excluindo o mesmo arquivo;
13. upload zero-byte, no limite e acima do limite;
14. rede perdida durante stream e cancelamento tardio;
15. mount stale, desmontado, read-only, sem espaço e QNAP reiniciando;
16. gateway indisponível com Painel saudável;
17. ticket expirado, repetido, adulterado ou usado por outro usuário/origem;
18. arquivo parcial/temporário após crash e reconciliação segura;
19. rename/move com destino existente e cross-filesystem;
20. delete reversível, restore com conflito e tentativa de purga;
21. acesso a `@Recycle`/`@Recently-Snapshot` e arquivos de sistema;
22. path/nome/conteúdo sensível ausente de logs;
23. QuObjects/Vercel legado intacto após rollback da flag SMB;
24. arquivo grande transmitido sem body integral/buffer na Vercel;
25. enrollment com credencial inválida não cria vínculo nem segredo órfão;
26. usuário A tentando usar `secretRef`/principal do usuário B;
27. KMS/cofre indisponível, versão revogada ou decrypt negado;
28. rotação de senha QNAP invalida sessão antiga e restabelece acesso somente após atualização segura;
29. usuário desvinculado/desativado perde acesso e tickets ativos são revogados;
30. logs, erros, traces e dumps não contêm plaintext, ciphertext, data key ou identificador sensível do segredo.

### Smoke real controlado

- Usar exclusivamente diretório sintético aprovado para cada identidade de teste.
- Executar list → upload pequeno → checksum → download → rename → move → lixeira → restore → cleanup.
- Executar arquivo grande opt-in suficiente para provar streaming e ausência de proxy Vercel; não incluir em CI.
- Verificar que nenhum temporário, ticket reutilizável ou processo aberto permaneceu.
- Nunca usar pasta departamental real como alvo de teste destrutivo.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type:** Architecture
- **Secondary Types:** Integration, Security, API, Infrastructure, Frontend
- **Complexity:** High — conecta duas zonas de rede, introduz gateway/data plane e exige identidade individual verificável sobre SMB.

### Specialized Agent Assignment

**Primary Agents:**

- `@dev` — implementação CLI/backend/UI e correções pre-commit.
- `@architect` — ADR de identidade, gateway, threat model e gate obrigatório.

**Supporting Agents:**

- `@qa` — isolamento entre identidades, falhas SMB e integridade.
- `@devops` — serviço local, TLS/tunnel/firewall, secrets e rollout.
- `@data-engineer`/Vault — somente se a ADR exigir persistência nova.

### Quality Gate Tasks

- [ ] Architecture Gate (`@architect`): aprovar identidade e threat model antes de implementação material.
- [ ] Pre-Commit (`@dev`): executar CodeRabbit uncommitted e corrigir CRITICAL.
- [ ] QA Gate (`@qa`): provar isolamento com identidades distintas e falhas do mount.
- [ ] Pre-PR (`@devops`): revisar diff, secrets, contrato e compatibilidade.
- [ ] Pre-Deployment (`@devops`): validar gateway, flags, rollback e observabilidade no stage.

### Self-Healing Configuration

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: auto-fix; HIGH: document-only; MEDIUM/LOW: registrar sem auto-fix.

### CodeRabbit Focus Areas

**Primary Focus:** confused deputy/IDOR, segredo por usuário, path traversal/canonical escape, ticket replay e proxy indevido pela Vercel.

**Secondary Focus:** TOCTOU, arquivo parcial, overwrite/delete, logs sensíveis, compatibilidade QuObjects/Vercel e rollback por flag.

## Initial File List

Arquivos previstos, sujeitos à ADR e ao mapeamento final do `@dev`:

- `docs/stories/story-alpha-explorer-pastas-compartilhadas-smb-qnap.md`
- `docs/architecture/adr-alpha-explorer-identidade-smb.md`
- `docs/operations/alpha-explorer-smb.md`
- `docs/qa/storage-alpha/alpha-explorer-smb-validation.md`
- `.env.example`
- `package.json`
- `scripts/alpha-explorer.mjs`
- `src/lib/alpha-explorer/backend.ts`
- `src/lib/alpha-explorer/smb/`
- `src/lib/alpha-explorer/authorization.ts`
- `src/lib/alpha-explorer/http.ts`
- `src/lib/alpha-explorer/observability.ts`
- `src/lib/alpha-explorer/schemas.ts`
- `src/lib/alpha-explorer/service.ts`
- `src/app/api/alpha-explorer/`
- `src/components/AlphaExplorer/`
- `ops/alpha-explorer-gateway/` (localização final sob validação do `@devops`/estrutura real)
- `tests/alpha-explorer/`

## Riscos e dependências

- **Bloqueador de exposição real:** AD/LDAP ainda não existe; o piloto já possui ADR, contrato de Vault e consentimento na UI, mas o Vault/gateway reais e o teste diferencial com duas contas QNAP ainda não foram provisionados/aprovados por Security/DevOps.
- O mount técnico pode achatar a visão de ACL; implementar sobre ele sem gate criaria acesso excessivo.
- Produção depende do gateway e conectividade pública controlada no `ialpha`; queda do servidor/rede derruba acesso SMB.
- Credential escrow reduz a repetição de senha, mas aumenta impacto de comprometimento do gateway/cofre e exige envelope encryption, IAM mínimo, rotação, auditoria e plano de migração para SSO.
- ACL espelhada pode complementar autorização, mas não prova ACL nativa quando o acesso SMB usa a conta técnica.
- Escrita SMB tem semântica diferente de S3; locks, case, Unicode, recycle e reconnect exigem teste real.
- Qualquer persistência nova reabre o protocolo Vault e não está autorizada por esta story.

## Checklist de prontidão do draft

| Categoria | Status | Observação |
|---|---|---|
| Objetivo e contexto | PASS | Corrige QuObjects versus SMB e descreve stage, produção e mount real. |
| Orientação técnica | PASS | Gates, fronteiras, contratos, CLI, gateway e rollout estão definidos sem escolher identidade não comprovada. |
| Referências | PASS | Story anterior, operação atual e código existente estão resumidos no próprio documento. |
| Autossuficiência | PASS | Termos, topologia, vetos, edge cases e fora do escopo estão explícitos. |
| Testing | PASS | Unitário, integração, API, UI, E2E e smoke real têm cenários mensuráveis. |
| CodeRabbit | PASS | Tipo, agentes, gates, self-healing e focos estão preenchidos. |

**Avaliação final:** READY FOR PO/ARCHITECT REVIEW. A story é implementável após o Architecture Gate; a implementação de acesso de usuário está BLOCKED até a ADR provar identidade e autorização no QNAP real.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-15 | 0.1.0 | Draft criado para pivotar o Alpha Explorer de catálogo QuObjects para pastas compartilhadas SMB com identidade real, gateway local e preservação do legado. | River (`@sm`) |
| 2026-09-15 | 0.2.0 | Identidade refinada: AD/LDAP como alvo e piloto opcional com vínculo único, sessão SMB por principal e credential escrow cifrado em cofre externo, condicionado a Security/Vault/consentimento. | River (`@sm`) |
| 2026-09-16 | 0.3.0 | Enrollment movido para administração write-only, tickets separados por ator/alvo, múltiplas shares SMB allowlisted, Vault CAS, CLI administrativa, UI de vínculo e proposta aditiva de metadados preparada no checkpoint Vault. | Dex (`@dev`) |
| 2026-09-16 | 0.4.0 | Migration `AlphaExplorerSmbBinding` autorizada, aplicada e validada no Turso de produção; status administrativo passou a reconciliar somente metadados confirmados pelo gateway. | Dara (`@data-engineer`) / Dex (`@dev`) |
| 2026-09-16 | 0.4.1 | Acesso à Administração QNAP conectado ao cabeçalho comum do Explorer e ao estado de erro SMB, visível somente para perfis administrativos. | Dex (`@dev`) |
| 2026-09-16 | 0.4.2 | Runtime SMB passou a falhar de forma controlada quando o gateway ainda não está configurado: o Explorer usa o backend legado sem gerar erro 500 e a administração informa indisponibilidade sem expor detalhes de configuração. | Dex (`@dev`) |
| 2026-09-16 | 0.4.3 | Catálogo raiz alterado para descoberta automática de shares no QNAP por identidade vinculada, com prova de acesso por share e bloqueio permanente de ONYX/shares administrativas. | Dex (`@dev`) |
| 2026-09-16 | 0.5.0 | Stage provisionado com gateway SMB público autenticado, Vault Raft/TLS, credenciais systemd protegidas por host+TPM, descoberta automática de shares e rollout com enrollment/leitura habilitados. | Gage (`@devops`) / Dex (`@dev`) |
| 2026-09-16 | 0.5.1 | Validação de origem corrigida para reverse proxy/Cloudflare: stage resolve a origem pública exata por `Origin` ou forwarded host allowlisted, sem comparar com a URL interna do Next.js. | Dex (`@dev`) |
| 2026-09-16 | 0.5.2 | Sessão SMB alinhada à ADR: SMB3 e signing obrigatórios, encryption negociada quando suportada; removido falso `SMB_CREDENTIAL_REJECTED` no QNAP piloto sem encryption. | Dex (`@dev`) / Gage (`@devops`) |
| 2026-09-16 | 0.5.3 | Falhas de vínculo classificadas por causa (autenticação, bloqueio, senha expirada, ausência de shares, segurança e conectividade), mensagens administrativas traduzidas e support ID correlacionado entre UI, resposta e log. | Dex (`@dev`) / Gage (`@devops`) |
| 2026-09-16 | 0.5.4 | Fluxo administrativo simplificado por decisão do responsável: removidos reautenticação de cinco minutos e campo de justificativa; mantidos admin RBAC, ticket single-use, nonce, rate limit e auditoria. Diagnóstico SMB passou a combinar stdout/stderr para não perder o status nativo do QNAP. | Dex (`@dev`) / Gage (`@devops`) |

## Dev Agent Record

### Agent Model Used

Codex GPT-5, com revisão arquitetural e de segurança delegada.

### Debug Log References

- Vitest SMB: 13/13 aprovados.
- Navegação administrativa: 2/2 testes aprovados; link habilitado para admin e ausente para usuário comum.
- Configuração SMB: 3/3 testes aprovados; configuração completa é aceita, configuração incompleta usa fallback seguro e o leitor estrito retorna somente erro sanitizado.
- Pytest gateway: 20/20 aprovados, incluindo administração ator/alvo, Vault/CAS/rollback, múltiplas shares, bloqueio de principal privilegiado, rate limit e erro sanitizado.
- Pytest gateway após descoberta automática: 23/23 aprovados; catálogo do NAS, filtro por ACL, restrição opcional, deduplicação e bloqueio de shares reservadas cobertos.
- Pytest gateway final: 24/24 aprovados; credenciais de descoberta também foram verificadas fora dos argumentos do processo.
- `explorer:smb:doctor`: aprovado com gateway TLS, origins isolados, enrollment habilitado e escrita desabilitada.
- `explorer:smb:health`: aprovado antes e depois de restart controlado do Vault/gateway, com `application=true` e `vaultConfigured=true`.
- `explorer:smb:admin-status`: aprovado contra o Vault real, retornando vínculo inexistente sem erro e sem expor segredo.
- Fluxo público autenticado após hotfix de origem: páginas Explorer/Admin `200`, ticket do stage `200`, gateway `200` e status administrativo `200`; origem desconhecida permanece `403`.
- Testes focados de origem/config/ticket/metadados: 15/15 aprovados; lint do escopo alterado aprovado.
- Pytest gateway após correção de compatibilidade SMB: 24/24; sessão Python assinada validada no QNAP real e health do gateway aprovado.
- Diagnóstico amigável de vínculo: pytest gateway 25/25 e testes focados TypeScript 17/17; release imutável `20260916-182559-errors` ativa e health Node → gateway aprovado.
- Simplificação administrativa e correção do diagnóstico nativo: pytest gateway 25/25, testes focados TypeScript 12/12 e lint focado aprovado; release `20260916-1847-no-reauth` ativa, stage recompilado e health aprovado.
- CORS público: origin de stage permitido e origin não autorizado sem `Access-Control-Allow-Origin`.
- Restart oficial do stage: aprovado, novo processo `RUNNING` na porta 3005.
- Build de produção: aprovado.
- `storage:doctor`: QuObjects e Vercel Blob aprovados.
- `explorer:smb:doctor` sintético: aprovado.
- Typecheck global: passou durante a implementação, mas voltou a falhar após alterações concorrentes fora do SMB; nenhum erro SMB foi reportado.
- Lint do escopo SMB: aprovado; lint global falha em dívida preexistente/concorrente fora do Alpha Explorer (3.711 ocorrências), portanto o gate global permanece aberto.
- Suite global: 3.226 testes aprovados, 1 todo e 20 falhas fora do Alpha Explorer; gate global permanece aberto.
- CLI `explorer:smb:health` sintético Node → FastAPI: aprovado.
- CodeRabbit: não executado porque o binário `~/.local/bin/coderabbit` não está instalado neste host.

### Completion Notes List

- Enrollment é exclusivo do painel administrativo, exige login recente e envia a senha diretamente ao gateway; o Painel/Vercel e o Turso não recebem a credencial.
- O cabeçalho comum substituiu o placeholder desabilitado por `Administração QNAP`; o estado de indisponibilidade SMB também oferece o link aos administradores.
- A flag SMB não derruba mais o Server Component quando o gateway está incompleto: a página principal preserva o Explorer legado e a rota administrativa apresenta uma indisponibilidade controlada até o provisionamento das variáveis obrigatórias.
- Vínculos secretos ficam no Vault KV v2. A migration aditiva `20260916145000_alpha_explorer_smb_binding` foi autorizada e aplicada ao Turso de produção; a tabela guarda somente metadados não secretos reconciliados por consulta server-side ao gateway.
- Cada deployment do Painel carrega apenas a própria chave de ticket; o gateway verificador conhece stage e produção.
- Tickets administrativos vinculam ator, usuário-alvo, escopo, nonce e hash da justificativa; rotação usa CAS e preserva a versão anterior se a validação falhar.
- Handles usam o binding completo e o gateway aplica rate limit SQLite por binding/cliente/principal.
- Gateway usa sessão SMB3 isolada por operação, handles opacos, tickets single-use e replay store SQLite.
- A raiz do Explorer descobre as shares anunciadas pelo QNAP usando a identidade vinculada e confirma acesso real antes de exibi-las; uma allowlist fixa não é mais obrigatória e, quando configurada, atua somente como restrição adicional.
- Stage opera com Vault 2.1.0 fixado por digest, TLS/Raft, auto-unseal host+TPM, token mínimo do gateway, serviços systemd e endpoint Cloudflare dedicado; escrita permanece desligada até smoke real com uma conta QNAP cadastrada pela UI.
- Requisições atrás do Cloudflare resolvem a origem pública somente contra a origem exata do runtime; a URL interna `127.0.0.1:3005` não participa mais da decisão CSRF.
- O QNAP piloto não anuncia SMB3 encryption; o gateway exige signing e negocia encryption conforme suporte, exatamente como definido na ADR, sem downgrade para SMB1/SMB2.
- O enrollment não reduz mais toda falha a `SMB_CREDENTIAL_REJECTED`: causas operacionais recebem mensagens humanas em português, enquanto a referência UUID fica reservada à correlação com o suporte e coincide com o ID do log.
- Enrollment, rotação e desvinculação não exigem mais reautenticação recente nem justificativa; a autorização administrativa, vínculo ator/alvo, ticket efêmero single-use, nonce, rate limit e auditoria continuam obrigatórios.
- A descoberta de shares combina os canais stdout e stderr do `smbclient`; avisos não conseguem mais ocultar o `NT_STATUS_*` devolvido pelo QNAP.
- O gateway é executado por usuário Linux dedicado a partir de release imutável em `/opt/alpha-explorer-gateway/current`; a chave privada da CA fica fora do volume montado no container.
- `ONYX` é bloqueada permanentemente no gateway por pertencer a outro sistema, independentemente do catálogo retornado pelo NAS.
- Listagem, pasta, download Range, upload em chunks, rename, move de arquivo, lixeira/restauração e reconciliação foram implementados com SMB simulado.
- Movimento recursivo de diretório é bloqueado; busca global SMB e smoke QNAP/Vault reais continuam pendentes.
- Exposição real permanece bloqueada até prova QNAP de que usuários piloto não conseguem criar reparse/symlink e um teste concorrente confirmar a mitigação de TOCTOU por path.

### File List

- `auth.ts`; `src/types/next-auth.d.ts`
- `src/lib/alpha-explorer/http.ts`; `src/lib/alpha-explorer/smb/`
- `src/app/api/alpha-explorer/smb/`; `src/app/api/alpha-explorer/smb/admin/`
- `src/app/PainelAlpha/ExploradorArquivos/page.tsx`; `src/app/PainelAlpha/ExploradorArquivos/AdministracaoQnap/page.tsx`
- `src/components/AlphaExplorer/AlphaExplorerSmbClient.tsx`; `AdminQnapClient.tsx`
- `src/components/AlphaExplorer/ExplorerHeader.tsx`
- `src/components/AlphaExplorer/SmbExplorerUpload.tsx`; `SmbIdentityGate.tsx`
- `scripts/alpha-explorer-smb.mjs`; `ops/alpha-explorer-gateway/` (administração Vault e múltiplas shares)
- `scripts/configure-alpha-explorer-smb-env.mjs`; `ops/alpha-explorer-gateway/deploy/`
- `tests/alpha-explorer/smb-ticket.test.ts`; `smb-browser-client.test.ts`
- `tests/alpha-explorer/smb-binding-metadata.test.ts`
- `tests/alpha-explorer/admin-navigation.test.ts`
- `tests/alpha-explorer/smb-config.test.ts`
- `tests/alpha-explorer/http-origin.test.ts`
- `tests/alpha-explorer/smb-error-messages.test.ts`
- `prisma/schema.prisma`; `prisma/migrations/20260916145000_alpha_explorer_smb_binding/migration.sql`
- `docs/architecture/adr-alpha-explorer-identidade-smb.md`
- `docs/security/threat-model-alpha-explorer-smb.md`
- `docs/operations/alpha-explorer-smb.md`
- `docs/qa/storage-alpha/alpha-explorer-smb-validation.md`
- `.env.example`; `.gitignore`; `eslint.config.mjs`; `package.json`

## QA Results

_A preencher pelo `@qa`._
