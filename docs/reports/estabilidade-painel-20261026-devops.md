# DevOps — rollout da estabilidade do Painel Alpha

26/10/2026. Rollout autorizado pelo usuário para staging e produção, nessa ordem. Este registro inicia com preflight; resultados ambientais serão acrescentados após execução real.

## Candidato e gates

Worktree isolado em disco, base20f310a345e04171fbe0b8e3e37f4ef0ce2e126f, preservando a correção CRM já no staging. Checkout raiz sujo e refs concorrentes não foram importados nem revertidos. Manifesto exato Forge reexecutado: aplicação/schema/config SHA256 `86f8d17971aabed14359a70a85dfb1f1547954905994a34467e9df962cdc8c04`, idêntico à rodada6 aprovada. Manifesto total atual `33a4e1c0664a35d0025976bf5b6eec6af9e2581d18da1984906a753f1a972963` inclui testes adicionais Sage. Não repetir gates completos sem mudança de aplicação.

Forge: lint global0erros (warnings legados documentados), typecheck com tipos Next, suíte integral814arquivos/6.801testes na fonte anterior e deltas proporcionais63testes, build e HTTP local aprovados. Probe79, Anubis103, Lens delta e Sage94 aprovados; subconjuntos não somados à suíte integral. CodeRabbit ausente; fallback manual permitido e efetivamente executado. Diff-check sem erro. Nenhuma dependência, schema ou migration alterada.

Auditoria suplementar npm do lockfile inalterado encontrou120advisories legadas:10critical,48high,61moderate,1low. Isso não é auditoria limpa nem regressão introduzida pelo hotfix; upgrades globais ficam fora da correção operacional e não foram aplicados. Revisão de segurança do delta é o recibo Anubis.

## Preflight ambiental —22:14UTC

- Staging: deployment `dpl_SHbaU4Jx5FVC6g2SB53PXFWrwGeC`, READY, source20f310, ambiente customizado staging, regiãoiad1.
- Produção: deployment `dpl_GJYimTvUq5cLBDAbHML3bf4FVH8p`, READY, sourceca156313, targetproduction, regiãoiad1.
- Git remoto: main4d949d4c; staging508f6c4a contém trabalho CRM com migration alheia. Preservar refs, sem force/merge cego.
- Bancos distintos conferidos por hashes em memória; staging7fdd1607… e produção3a07b72d…. Nenhuma credencial/ambiente de produção copiado para staging.
- Nenhum override remoto das três variáveis server de prazo: defaults novos10s transporte/12s auth/20s SSR serão usados.
- Voz staging sem configuração própria; não copiar endpoint de produção nem usar loopback. Validar resposta pública de configuração indisponível.
- Somente commit revisado entra no arquivo de release; `.env`, core dumps, node_modules, logs privados, coverage e `.next` local não são insumos de upload.

## Plano executável e rollback

Publicar artefato fonte limpo para targetstaging com SHA40 coerente no build/runtime/metadados. Validar SHA pelo healthversion, login normal, módulos/frames, pollers/geo e códigos IA antes de produção. Produção terá build próprio targetproduction com configurações próprias, sem promover cegamente configurações staging. Observar10–15min após READY, separando requestsHTTP de eventos de log/contadores por instância. Sem schema/bulk/replay de escrita.

Rollback de código somente se regressão desta entrega for comprovada, usando o deployment anterior do mesmo ambiente, conferido novamente antes da troca de alias. Nenhuma restauração/cópia de banco faz parte do rollback.

Evidências privadas em `/home/ialpha/.config/painel-alpha/estabilidade-20261026/`; contêm apenas localmente os recibos autenticados, sem versionar tokens/PII.

## Resultados ambientais

PENDENTES: stagingREADY/smoke e produçãoREADY/smoke/observação. Não inferir saúde externa a partir dos gates locais.
