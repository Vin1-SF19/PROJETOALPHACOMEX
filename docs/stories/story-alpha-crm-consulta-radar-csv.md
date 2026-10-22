# Consulta RADAR pela publicação CSV da Receita Federal

## Critérios de aceite

- [x] Adicionar endpoint isolado e integrar os consumidores RADAR existentes sem alterar caminhos, autenticação ou formato principal.
- [x] Reutilizar a autenticação, permissão e limite de consultas da pré-análise tributária.
- [x] Manter a aquisição/armazenamento CSV no serviço RADAR do ialpha; Vercel faz chamadas autenticadas server-side.
- [x] Adaptar consumidores Alpha preservando caminhos e formato principal das respostas.
- [x] Consultar por raiz CNPJ (8 dígitos ou CNPJ completo) e comunicar limitações da fonte.
- [x] Quando a publicação atual não contém o CNPJ, exibir informação RADAR histórica do banco se houver, indicando que é dado salvo anteriormente; sem dado útil no banco, exibir “Não informado” e “NÃO CONSTA”.
- [x] Cobrir serviço e rota com testes automatizados.
- [x] Documentar a configuração persistente no serviço ialpha e o formato da API.

## Arquivos

- [x] `src/app/api/ConsultaRadarCsv/route.ts`
- [x] `tests/radar/consulta-csv.test.ts`
- [x] `docs/radar-csv.md`
- [x] `src/lib/radar/consulta.ts`
- [x] `src/app/api/ConsultaCompleta/route.ts`
- [x] `src/app/PainelAlpha/SistemaPreAnalise/BlocoResultados.tsx`
- [x] `src/actions/PreAnalise.ts`
- [x] `src/components/ComponentesRadar/HabilitacaoRadarClient.tsx`
- [x] `tests/pre-analise/consultas-tributarias.test.ts`
- [x] `tests/radar/consulta-completa.test.ts`
