# Evidências da auditoria de salvamento

Relatório: [Auditoria de edição e salvamento do Painel Alpha](../../../reports/auditoria-salvamento-sistema-2026-10-26.md).

Os testes deste diretório **confirmam comportamentos defeituosos observados**. Estão separados da suíte funcional normal porque suas expectativas descrevem o defeito atual. Um resultado verde aqui significa reprodução confirmada. Ao corrigir cada problema, criar uma regressão funcional em `tests/` que exija o comportamento correto; esta evidência histórica poderá deixar de passar sobre a versão corrigida.

## Arquivo histórico das reproduções

Os arquivos `*.test.ts.txt` preservam os bytes das reproduções originais, fora da compilação da versão corrigida. Para repetir a auditoria histórica, use a base e os hashes registrados em `execucao.json`, restaurando a extensão `.ts` em um checkout isolado daquela base. Os comandos abaixo pertencem à execução original.

Na raiz do repositório, com as dependências já instaladas:

```sh
node_modules/.bin/vitest run --config docs/qa/evidencias/auditoria-salvamento-20261026/vitest.config.ts
npm run lint -- docs/qa/evidencias/auditoria-salvamento-20261026
npm run typecheck
```

As reproduções usam actions/componentes reais com Prisma, sessão, integrações e editor Tiptap simulados. O ambiente de interface é happy-dom. Nenhum teste deste diretório abre conexão com banco, envia notificações ou modifica cadastros reais. Simular um retorno de gravação não comprova comportamento do driver remoto.

| Identificador | O que foi observado |
| --- | --- |
| N01 | Resposta antiga da nota remove rascunho posterior e mostra Salvo. |
| N02 | Reconexão não retoma gravação offline. |
| N03 | Rascunho recuperado não agenda envio. |
| N04 | Rascunho de versão anterior não é apresentado para resolução. |
| N05 | Erro de persistência rejeita a action de notas. |
| N06, dois casos | Arquivar/lixeira negados ainda exibem sucesso e removem rascunho local. |
| C01 | Anotação do CRM não registra pendência e é perdida ao remontar. |
| C02 | Gravação de outro item recarrega e substitui observação local pendente. |
| CK01 | Mudança somente de status envia observação nula ao banco. |
| CK02 | Falha do progresso devolve erro após confirmação simulada da escrita do item. |
| TK01 | Conclusão com zero registros alterados responde sucesso. |
| TK02 | Criação de tarefa usa usuário enviado sem consultar sessão. |
| TK03 | Campos opcionais omitidos produzem undefined no SQL da edição. |
| RV01 | Action aceita fim anterior ao início de reserva. |
| RV02 | Edição de reserva chega à escrita sem consultar sessão. |
| P01 | Limpar Complemento do pré-cadastro envia undefined. |
| B01 | Falha apenas no histórico retorna fracasso após gravação simulada do documento. |

## Inventários

- `inventario-codigo.json`: levantamento sintático do código local. Contagens não equivalem a execuções ou campos de negócio únicos.
- `campos-interface.csv`: ocorrências de campos JSX com linhas, identificação, eventos e restrições. Componentes podem representar buscas e filtros; campos dinâmicos podem ter uma única declaração para vários atributos de negócio.
- `matriz-etapas-staging.json`: metadados consultados por SELECT e avaliados pelo resolvedor local. Não contém valores de cards. Flags de edição não incorporam as permissões efetivas de um usuário nem condições avaliadas por card.
- `lint-resumo.json`: diagnósticos do lint geral por diretório; todos os erros dessa rodada estavam em `.cache`.
- `execucao.json`: versões, ambiente, resultados e hashes dos arquivos relevantes.
- Arquivos `.log`: saídas curadas dos testes e gates, sem conteúdo de banco ou tokens.

Os arquivos de ambiente não estão incluídos. A consulta de configuração foi feita com `.env.staging.local`, cuja identidade de banco foi conferida separadamente dos arquivos locais usuais. Nenhuma estrutura ou configuração do banco foi alterada.

Os quatro logs históricos estão em gzip determinístico para preservar integralmente seus bytes. Use `gzip -dc arquivo.log.gz` para leitura; os hashes originais e dos arquivos comprimidos constam em `execucao.json`.
