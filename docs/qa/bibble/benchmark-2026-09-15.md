# Bibble benchmark local — 2026-09-15

- Runtime: llama.cpp local `127.0.0.1:18080`; modelo `qwen3.8-131k`; janela 131.072; concorrência 1.
- Prompt sintético fixo, temperatura 0, 3 amostras, 128 tokens de teto. Nenhum conteúdo corporativo foi registrado.
- Cada amostra realizou exatamente 1 chamada ao provider e 0 ciclos de tool. A antiga geração de decisão descartada não existe no runner atual.
- Total p50: 1.241 ms; p95: 1.493 ms.
- TTFT p50: 1.159 ms; p95: 1.411 ms.
- Provider reportou 58 tokens de saída exatos por amostra; throughput de geração observado entre 705,60 e 710,92 tokens/s no trecho após TTFT.
- Finish reason: `stop` nas 3 amostras.

O resultado serve como baseline sanitizado pós-refatoração. O diagnóstico anterior registrou 2 chamadas para conversa comum (~5 s de trabalho descartado); a comparação estrutural usa o mesmo contrato sintético, mas o valor histórico não foi reexecutado porque o caminho antigo foi removido.

## Tool loop read-only real

`npm run bibble:benchmark:tool` executou no mesmo provider um ciclo sintético completo: uma chamada de decisão, um tool call read-only e uma chamada final (`providerCalls=2`, `toolCycles=1`) em 2.384 ms. O provider reportou usage exato nas duas etapas (371 e 178 tokens totais). Nenhuma mutação ou dado de usuário participou do smoke.
