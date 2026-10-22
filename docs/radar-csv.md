# Consulta RADAR pelo CSV da Receita Federal

Endpoint autenticado: `GET /api/ConsultaRadarCsv?cnpj=12345678`. Também aceita CNPJ completo com 14 dígitos (com pontuação opcional); usa sua raiz de 8 dígitos. O endpoint exige acesso tributário da pré-análise e mantém o mesmo limite de consultas.

Resposta com correspondência: `{ "found": true, "razaoSocial": "EMPRESA EXEMPLO LTDA", "cnpjBase": "12345678", "modalidade": "ILIMITADA", "dataAtualizacaoPublicada": "08/10/2026 16h13", "consultadoEm": "2026-10-22T12:00:00.000Z" }`.

Sem correspondência, `found` é `false` e `mensagem` é `não consta no arquivo consultado`. A publicação é periódica, portanto isso não prova que uma empresa esteja definitivamente desabilitada nem representa consulta oficial em tempo real.

O painel Vercel não baixa nem armazena o CSV. O cliente server-side chama o endpoint existente do ialpha em `https://consulta-radar.alpha-comex.com/consultar/{raiz}?fonte=csv`, usando `CONSULTA_RADAR_TOKEN`; o token não é enviado ao navegador. Configure `CONSULTA_RADAR_TOKEN` como variável secreta nos ambientes Vercel usados pelo painel, com o mesmo token já autorizado em `API_TOKENS` no servidor da API. Não registre o valor no Git. Sem `fonte=csv`, `/consultar` continua usando o fluxo anterior da extensão Chrome. A API do ialpha é responsável por consultar a página [Intervenientes Aduaneiros](https://www.gov.br/receitafederal/dados/intervenientes-aduaneiros/view), descobrir data/link, validar o arquivo e manter a base atual e o backup em armazenamento persistente no próprio servidor.

Configure `RADAR_CSV_STORAGE_DIR` no serviço RADAR do ialpha, apontando para um diretório durável e gravável pelo usuário desse serviço, fora de diretórios temporários ou removidos em deploys. **Não configure essa variável na Vercel**: o painel apenas chama a API remota.

## Integração com os módulos existentes

As rotas existentes `/api/ConsultaRadar` e `/api/ConsultaCompleta` preservam caminhos, autenticação e formato principal, mas passam a usar a API remota do ialpha via cliente server-side. `ConsultaCompleta` atualiza os dados RADAR ao devolver um cadastro já armazenado. A API remota deve manter o envelope compatível `{ success: true, data: ... }` e pode incluir `dataAtualizacaoPublicada`, `consultadoEm` e `aviso`; para ausência, deve responder com situação `NÃO CONSTA NO ARQUIVO CONSULTADO` ou `found: false`. O novo `/api/ConsultaRadarCsv` é um proxy autenticado que traduz a resposta, sem expor token ou endereço de armazenamento.
