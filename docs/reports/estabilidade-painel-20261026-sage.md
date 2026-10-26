# Sage — casos de borda da estabilidade do Painel Alpha

26/10/2026. **APROVADO no escopo local**, após Forge, Probe, Anubis e aprovação do delta Lens. Aplicação preservada; somente duas fixtures e documentação alteradas. Staging e produção autenticados continuam pendentes do rollout DevOps.

## Casos adicionais executados

Ampliadas as fixtures existentes, exercitando o hook de workspace real e o helper público de espera:

- Resposta de leitura do usuário anterior, ainda pendente durante troca de identidade, não substitui abas, preferências ou rascunho do novo usuário.
- Escrita de preferências do usuário anterior terminando com sucesso ou falha não aplica baseline/erro nem dispara escrita cruzada no novo usuário; uma nova intenção explícita continua funcionando depois do settlement.
- Leitura inicial que termina depois da desmontagem não hidrata o store compartilhado.
- Action que rejeita depois da desmontagem é consumida, retorna null e não escreve, não altera store nem emite toast tardio.
- Retry-After vazio, inválido e overflow não introduzem espera infinita; zero/data passada respeitam piso de1s, data futura é interpretada em UTC e espera excessiva é limitada a300s.

São seis casos de regressão novos: cinco de notas (incluindo sucesso/falha parametrizados) e um caso de limites do Retry-After. Não há testes que apenas copiam uma linha de implementação.

## Resultado próprio

**9 arquivos /94 testes PASS**, exit0, duração Vitest1,78s. Regressões de notas/pollers, transporte, autorização Auth.js real, SSR, voz e Onyx foram executadas em um worker. O binding staging foi conferido em memória antes da execução final; o processo dos testes recebeu segredo e URLs exclusivamente sintéticos locais. Nenhum banco remoto ou dados reais acessados.

ESLint das duas fixtures: **0erros/0warnings**. `git diff --check`: PASS. **`npm run typecheck` oficial com8GB e tipos Next: PASS/exit0** depois das adições de teste. Logs privados `sage-focused-final.log` e `sage-typecheck.log` em `/var/tmp/alpha-estabilidade-20261026/`.

A primeira execução sem o wrapper não forneceu AUTH_SECRET sintético e falhou em9fixtures Auth.js; foi descartada como evidência de aprovação e repetida corretamente. Uma expectativa nova de ausência de escrita também foi corrigida na fixture: abrir uma aba muda legitimamente o modo para COMPACTO. A fixture final hidrata essa preferência no novo usuário antes de abrir a aba, isolando o efeito da resposta antiga sem impedir a persistência de uma intenção real. Nenhuma aplicação foi modificada para tornar o teste verde.

## Fronteiras já cobertas e limites

Conferidos os recibos: deadline5,502s/10s, abort/cancel/limpeza, POST uma tentativa, pool auth8/SSR4 retido até settlement, observador tardio sem autorização, revogação/ACL, JSON-body travado, SSE além do limite JSON e cancelamento original, token individual/ownership, recuperação/foco/visibilidade e isolamento de voz. Parte desses casos integra os94testes próprios; os demais têm recibos Forge/Anubis/Nova. Não somar subconjuntos como testes distintos à suíte integral814arquivos/6.801testes do Forge.

Jailbreak/prompt injection: não aplicável ao delta, que não altera prompts, ferramentas ou autorização do motor de IA. Autorização e ownership das rotas IA atingidas foram testados; não foi feito scan geral do motor nem alegada proteção nova contra jailbreak.

Sem E2E autenticado remoto, medição de carga real, normalização de Turso/upstreams, configuração de voz staging, env/schema, commit ou deploy nesta etapa. A cobertura V8 integral anterior corresponde ao escopo BPM/NPS configurado, não a cobertura universal do repositório. DevOps deve homologar primeiro staging e somente depois produção com bindings separados.

File list Sage: este relatório, checklist/resultados da story, `tests/notas/workspace-resiliencia-react.test.tsx` e `tests/layout/estabilidade-consumidores-react.test.tsx`. Nenhum bloqueante de aplicação novo encontrado; fila liberada para consolidação documental e rollout autorizado.
