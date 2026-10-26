# Homologação de salvamento — Reserva de Salas

Data: 2026-10-26. Ambiente: **staging**, `https://staging.alpha-comex.com`.
Versão publicada READY informada: `fb0e8546d75e95f96e780f2049b43d75f6466e15` (`dpl_BCXiMgDkxmJ7Sda528NqvEH3e7ek`).

## Resultado

**Criação, edição, validação, releitura independente e cancelamento passaram pela UI real.** O fluxo de concluir/liberar não foi homologado pela interface, pois não há botão correspondente no módulo nem no modal de gerenciamento.

Foi usada a sessão autenticada normal já disponibilizada para homologação. A única reserva criada usou motivo fictício com prefixo `QA-SALVAMENTO-RESERVAS`, tipo Equipe, data futura em 2030 e serviço de copa desligado (`paoDeQueijo=false`). Nenhuma reserva preexistente de outra origem foi alterada. Não houve injeção de payload de Server Action, alteração de sessão, configuração, permissão, migration ou código.

| Verificação | Resultado observado |
| --- | --- |
| Término igual ao início: 10:00 → 10:00 | PASS. Mensagem “O término deve ser posterior ao início da reserva.”; zero POST de gravação após confirmar; nenhum registro criado. |
| Término anterior ao início: 14:00 → 13:00 | PASS. Mesma recusa; zero POST de gravação; nenhum registro criado. |
| Criar reserva fictícia | PASS. Sala Xangai, 15/01/2030, 09:00–10:00; confirmação e card na agenda. |
| Reabrir em outro contexto autenticado | PASS. Mesma reserva, sala e horário recuperados do servidor. |
| Editar dia, sala e horário | PASS. Alteração para Sala Los Angeles, 16/01/2030, 11:00–12:00; confirmação e card atualizado. |
| Nova releitura independente da edição | PASS. Outro contexto recuperou os valores editados na data correta. |
| Tentar sobreposição na mesma sala/data: 11:30–12:30 | PASS. “Horário já ocupado!”; segunda reserva não aparece e o motivo digitado permanece no formulário. |
| Concluir/liberar pela UI | **LIMITADO: sem opção disponível.** O modal oferece Salvar Alterações e Excluir Registro; a busca por botões Concluir/Liberar no módulo retornou zero. Nenhuma função foi chamada fora da UI. |
| Cancelar a própria reserva de teste | PASS. Excluir Registro, confirmação normal do navegador e mensagem “Reserva Removida!”. |
| Confirmar limpeza em outro contexto | PASS. A reserva própria está ausente em 15/01 e 16/01/2030; a tentativa sobreposta também não aparece. |

## Evidências

[Resultado estruturado sanitizado](homologacao-reservas-20261026/result.json). O JSON contém somente dados fictícios, status dos cenários, datas, salas e referências das telas; não contém credenciais, sessão ou nomes de usuários.

As cinco imagens sanitizadas permanecem privadas, com permissão `0600`, fora do Git em `/tmp/alpha-salvamento-stage-20261026/reservas-ui/`: intervalo inválido, confirmação da criação, confirmação da edição, formulário preservado após sobreposição e mensagem de término anterior. Os dados do responsável foram mascarados; as sobreposições externas ao módulo foram ocultadas somente durante a captura visual. As telas de criação, edição e preservação do formulário foram inspecionadas.

A homologação terminou com a reserva fictícia cancelada e releitura independente sem registros próprios visíveis nas datas usadas. A ausência de opção Concluir/Liberar é um limite da UI observada; a cobertura automatizada dessa action é registrada separadamente pela QA e não substitui a execução visual deste fluxo.
