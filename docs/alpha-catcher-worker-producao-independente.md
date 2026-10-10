# Worker de produção independente

O instalador cria serviço, release, dependências, segredo, Gmail e sessões próprios na ialpha. O painel continua na Vercel. Staging continua com seu serviço atual. Nenhum comando executa migration, build, coleta ou escrita de banco.

## 1. Revisar e instalar na ialpha

```bash
cd /home/ialpha/projetos/alpha-comex/painel-alpha
bash scripts/install-alpha-catcher-worker-prod.sh plan
sudo bash scripts/install-alpha-catcher-worker-prod.sh plan
sudo bash scripts/install-alpha-catcher-worker-prod.sh apply
```

O plan comum não lê credenciais privadas; o plan com sudo verifica env e Gmail. Apply exige portas 3301/3302 livres, nginx existente, 6 GB livres, build validado e paths absolutos de automação. Bloqueia artefatos existentes; não sobrescreve instalação nem troca segredo. Usa a release validada `20261009-130924-alpha-catcher-logcomex-worker`, verifica hashes de runtime e copia dependências sem hardlinks. `/home/ialpha/deployments/alpha-catcher-worker-prod` contém release e estado; `/home/ialpha/.config/painel-alpha/alpha-catcher-worker-prod.env` contém segredo novo privado.

Falha de instalação desativa e retira somente unit/proxy recém-criados, preservando cópias para diagnóstico. Não tente repetir apply apagando pastas; revise o erro. Smoke testa POST sem assinatura (401), bloqueio da página (404), HMAC de leitura para execução inexistente (404) e replay (401). O usuário 41, previamente identificado para diagnóstico, precisa manter acesso ao módulo; o smoke exige banco disponível e não inicia coleta nem escreve dados.

## 2. Publicar o endpoint HTTPS

O domínio proposto é `catcher-worker.alpha-comex.com`. A hospedagem de `painel.alpha-comex.com` na Vercel é independente do provedor DNS. Confirme quem administra a zona DNS e se ela está disponível na conta Cloudflare do Tunnel antes de publicar. Não crie hostname por dashboard de tunnel remoto: o tunnel encontrado na ialpha usa configuração local.

Um operador deve preservar todas as regras de `/etc/cloudflared/config.yml`, fazer uma cópia de configuração e inserir esta regra **antes da regra final catch-all**:

```yaml
- hostname: catcher-worker.alpha-comex.com
  service: http://127.0.0.1:3302
```

Valide a configuração com `cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate`. Verifique quais unidades Cloudflare usam essa configuração, incluindo o conector redundante, antes de recarregá-las: uma reinicialização compartilhada pode interromper brevemente os outros hostnames. O instalador não altera nem reinicia o Tunnel.

Na zona Cloudflare apropriada, crie CNAME `catcher-worker` para `dd459089-d5a3-41fc-ad36-37b80db99d0f.cfargotunnel.com`, com proxy habilitado. Se a zona não estiver nessa conta, resolva a delegação/configuração DNS com o administrador antes de continuar; um CNAME em outro provedor não garante TLS nesse Tunnel. Não altere o registro `painel` da Vercel.

Após publicar, estes testes precisam retornar 401 e 404 respectivamente:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://catcher-worker.alpha-comex.com/api/internal/alpha-catcher/worker -H 'Content-Type: application/json' -d '{}'
curl -sS -o /dev/null -w '%{http_code}\n' https://catcher-worker.alpha-comex.com/
```

O proxy aceita somente POST no endpoint interno, com body máximo 8 KB; a assinatura HMAC é obrigatória. Não publique a porta Next 3301 diretamente e não coloque uma tela Cloudflare Access na frente sem configurar autenticação de serviço compatível.

## 3. Apontar a Vercel para o worker

Somente depois de HTTPS funcionar, no projeto Vercel → Settings → Environment Variables, escopo Production:

- `ALPHA_CATCHER_WORKER_URL=https://catcher-worker.alpha-comex.com`
- `ALPHA_CATCHER_WORKER_HOST=false`
- `ALPHA_CATCHER_WORKER_SECRET`: copie o valor privado da ialpha, sem enviá-lo ao chat ou versioná-lo.

Use um mecanismo privado para transferir o valor ao campo da Vercel. Não imprima no terminal compartilhado nem envie ao chat. Se o CLI Vercel já estiver instalado e autenticado no projeto correto nessa máquina, é possível transferir diretamente por stdin:

```bash
sudo sed -n 's/^ALPHA_CATCHER_WORKER_SECRET="\([a-f0-9]*\)"$/\1/p' /home/ialpha/.config/painel-alpha/alpha-catcher-worker-prod.env | vercel env add ALPHA_CATCHER_WORKER_SECRET production
```

Antes da troca/redeploy, compare a identidade do endpoint de banco da Vercel e do worker por fingerprint privado, sem divulgar URLs/tokens. É obrigatório executar uma chamada HMAC somente leitura de `listar-historico` por HTTPS e conferir compatibilidade com o histórico de produção; o 404 local de execução inexistente não comprova identidade do banco. O diagnóstico existente (`scripts/diagnose-alpha-catcher-worker.mts`) auxilia a validação autenticada somente leitura da configuração. Faça Redeploy de Production após esses gates e salvar as variáveis. A build da Vercel deve conter o código do bridge já preparado. Guarde os valores anteriores da Vercel para rollback.

Teste HTTPS autenticado de listagem sem exibir dados/segredo:

```bash
sudo /home/ialpha/.config/nvm/versions/node/v22.22.3/bin/node scripts/alpha-catcher-worker-prod/smoke.mjs /home/ialpha/.config/painel-alpha/alpha-catcher-worker-prod.env https://catcher-worker.alpha-comex.com
```

## Operação e rollback

```bash
sudo systemctl status alpha-catcher-worker-prod.service
sudo bash scripts/install-alpha-catcher-worker-prod.sh rollback
```

Rollback compara hashes das configurações que criou, aguarda ausência de coleta ativa, para somente o worker, desativa sua unit/proxy e preserva releases, estado e segredo. Reverter variáveis Vercel e remover somente a regra/registro DNS do worker são passos manuais; staging, banco e backups permanecem intactos. Se arquivos tiverem sido editados ou instalação estiver parcial, a revisão manual evita apagar configuração alheia.

As execuções ficam em memória: reiniciar o worker perde jobs em andamento; histórico persistido permanece. Mesmo login Logcomex mantém o lock compartilhado `/tmp/painel-alpha-logcomex-login.lock` para evitar logins concorrentes entre produção e staging. Não defina TMPDIR exclusivo. As pastas de automação externas continuam compartilhadas, embora env/dependências do painel e estado Gmail/sessões sejam próprios; alterações nessas automações devem ser coordenadas.

O nginx espera até 180 segundos, mas isso não amplia o limite do Cloudflare. O proxy Cloudflare pode retornar 524 após aproximadamente 125 segundos de espera; iniciar/pollar coleta em segundo plano usa chamadas curtas, porém processamento individual demorado ainda está sujeito a esse limite. Consulte a [documentação de erro 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/).
