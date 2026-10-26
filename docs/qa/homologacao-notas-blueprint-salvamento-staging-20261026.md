# Homologação de Notas e Blueprint em staging — 26/10/2026

**PASS nos cenários exercitados.** Release `fb0e8546d75e95f96e780f2049b43d75f6466e15`, deployment `dpl_BCXiMgDkxmJ7Sda528NqvEH3e7ek`, em https://staging.alpha-comex.com. Navegação por Chromium, login normal da conta fictícia Admin e menu/iframe oficiais. Não houve chamada direta de actions/API ou banco para fabricar resultado.

## Persistência, falha e recuperação

### Notas

| Verificação | Resultado |
| --- | --- |
| criar e salvar nota pela interface | PASS |
| nova leitura sem rascunho confirma edição | PASS |
| falha de transporte preserva texto e rascunho | PASS |
| recarregar recupera texto ainda não confirmado | PASS |
| retentativa confirma e remove rascunho próprio | PASS |
| nova leitura confirma texto recuperado | PASS |
| renomear pela aba persiste título e preserva texto em nova leitura | PASS |

### Blueprint

| Verificação | Resultado |
| --- | --- |
| criar projeto fictício e salvar documento | PASS |
| reabrir documento em contexto novo confirma persistência | PASS |
| erro de transporte conserva rascunho Blueprint | PASS |
| remontar editor recupera documento não confirmado | PASS |
| retry Blueprint confirma e limpa rascunho próprio | PASS |
| nova leitura sem rascunho confirma especificação recuperada e salva | PASS |

As novas leituras usaram contextos autenticados sem o rascunho local anterior. A falha foi provocada abortando somente o POST de salvamento da própria fixture, mantendo as leituras disponíveis; a interface preservou o conteúdo e permitiu a retentativa. Notas foi recarregado e Blueprint teve o editor desmontado/remontado antes de recuperar o texto.

## Limpeza e integridade

As duas fixtures e seus conteúdos fictícios foram removidos pela interface normal, com nova leitura independente confirmando a remoção. A nota passou pela lixeira e exclusão individual. O projeto foi aberto para conferir sua identidade, retornou à lista filtrada, teve seleção inicial vazia e apenas um alvo confirmado no modal; a senha da própria conta foi carregada em memória, sem impressão ou registro. Nenhum comando de selecionar todos, chamada direta ou alteração em dados preexistentes foi usado.

Foram concluídas 13 verificações funcionais e dois percursos de limpeza. IDs, nomes dos registros, credenciais, cookies, screenshots e rastreio detalhado permanecem em evidência privada fora do Git. O [resultado curado](homologacao-notas-blueprint-20261026/result.json) contém somente checks e metadados sanitizados.

## Limites e ocorrências da automação

O navegador usou a conta fictícia Admin. Não foi homologado por UI um usuário comum; autorização/negação desses perfis está nas regressões. Os percursos não substituem os testes de concorrência, CAS, idempotência e rollback nem aprovam produção.

Houve interrupções de automação por tutorial inicial, carga de iframe e locators que encontravam DOM inativo/toasts duplicados. A criação não foi repetida: a execução retomou os mesmos registros. O detector de armazenamento Blueprint também foi corrigido para reconhecer o nome real da chave; aquela tentativa não foi declarada PASS. Os resultados desta evidência são as observações positivas concluídas depois desses ajustes, preservando os registros privados das interrupções.
