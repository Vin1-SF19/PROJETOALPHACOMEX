# Bibble: observabilidade e benchmark

Os logs `[BIBBLE_METRICS]` contêm apenas identificador irreversível do usuário, `requestId`, modelo, fila, TTFT, duração, tokens, origem da contagem, tokens/s, tools e terminação. Prompt, resposta, anexos, credenciais, URLs assinadas e paths não são registrados.

Use `npm run bibble:doctor` para validar configuração e provider sem imprimir segredos. Use `npm run bibble:capabilities` para inspecionar o registry executável e `npm run bibble:benchmark` para três amostras sintéticas comparáveis. Ajuste `BIBBLE_BENCHMARK_SAMPLES` para ampliar a amostra.

TTFT alto com fila baixa aponta para processamento do prompt/provider; fila alta aponta para saturação local; tokens/s mede a geração após o primeiro token. Calcule p50/p95/p99 agregando os JSONs fora do request. O rate limit é local à instância; coordenação multi-instância exige infraestrutura futura.

O smoke automático usa somente prompt sintético e tool read-only. Não execute mutação ou filesystem externo no benchmark.
