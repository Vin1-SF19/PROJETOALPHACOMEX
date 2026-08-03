# CodeRabbit Review — TI/Admin, POP e avatar

- Escopo solicitado: alterações não commitadas
- Resultado: não executado
- Motivo: o host Windows não possui WSL instalado; a skill `coderabbit-review` depende do binário `~/.local/bin/coderabbit` dentro do WSL.
- Evidência: `wsl bash -lc '~/.local/bin/coderabbit auth status'` retornou que o Subsistema do Windows para Linux não está instalado.
- Revisão substituta: varredura estática de gates `Admin`/`CEO`, lint dos arquivos centrais novos, testes Vitest focados e build Next.js de produção.

## Decisão

CONCERNS — sem achado crítico conhecido, mas o gate automatizado CodeRabbit permanece indisponível neste ambiente.
