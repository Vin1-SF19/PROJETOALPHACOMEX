# Logcomex — worker persistente para produção Vercel

O painel de produção painel.alpha-comex.com responde como Vercel. O job anterior ficava em globalThis da função que iniciou a coleta; o polling podia chegar a outra função e retornar “Execução não encontrada”. O subprocesso de navegador também não tem vida longa garantida em função serverless.

A Vercel agora encaminha coleta, cancelamento, CAPTCHA, processamento de empresas e leituras do histórico para um único processo Next/systemd no ialpha. Sessão e permissão do módulo continuam verificadas na Vercel. A comunicação usa POST HTTPS, HMAC sobre path/issuer/audience/timestamp/nonce/hash integral do corpo (operação, identidade e dados), validade de 45 segundos, sem cookies ou chave no browser. O worker revalida a permissão efetiva e usa o dono assinado em cada comando. Nonces/jobs em memória exigem processo único e não sobrevivem a reinício; não reiniciar/deploy durante coleta ativa. Históricos persistidos continuam disponíveis, mas não há retomada automática garantida após restart.

## Configuração concreta

1. Ativar candidato validado no servidor com `sudo bash /home/ialpha/projetos/alpha-comex/painel-alpha/scripts/activate-alpha-catcher-logcomex-worker-stage.sh`.
2. O ativador cria ou reutiliza a chave privada de 64 caracteres hexadecimais em `/home/ialpha/.config/painel-alpha/alpha-catcher-worker.env`, modo0600. Não imprimir a chave em logs, versionar ou usar NEXT_PUBLIC. Instala HOST=true e URL vazia na release do servidor.
3. Na configuração **Production** do projeto Vercel `painel-alpha-projeto`, definir `ALPHA_CATCHER_WORKER_URL=https://stagepainel-alpha.alpak.ai` e `ALPHA_CATCHER_WORKER_SECRET` igual ao valor privado do arquivo. A chave permanece exclusiva desta integração.
4. Publicar o código corrigido em produção depois das variáveis. A alteração de variáveis sozinha não modifica o deploy anterior. Separar alterações de outras tarefas antes de commit/push/deploy; esta entrega não fez commit ou publicação Vercel.
5. Validar na conta autorizada: início202, polling200 no mesmo job, progresso, resultados, cancelamento/CAPTCHA e histórico com autor/estado correto. Não usar uma coleta real como smoke sem escolha explícita do usuário. O smoke desta entrega só usa leituras ou chamadas rejeitadas sem autenticação.

Sem URL/chave válida na Vercel, a API retorna503 explicando worker indisponível; não cai para subprocesso local. Worker receptor retorna404 se não estiver em HOST=true ou se estiver em Vercel. Entrada assinada é limitada a8KB. Endpoint dedicado: `/api/internal/alpha-catcher/worker`. URL remota precisa ser origemHTTPS sem credenciais, query, fragmento ou path personalizado; redirects são recusados.

Staging e produção devem apontar ao mesmo banco para histórico consistente. Verificar no host/ambiente sem expor URLs com credenciais; esta integração não faz migration/backfill. Rollback da aplicação: release anterior preservada pelo ativador. Na Vercel, voltar ao deploy anterior remove o bridge mas restaura também a limitação serverless; desativar variáveis não corrige a implementação antiga.

Diagnóstico CLI somente leitura: `node --conditions=react-server --import tsx scripts/diagnose-alpha-catcher-worker.mts` reporta configuração sem segredo. Com `--user-id ID [--job-id UUID]`, verifica resposta remota sem iniciar coleta/processamento e mostra só status.
