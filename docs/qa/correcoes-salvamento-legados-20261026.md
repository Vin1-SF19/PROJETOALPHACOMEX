# Correções de salvamento dos módulos legados

Data: 26/10/2026. Story: `story-correcoes-salvamento-sistema-20261026.md`. Base de publicação: `aca95ddb402da03a5d58b7833a04bd99b018e537`, com o Checklist reformulado preservado.

## Resultado por achado

| Achado | Implementação no candidato |
| --- | --- |
| S02 e S03 | Já atendidos pelo Checklist vigente. O serviço aplica apenas `patch`, usa CAS e mutationId e confirma item/progresso/eventos transacionalmente. A UI só aplica resposta confirmada e preserva observações no DraftGuard. Os arquivos antigos da cópia local não foram portados. |
| S09 | Criação verifica cada retorno; recorrência remove do formulário somente os dias confirmados. Escritas usam Prisma com select enxuto e quantidade de linhas; leitura usa SQL parametrizado, preservando os casts de datas legadas. Opcionais omitidos não viram undefined em SQL. Falha P2023 não retorna sucesso. |
| S10 | Ator identificado pela sessão; status, papel e permissões efetivas vêm do banco. Gestão de tarefas exige módulo de gerenciamento/Admin; conclusão respeita alvo próprio ou a conta compartilhada que o painel de Serviços Gerais já utiliza. Reservas repetem no servidor a política de Admin/autor já existente na UI. Diretrizes e demais gravações equivalentes também têm guarda. |
| S11 | Validação única de data/intervalo no cliente e servidor. INSERT/UPDATE condicionais parametrizados impedem sobreposição em um só comando SQLite, inclusive entre duas conexões; não houve criação de schema/índice. Falhas mantêm formulário e liberam estado de salvamento. |
| S12 | Cadastro mestre e histórico compartilham transação. O modal libera o indicador em finally e mantém os rascunhos em falha de transporte ou resultado parcial. |
| S13 | Campos opcionais limpos enviam vazio explícito. UF admite vazio de acordo com sua coluna string existente; campos PJ ocultos durante edição PF ficam omitidos. |

## Evidências executadas

- Pacote da cópia local: 31 arquivos / 262 testes aprovados, incluindo 29 casos novos. Lint dos arquivos sob responsabilidade: zero erros e 62 avisos existentes.
- Candidato com base remota vigente: `vitest run tests/checklist-analistas tests/salvamento-legados`: **19 arquivos, 196 testes aprovados**, sendo 173 da suíte canônica Checklist e 23 novos portáveis.
- A cópia candidata dos testes omite somente seis casos do contrato Checklist antigo, substituídos pela suíte canônica existente. Nenhum skip global foi acrescentado.
- SQLite real temporário demonstrou rollback de cadastro/histórico, criação e edição de reservas concorrentes com exatamente um vencedor, leitura de datas pelo Prisma e recusa de sobreposição com reservas gravadas pelo ORM. A cópia local também demonstrou rollback do checklist/progresso anterior; a arquitetura publicada foi validada pelos seus testes próprios.
- Todos os testes usaram adapters simulados ou SQLite temporário. Nenhum registro de negócio, schema ou configuração de banco real foi alterado.
- A primeira execução do candidato encontrou dependências duplicadas de React/cliente Prisma. A árvore isolada foi corrigida pelo DevOps e a execução repetida passou. Não foram alterados testes ou produto para ocultar esse problema de ambiente.

## Limites materiais preservados

A tabela legada de reservas guarda autoria pelo nome, sem FK para usuário. A guarda nova repete a regra que a UI já aplicava; identidade durável de autoria exigiria mudança estrutural separada, com Vault. A coluna `alerta` de tarefas não consta no schema atual: o cadastro é confirmado e a indisponibilidade do alerta é comunicada explicitamente. Não foi executada migration para habilitar esse recurso.

A homologação autenticada e os quatro gates do pacote integrado são coordenados na story principal; esta evidência isolada não autoriza produção.

## Arquivos portados

- `src/actions/Tarefas.ts`
- `src/actions/Reservas.ts`
- `src/actions/Clientes.ts`
- `src/actions/convites-parceiro.ts`
- `src/lib/legacy-write-access.ts`
- `src/lib/reservas/intervalo.ts`
- `src/app/PainelAlpha/ReservaSalas/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/PainelTarefaC/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/page.tsx`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`
- `src/components/Parceiros/ModalEditarPreCadastro.tsx`
- `tests/salvamento-legados/actions.test.ts`
- `tests/salvamento-legados/sqlite.test.ts`
- `tests/salvamento-legados/ui.test.ts`

Manifesto com hashes e logs de execução: `/tmp/alpha-salvamento-stage-20261026/legados-manifest.json`.
