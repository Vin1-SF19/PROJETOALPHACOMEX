# Vault — cadastro, parceiro e tarifário no staging, 23/10/2026

**Plano pronto para aprovação específica. Nenhuma mutação executada. Novo backup completo do staging atual em andamento; aplicar somente depois de verificação PASS e consentimento real do usuário. Produção não faz parte desta alteração.**

## Ambiente e objetivo

Banco exclusivo de staging, fingerprint **7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b**, conferido diretamente no arquivo `.env.staging.local` deste worktree. Nenhuma leitura de credenciais ou dados de produção.

Pipeline **Revisão de Radar** (`cmuih48la000009gmzw3wwuzf`), etapa **Em tratativa** (`draft-stage-22afe145-6639-4299-bf9a-68343ce622f9`), formulário `cmullknfk0000dpih2g6n19p9`, seção **Dados para o Financeiro** (`cmulqa40c002ymaih7agakscg`). Préestado lido às 17:43 UTC: pipeline **configVersion34**, formulário **versão3**, 18 campos/configurações na seção e 777 cards no pipeline. Não executar o script legado que espera versões31/2.

O objetivo é mostrar **“Fechado no tarifário padrão?”** antes de **Condição negociada**, com **Sim**, **Não** e estado vazio **Não informado…**. Condição negociada aparece somente para **Não**; Sim e ausência ocultam sem apagar valores existentes. Não haverá resposta inferida por preço, contrato, histórico ou outro campo.

## Catálogo real e reutilização

O campo já existe: **`alpha.radar.fechado.tarifario_padrao`**, ID **`cmvgxpbua0000adihcvdu8vs3`**. É `selecao`, escopo `CARD`, opcional, editável, sem fonte automática e com **valorPadrao=NULL**. Opções já existentes e ativas: chave `sim`/rótulo **Sim** e chave `nao`/rótulo **Não**. Atualmente aparece em **Contrato fechado**, e não tem valores gravados no staging.

**Não criar campo ou opção, não alterar tipo para booleano, não renomear o campo global e não converter valores.** O ponto de interrogação entra apenas no `label` do componente novo em Em tratativa. A opção **Não informado…** é o estado vazio do seletor, não uma terceira opção persistida ou um valor padrão literal.

A Condição negociada exibida nesta etapa usa o campo **`alpha.radar.contrato.condicao_negociada`**, ID **`cmulqa2j2002jmaih67xdqg9t`**. Seu componente tem chave antiga `origem:alpha.condicao.negociada`, mas isso **não** o torna o campo Financeiro genérico de mesmo nome. Componente real **`cmulqa5dq003bmaihv8b636je`**, ordem12; configuração real **`cmulqa2n0002kmaih3mtu0ycb`**, ordem112.

O campo genérico **`alpha.condicao.negociada`**, ID `cmulq9vnx000imaihx6fdx3vw`, pertence ao Financeiro e tem três valores antigos: permanecerá intocado. A variante Radar não tem valores atuais; nenhum valor de qualquer variante será apagado ou migrado.

## Mudança exata: 18 statements de metadata, sem DDL

| Operação | Statements | Efeito |
| --- | ---: | --- |
| CAS da versão do pipeline | 1 | 34→35, somente se a versão ainda for34 |
| CAS da versão do formulário | 1 | 3→4, somente se a versão ainda for3 |
| Deslocar componentes atuais de ordem12–17 | 6 | Passam a13–18, mantendo sua ordem relativa |
| Deslocar configurações atuais de ordem112–117 | 6 | Passam a113–118, mantendo sua ordem relativa |
| Inserir componente do tarifário existente | 1 | Mesma seção, ordem12, label com pergunta |
| Inserir configuração do tarifário nessa etapa | 1 | Ordem112, opcional, editável, defaultNULL |
| Condicionar somente a configuração Radar real | 1 | Visível quando tarifário for exatamente Não |
| Registrar auditoria administrativa | 1 | Antes/depois, autor real e horário |
| **Total** | **18** | Uma transação, rollback se qualquer CAS divergir |

Não há CREATE/ALTER/DROP de tabelas/colunas/índices, mudanças de catálogo, opções, campos cadastrais, pipeline Financeiro, etapa Contrato fechado, cards ou valores dos cards. As duas rows novas são apenas **componente** e **configuração de etapa**.

Condição JSON exata, no formato já suportado pelo motor:

```json
{
  "operador": "AND",
  "condicoes": [
    {
      "tipo": "condicao",
      "campo": {
        "fonte": "campo_dinamico",
        "campo": "cmvgxpbua0000adihcvdu8vs3"
      },
      "operador": "igual",
      "valor": "Não"
    }
  ]
}
```

A configuração continua opcional; não criar obrigação de entrada ou saída. A ausência não será tratada como Não.

## Artefatos exatos para revisão

Todos os arquivos privados estão em diretório700, arquivos600, fora do Git e sem dados de clientes:

- [SQL forward revisável](/home/ialpha/.cache/painel-alpha/ajustes-cadastro-parceiro-tarifario-20261023/vault/tarifario-tratativa-forward.review.sql), SHA **30970fe30541824dff23cb96f7af9345df9be5e155ea10328bd2dcee46fff8aa**.
- [Plano e beforeJSON](/home/ialpha/.cache/painel-alpha/ajustes-cadastro-parceiro-tarifario-20261023/vault/tarifario-tratativa-plan.private.json), SHA de plano **3acff8beae6efd4cd436184dd3392dfc8ea010f3b9b43bb741ad9ca9466e48e4**.
- Fingerprint da metadata/preestado: **825fbe6035cc6ad764dab285491435b4ebde2938986eac3f27ec94f83a31a8d9**.
- [Inventário read-only](/home/ialpha/.cache/painel-alpha/ajustes-cadastro-parceiro-tarifario-20261023/vault/staging-inventory.private.json).
- [Mapeamento cadastral, somente IDs/chaves/fontes](/home/ialpha/.cache/painel-alpha/ajustes-cadastro-parceiro-tarifario-20261023/vault/cadastral-alias-mapping.private.json).

O SQL é artefato de revisão: deve ser executado por rotina guardada, que valide fingerprint/schema/beforeJSON/opções/versões, administrador ativo do contexto real e exatamente uma row afetada em cada statement. Não executar o arquivo cru sem esses checks. `:agora` é um único timestamp UTC; `:auditor_id` é o ator real validado; snapshots da auditoria contêm apenas metadata.

## Backup atual — preparação em andamento

O snapshot antigo do staging foi revalidado por hash/restauração/integridade e contagem de cada tabela, mas antecede o Checklist atual:337tabelas no snapshot contra342atuais. Essa limitação foi considerada material e **ele não será usado como backup deste apply**.

Está sendo criado **novo backup completo exclusivamente do staging atual**, em `database-backups/pre-change/cadastro-parceiro-tarifario-staging-20261023/` deste worktree. A exportação HTTP read-only foi interrompida por timeout de sessão e os arquivos `.partial` não contam como backup. O método em andamento usa **réplica nova e snapshot local consistente via SQLite online backup**, já validado anteriormente; nenhuma escrita no banco fonte.

**A aplicação permanecerá bloqueada até obter backup completo atual, com hash/tamanho, restauração isolada, integridade/FKs e contagem fiel de todas as342tabelas.** O caminho, SHA, timestamp e prova serão acrescentados aqui quando terminarem. Nenhum snapshot ou dado de produção será copiado.

## Fontes cadastrais e parceiro — diagnóstico para o código

Os campos CNPJ/razão social/município/UF/regime da variante Radar são GLOBAL→CLIENTE; e-mail é GLOBAL→CONTATO. Todos estão editáveis, `somenteLeitura=false` no catálogo e na etapa.

Os cinco aliases abaixo são **CARD sem fonteEntidade/fonteAtributo**, também editáveis e não somente leitura. A projeção precisa reconhecê-los explicitamente no código; este plano não os transformará em campos globais nem fará backfill:

| Chave | ID | Caminho cadastral |
| --- | --- | --- |
| `alpha.radar.contrato.rua` | `cmulq9z5e001jmaihqwfuxobi` | `perfilCadastralJson.cadastro.empresa.endereco.logradouro` |
| `alpha.radar.contrato.numero` | `cmulq9zgt001mmaihwleofdjg` | `perfilCadastralJson.cadastro.empresa.endereco.numero` |
| `alpha.radar.contrato.complemento` | `cmulq9zs8001pmaih3mw1xn49` | Complemento ainda ausente do contrato atual; extensão de código opcional/nullable, preservando perfis antigos. |
| `alpha.radar.contrato.bairro` | `cmulqa03n001smaihdqc2a5ks` | `perfilCadastralJson.cadastro.empresa.endereco.bairro` |
| `alpha.radar.contrato.cep` | `cmulqa0f2001vmaih2vsvmrtz` | `perfilCadastralJson.cadastro.empresa.endereco.cep` |

O perfil usa envelope `{versao:1,cadastro:...}`. Complemento não consta do contrato atual: a extensão deve ser opcional/nullable e compatível com perfis antigos, sem migration física. Nenhum endereço real foi lido ou incluído nestes artefatos.

A linha automática do formulário Radar é **`alpha.radar.contrato.parceiro_responsavel`**, ID `cmulqa3p2002vmaiht4e5q0pf`, GLOBAL→PARCEIRO.nome, editável/readonlyfalse. O campo genérico **`alpha.parceiro.responsavel`**, ID `cmulq9w6u000omaihxbr9vmvc`, é CARD manual sem fonte e não deve ser confundido com essa projeção automática. A retirada visual da linha e a correção do seletor são mudanças de código; este plano não remove campos, vínculos ou dados de parceiro.

## Impactos, riscos e validação

Risco baixo de perda de dados por ser configuração aditiva e pequena, mas versões/ordens incorretas poderiam afetar o formulário: por isso há CAS, beforeJSON, identidades fixas e auditoria. A transação pode reter bloqueio de escrita por breve período; não se promete indisponibilidade zero. Os seis campos seguintes apenas mudam uma posição, preservando valores, IDs, opções e ordem relativa.

Antes do apply: comprovar backup novo PASS, consentimento específico, fingerprint de staging, schema/beforeJSON idênticos, pipeline34/form3, duas novas rows ausentes e opções Sim/Não intactas. Qualquer drift interrompe a operação, sem sobrescrever configuração de outro fluxo.

Antes do commit: confirmar18statements com uma row afetada cada, pipeline35/form4, tarifário ordem12/112 antes da Condição ordem13/113, regra JSON exata e nenhuma obrigação nova; catálogo149/opções existentes, cards777, valores/históricos/perfis/vínculos preservados e FK0. Confirmar novamente por nova conexão. Os checks de contagem devem usar snapshot consistente no início da transação e não confundir atividade legítima posterior com escrita do executor.

## Alternativa e rollback

Alternativa sem mutação de configuração: manter o formulário atual e adiar a associação do tarifário/condição declarativa, prosseguindo apenas com correções de código independentes já revisadas. Não inventar outro campo para contornar o catálogo existente.

Rollback preferido é **cirúrgico e versionado**, usando o beforeJSON: remover somente as duas rows novas se o afterJSON ainda corresponder, restaurar ordens/configuração de visibilidade originais, **incrementar novamente** as versões com CAS (não voltar o contador para34/3) e registrar nova auditoria. Manter campo tarifário/opções e todo valor de card, inclusive respostas feitas depois da publicação. Não apagar condição antiga, perfil cadastral, parceiro ou histórico. Se houver edição concorrente, parar e revisar. A reversão remota também exige autorização específica; não é automática.

Nunca restaurar integralmente o snapshot legado para esse ajuste. Restauração integral do backup atual seria último recurso, com plano, backup do estado corrente, janela e consentimento próprios, pois poderia descartar escritas posteriores.

A confirmação específica será solicitada pelo agente principal **quando a entrega de código e este plano forem revisáveis**. A regra vem de [AGENTS.md](../../AGENTS.md), seção Database Safety and Backup Policy: “Sempre solicite confirmacao explicita do usuario antes da alteracao. Silencio, contexto anterior ou aprovacao generica nao contam como consentimento.” O Vault não solicitou nem presumiu consentimento nesta preparação.
