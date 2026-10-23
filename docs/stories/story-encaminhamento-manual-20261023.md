# Story: CRM — encaminhamento manual por pipeline e etapa

## Status e responsáveis

Ready for Review — autoria `@sm`; implementação `@dev`, validação `@qa`, publicação `@devops`, staging primeiro. Base informada: produção validada `f51…`, a conferir no candidato isolado. Sem alteração do repositório original dirty.

## Story

Como Admin, TI ou líder de setor autorizado, quero um botão bem visível em **Encaminhamentos**, disponível em todas as etapas do card, para escolher pipeline/etapa de destino e, ao trocar de pipeline, seu responsável.

## Acceptance Criteria

1. Botão destacado na área **Encaminhamentos** em todas as etapas, para Admin, TI e líderes de setor com autoridade real sobre a origem, conforme contratos existentes. Visibilidade não depende apenas do nome de perfil enviado pelo navegador. Demais usuários não ganham acesso; servidor exige sessão/autoridade e escopo do card também em chamada direta.
2. Modal seleciona pipeline e, em seguida, etapa pertencente ao pipeline escolhido. Trocar pipeline limpa etapa incompatível. Listas respeitam acesso vigente e destinos ativos; não aceitar combinação arbitrária, pipeline/etapa inativos ou destino de outro escopo por payload adulterado.
3. Se destino permanece no mesmo pipeline, mover o card atual para a etapa escolhida preservando responsável e identidade. Não criar card duplicado nem exigir troca de responsável nessa operação. Reutilizar o comando canônico e as regras efetivas aplicáveis à autoridade, sem inventar bypass global de transições/validações.
4. Se mudar pipeline, exigir escolha de responsável elegível ao destino. Revalidar no servidor pipeline, etapa, elegibilidade do responsável, permissão da origem/destino e contexto atual antes de confirmar e dentro da transação. Mudança concorrente de configuração/acesso gera erro acionável, sem escrita parcial.
5. Encaminhamento entre pipelines usa o mecanismo existente de criação de card vinculado e preservação da origem, com dados/estado/visibilidade previstos por esse contrato. Não reescrever pipeline do card original nem inventar nova regra de arquivamento. Diagnosticar os comandos/vínculos atuais antes de implementar; não introduzir migration por conveniência.
6. Confirmação mostra origem, destino e responsável quando aplicável; cancelar não grava. Operação usa CAS/versão e idempotência do domínio: duplo clique, retry ou concorrência não duplicam card/vínculo, movimento ou efeitos. Conflito exige recarga/revisão, sem sobrescrever edição humana ou silenciosamente mudar o destino escolhido.
7. Registrar auditoria com ator real, data/hora, origem/destino e responsável, preservando atomicidade dos registros e efeitos de domínio. Interface confirma sucesso somente após commit; falha conserva contexto do modal e não deixa vínculo/card parcial. Atualizar quadro/detalhe depois do sucesso.
8. Não alterar o encaminhamento automático recém-corrigido nem sua elegibilidade, permissões ou idempotência. Validar regressão das automações, criação vinculada existente e outras etapas, além do fluxo manual solicitado.
9. Testes cobrem autoridade real Admin/TI/líder e usuário sem acesso, todas as etapas, seleção dependente, destino ativo, responsável elegível/inválido, movimento no mesmo pipeline, encaminhamento vinculado, cancelamento sem escrita, CAS/retry/concorrência e auditoria. Executar gates do projeto e validar primeiro em staging; promoção de produção segue autorização efetiva posterior ao resultado concreto.

## Tasks

- [x] Diagnosticar autoridade de origem, comandos de movimento/encaminhamento, vínculos e regras de destino existentes.
- [x] Implementar botão/modal e validação de seleção/responsável, sem alterar automação.
- [x] Integrar comandos canônicos, CAS/idempotência, transação e auditoria.
- [x] Executar os quatro gates locais da feature e da união; QA remoto de staging permanece pendente.
- [ ] Registrar entrega, evidências e File List; preservar arquivos dirty alheios.

## Implementação e evidências

- Autoridade canônica na origem: Admin/TI e liderança do setor, verificados no banco; catálogo exclusivo para envio com metadados ativos, sem contagens nem acesso de leitura aos cards de outros setores.
- Mesmo pipeline delega ao comando canônico de transição. Outro pipeline cria card vinculado já atribuído ao responsável escolhido, preserva a origem, registra histórico e evento USER; sem regra ou execução fictícia de automação e sem fila de assunção pendente.
- Responsável ativo/elegível no pipeline e na etapa, inclusive restrições de Boas-vindas; CAS, hash da intenção sem tokens CAS e envelope imutável no retry protegem repetição e resposta perdida. Destino previamente vinculado é preservado com conflito explícito.
- Suíte completa: 753 arquivos e 6.251 testes PASS, quatro ignorados e um todo; lint zero erros/1.183 avisos legados; build padrão com 86 páginas e typecheck sequencial exit 0. Focais SQLite/DOM: 37 PASS.
- QA local final PASS para os nove arquivos; staging remoto e validação da união concorrente permanecem pendentes. Nenhuma publicação ou escrita em produção autorizada/executada nesta feature.
- Evidências privadas: `/home/ialpha/.cache/painel-alpha/encaminhamento-manual-20261023/`. Fixtures de UI e banco são sintéticas e isoladas; nenhum dado real foi copiado entre ambientes.

## File List

- `docs/stories/story-encaminhamento-manual-20261023.md`
- `src/actions/bpm/EncaminhamentoManual.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/EncaminhamentoManualDialog.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelEncaminhamentos.tsx`
- `src/lib/bpm/encaminhamento-manual-server.ts`
- `src/lib/bpm/encaminhamento-manual.ts`
- `tests/bpm/encaminhamento-manual-react.test.ts`
- `tests/bpm/encaminhamento-manual-sqlite.test.ts`
- `tests/bpm/encaminhamentos-painel-react.test.ts`


## Integração com o staging concorrente

- Feature isolada no checkpoint `1b88e3af`; união normal `dce3178e` preservou integralmente os 42 arquivos de `de46e48a` (filtro de origem/busca e tema do CRM) e os nove arquivos da feature. Não houve force push, alteração de schema, dependências ou configuração.
- Build real da união: 86 páginas, exit 0; lint zero erros/1.184 avisos legados; typecheck sequencial aprovado. Suíte completa final da união: 755 arquivos e 6.271 testes PASS, quatro ignorados e um todo; exit 0, registrada em `union-tests-final.log`.
- A integração revelou uma asserção antiga que exigia `colorScheme=dark` fixo no teste de indicação/parceiro. O tema concorrente usa variável CSS com fallback escuro e opção clara. Foi removida somente essa asserção de apresentação obsoleta e ajustado o nome do teste; todas as verificações de seleção e payload do parceiro foram preservadas. Nenhum código do tema foi revertido.
- Prévia da união com componentes e CSS reais, APIs fictícias: desktop/mobile nos temas claro e escuro, sem overflow horizontal ou erros de execução. Não representa login ou envio em ambiente remoto.
- Arquivo adicional de compatibilidade de teste: `tests/bpm/novo-card-modal-react.test.ts`.

- QA local integrado PASS ratificado para a união e os quatro gates finais; publicação e smoke remoto somente staging permanecem pendentes. Produção não autorizada nesta entrega.
