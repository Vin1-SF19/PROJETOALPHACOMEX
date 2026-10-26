# Homologação do salvamento CRM em staging — 26/10/2026

**PASS nos cenários exercitados.** Release `fb0e8546d75e95f96e780f2049b43d75f6466e15`, em https://staging.alpha-comex.com. Conta fictícia Admin, autenticação normal e navegação por menu/iframe em Chromium. A criação selecionou uma empresa fictícia já existente no cadastro interno; nenhum CNPJ foi consultado externamente.

| Verificação concluída | Resultado |
| --- | --- |
| criar card próprio Novo Lead selecionando empresa fictícia interna e responsável da sessão | PASS |
| fechar e reabrir card conserva rascunho da anotação sem enviar | PASS |
| salvar anotação confirma uma única interação e limpa somente o texto enviado | PASS |
| nova leitura independente e novo contexto exibem a anotação uma única vez | PASS |
| limpeza normal arquiva somente o card fictício e remove do board | PASS |
| cards preexistentes da empresa fictícia permanecem intactos | PASS |

A anotação não foi enviada ao fechar o card: a leitura independente encontrou zero interações daquele texto e o rascunho reapareceu ao reabrir. O botão Salvar confirmou exatamente uma interação e limpou o editor. Outro contexto de navegador, sem a cópia local anterior, exibiu a anotação na aba Histórico e uma nova leitura independente continuou encontrando uma única interação.

## Limites e limpeza

O novo card não apresentou inputs de observação de procedimentos. Esse salvamento não foi homologado pela UI nesta fixture; não houve criação de template, campo, permissão ou transição para fabricar o cenário. Preservação de observações, fila/CAS e recuperação permanecem verificadas nas regressões.

O card próprio foi arquivado pela ação individual normal da interface. A leitura independente confirmou seu status de arquivamento e os três cards preexistentes da empresa fictícia mantiveram os campos de controle conferidos (`status`, `etapaId`, `updatedAt`). Não foram usados Financeiro, Operacional ou transições. A interface não realiza exclusão física de cards nesse fluxo; IDs e motivo do registro arquivado permanecem no controle privado da execução, sem exposição neste relatório.

As interrupções do roteiro envolveram o label do autocomplete, refresh do board e a seleção da aba Histórico. A criação não foi repetida; foi retomado o mesmo registro. Os seis checks desta evidência foram observados de fato; os registros privados preservam as tentativas interrompidas.

A autenticação por navegador foi somente da conta fictícia Admin. Não há alegação de homologação de UI do perfil comum ou de todos os campos do sistema. Não houve chamada direta de escrita de actions/API/banco nem alteração de estrutura ou configuração de negócio. O [resultado curado](homologacao-crm-salvamento-20261026/result.json) não contém IDs, marcadores dos registros, credenciais, cookies ou dados pessoais.
