# INTEGRATION POINTS — Pontos de Integração

## Padrão reutilizável: Vídeo Introdutório por módulo (estreado em Parceiros, 2026-07-14)

Como plugar em um módulo novo (ver `decisions.md` para o design completo):

1. No Server Component da página do módulo, buscar `obterVideoIntrodutorioConfig("id-do-modulo")` (mesmo `Promise.all` das outras queries da página) — `id-do-modulo` deve bater com o `id` em `MODULOS_REGISTRY`.
2. Passar a config como prop para o Client Component do módulo.
3. Renderizar `<BotaoVideoIntrodutorio modulo="id-do-modulo" isAdmin={...} />` no header/topo da tela (`src/components/VideoIntrodutorio/`).
4. Nenhuma migration nova é necessária — o model `VideoIntrodutorioConfig` já é genérico (`modulo: String @unique`), só precisa de 1 linha nova quando o Admin ativar pela primeira vez naquele módulo.
5. Se o módulo tiver regra de permissão diferente de "Admin/CEO" (padrão `isAdminRole()`), avaliar se `ativarVideoIntrodutorio` precisa de parâmetro de autorização customizado antes de reutilizar.

## Checkpoint obrigatório: mudança estrutural na tabela `clientes`

Antes de finalizar qualquer migration que renomeie, recrie, ou mude índice/constraint da tabela `clientes` (model CS&NPS), verificar OBRIGATORIAMENTE (ver `architecture.md` e `decisions.md` 2026-07-13):

- [ ] `PRAGMA foreign_key_list` rodado em TODAS as tabelas do banco, não só nas do módulo em foco
- [ ] `socios`, `log_cs`, `logFeedback`, `historico_alteracao_cliente` (CS&NPS) — FK íntegra para `clientes`
- [ ] `indicacoes` (Parceiros) — FK íntegra, teste manual de "criar nova indicação" funcionando
- [ ] `crm_oportunidades`, `crm_contatos` (CRM) — FK íntegra
- [ ] Fluxo de sincronização Metas→CS&NPS (`criarRegistroClienteAPartirDeContrato`, chamado em `confirmarFechamento`) testado ponta a ponta após a migration
- [ ] Vault não aprova a migration sem essa checklist cumprida

> Mantido por: Scribe (cartógrafo) e Probe (integration tester)
> Todo novo módulo DEVE registrar seus integration points aqui.

---

## Checklist de integração para novos módulos

Ao criar um novo módulo, verificar e registrar:

- [ ] Aparece no menu/sidebar?
- [ ] Tem atalho de teclado?
- [ ] Está na lista de permissões/roles?
- [ ] Rota está protegida no middleware?
- [ ] Link de navegação funciona?

---

## Módulos e seus integration points

<!-- Adicionar aqui conforme o projeto cresce -->

### [Nome do Módulo]
- **Rota:** `/caminho`
- **Menu:** [onde aparece]
- **Permissão necessária:** [role/flag]
- **Atalho:** [tecla, se existir]
- **Adicionado em:** [data]

---

## Integration Points por Feature

---

### Gestão de Comissões e Prêmios (2026-07-28)

- **Rota:** `/PainelAlpha/Comissoes` (+ `/Simulador`, `/Divergencias`, `/Configuracoes`)
- **Registry:** entrada `comissoes` em `src/lib/modulos-registry.ts` (`iconName: 'HandCoins'`, `category: 'financeiro'`, `allowedRoles: ['Admin', 'CEO', 'FINANCEIRO']`)
- **Ícone:** `HandCoins` importado em `ICON_MAP` de `src/components/layout/GlobalSidebar.tsx` (sidebar renderiza a partir do registry, não de lista separada)
- **Permissão necessária:** `getPermissoesEfetivas(userId).includes('comissoes')`, com bypass para Admin/CEO — checado em TODAS as 4 páginas do módulo, mesmo padrão idêntico
- **RBAC granular por ação:** NÃO implementado — é módulo-inteiro; TODO documentado em texto nos 12 arquivos de Server Actions (`ROLES_TEMPORARIAMENTE_PERMITIDOS`)
- **Integração com outros módulos (via `sync-engine.ts` + `adapters/`):** CS&NPS (`clientes` — fonte de êxito via `dataExito`, merge de contratação), Metas (`ContratoComercial` — merge de contratação), Colaboradores (`ContratoColaborador`/`CargoColaborador` — resolução de vínculo CLT/PJ na data do evento)
- **Adicionado em:** 2026-07-28

---

### Alpha CheckList — edição, pastas e exportação de documentos

**Atualizado em:** 2026-07-14 por Scribe.

**Rotas:** a listagem e o detalhe existentes permanecem em
`/PainelAlpha/CheckList` e `/PainelAlpha/CheckList/[empresaId]`; o download usa
`GET /api/checklist/[empresaId]/documentos/zip`.

**Menu e permissão:** não há nova entrada de menu nem nova permissão. O módulo
continua registrado como `checkList` em `src/lib/modulos-registry.ts`.

**Dados:** `OperacionalClientes.pastaChecklistId` aponta opcionalmente para
`PastaChecklist`; mudanças de embasamento preservam o checklist anterior para não
perder documentos e ativam/criam o checklist do novo tipo.

**Segurança do ZIP:** manter autenticação, limitar a documentos não excluídos e
validar URL HTTPS, nome de arquivo e tamanho antes de buscar conteúdo remoto.

**Modelos de embasamento:** o botão da listagem abre
`/PainelAlpha/CheckList/Embasamentos`; as subrotas
`/PainelAlpha/CheckList/Embasamentos/[tipo]` devem validar o tipo e manter a
mesma autenticação do módulo. Novos checklists sempre consultam
`ModeloItemChecklist` (específico + global), não uma lista fixa de itens no código.

---

### Template de Onboarding — Campo `tipo`

**Adicionado em:** 2026-06-18 por Scribe (sessão Bibble). **Estendido em:** 2026-07-06 (tipo CONVITE).

**Descrição:** Discriminador de destino dos templates de onboarding. Permite que o admin crie templates específicos por audiência (colaborador, parceiro, cliente futuro, convite de parceiro) e que o sistema exiba o template correto em cada fluxo.

**Valores válidos:** `USUARIO | PARCEIRO | CLIENTE | CONVITE`

**⚠️ Armadilha já sofrida (2026-07-06):** o campo `tipo` foi adicionado ao `schema.prisma` em 2026-06-18, mas a migration NUNCA foi aplicada de fato no Turso de produção — só existia no schema, gerando `The column tipo does not exist` em toda tentativa de criar template. Corrigido via `ALTER TABLE onboarding_template ADD COLUMN tipo TEXT DEFAULT 'USUARIO'` direto no Turso. **Toda vez que uma coluna nova for adicionada ao schema, CONFIRME com `PRAGMA table_info` no Turso real — não confie que "está no schema.prisma" significa "está em produção"** (ver `decisions.md` sobre `prisma db push` não alcançar o Turso).

**Schema:**
```prisma
// prisma/schema.prisma — model OnboardingTemplate
tipo String @default("USUARIO")  // USUARIO | PARCEIRO | CLIENTE
```

**Como adicionar um novo tipo no futuro:**
1. Adicionar o valor em `z.enum([...])` na validação das actions (quando implementado)
2. Criar a lógica de busca equivalente a `getTemplateParadaoParceiro` em `src/actions/onboarding.ts`
3. Adicionar badge visual no card de listagem em `GestaoOnboardingClient.tsx`
4. Conectar no Server Component da rota que exibirá o template

**Arquivos que precisam ser tocados ao adicionar novo tipo:**

| Arquivo | O que mudar |
|---------|-------------|
| `src/actions/onboarding.ts` | Nova action `getTemplatePadrao[Tipo]()` |
| `src/components/GestaoOnboarding/GestaoOnboardingClient.tsx` | Badge visual + opção no Select |
| `src/app/PainelAlpha/[Rota]/page.tsx` | Buscar template + passar como prop |

---

### Template de Parceiro — Integração com ModalCredenciais

**Adicionado em:** 2026-06-18 por Scribe (sessão Bibble)

**Descrição:** Ao cadastrar um novo parceiro, o `ModalCredenciais` exibe a mensagem de boas-vindas do template de onboarding do tipo `PARCEIRO` padrão. Se não houver template PARCEIRO ativo, o modal exibe mensagem genérica (comportamento já tratado no componente).

**Arquivos envolvidos:**

**`src/actions/onboarding.ts`**
Action: `getTemplateParadaoParceiro()`
```typescript
// Busca template ativo do tipo PARCEIRO (preferência para marcado como padrão)
export async function getTemplateParadaoParceiro(): Promise<OnboardingTemplate | null> {
  const template = await onboardingTemplateModel.findFirst({
    where: { ativo: true, tipo: "PARCEIRO" },
    orderBy: [{ padrao: "desc" }, { createdAt: "desc" }],
  });
  return template ?? null;
}
```

**`src/app/PainelAlpha/Parceiros/novo/page.tsx`** — Server Component
```typescript
// Busca template de parceiro em paralelo com dados do usuário
import { getTemplateParadaoParceiro } from "@/actions/onboarding";

const [rec, template] = await Promise.all([
  db.usuarios.findUnique({ where: { id: userId }, select: { tema_interface: true } }),
  getTemplateParadaoParceiro(),
]);
// Passa template para NovoParceiro como prop
<NovoParceiro template={template} temaName={temaName} />
```

**`src/components/Parceiros/NovoParceiro.tsx`** — já aceita `template?: OnboardingTemplate | null`
**`src/components/Parceiros/ModalCredenciais.tsx`** — já substitui `[LOGIN]` e `[SENHA]` da mensagem do template

**Fluxo completo:**
```
Admin cria template tipo=PARCEIRO em /GestaoOnboarding
  → getTemplateParadaoParceiro() busca { ativo:true, tipo:"PARCEIRO" }, padrao desc
  → page.tsx de /Parceiros/novo passa como prop
  → NovoParceiro → ModalCredenciais exibe a mensagem com [LOGIN]/[SENHA] substituídos
```

---

### Template de Convite — Integração com ModalMensagemConvite

**Adicionado em:** 2026-07-06 por Scribe (sessão Bibble)

**Descrição:** Ao gerar um link de convite de parceiro (`ModalConvidarParceiro.tsx`, dentro de `/PainelAlpha/Parceiros`), um novo modal `ModalMensagemConvite.tsx` exibe a mensagem de boas-vindas do template tipo `CONVITE` padrão, com `[LINK]` e `[PIN]` já substituídos — pronta para copiar e enviar ao futuro parceiro. Se não houver template CONVITE ativo, usa mensagem de fallback hardcoded (mesmo padrão do `ModalCredenciais`).

**Placeholders deste tipo:** `[LINK]` (URL completa do convite) e `[PIN]` (4 dígitos) — NÃO usa `[LOGIN]`/`[SENHA]`/`[NOME]` (ainda não existe parceiro cadastrado neste momento do fluxo).

**Arquivos envolvidos:**
- `src/lib/onboarding-placeholders.ts` — helper **compartilhado** `substituirPlaceholders(mensagem, valores)`, extraído da função que antes vivia só dentro de `ModalCredenciais.tsx`. Genérico: aceita qualquer `Record<string,string>`, usado tanto para `{LOGIN,SENHA}` quanto `{LINK,PIN}`.
- `src/actions/onboarding.ts` — `getTemplateParadaoConvite()`, espelho exato de `getTemplateParadaoParceiro()` trocando o filtro para `tipo: "CONVITE"`.
- `src/app/PainelAlpha/Parceiros/page.tsx` — busca `getTemplateParadaoConvite()` em paralelo, passa como prop `templateConvite` para `ParceirosClient`.
- `src/components/Parceiros/ModalMensagemConvite.tsx` (novo) — recebe `{ open, onClose, link, pin, template }`, monta a mensagem final e exibe com botão de copiar.

**Fluxo completo:**
```
Admin cria template tipo=CONVITE em /GestaoOnboarding (placeholders sugeridos: [LINK] [PIN])
  → page.tsx de /PainelAlpha/Parceiros busca getTemplateParadaoConvite() em paralelo
  → passa como prop templateConvite até ParceirosClient
  → Admin clica "Convidar parceiro" → ModalConvidarParceiro gera o link+pin
  → ModalConvidarParceiro chama onConviteGerado({ link, pin }) — NÃO renderiza o modal de mensagem ele mesmo
  → ParceirosClient guarda em estado (mensagemConvite) e monta <ModalMensagemConvite /> como irmão independente
  → ModalMensagemConvite substitui [LINK]/[PIN] e exibe a mensagem pronta pra copiar
```

**⚠️ Padrão a NUNCA repetir (bug real desta sessão):** a primeira versão tentou renderizar `ModalMensagemConvite` (que usa `Dialog` do Radix, com hooks internos) **condicionalmente dentro do próprio `ModalConvidarParceiro`**, que tem um early-return `if (!open) return X`. Isso causou `Rendered more hooks than during the previous render` — dois caminhos de render com quantidade de hooks/estrutura de árvore diferente dentro do mesmo componente. **Regra geral: nunca monte um modal filho com Dialog/hooks próprios dentro de um componente que tem early-return condicional baseado em prop — sempre eleve o estado do modal filho para o componente pai** (callback tipo `onConviteGerado`, e o pai decide se/quando montar o filho).

**Editado quando:** Novo tipo de parceiro precisar de template customizado.

**Última atualização:** 2026-06-18 por Scribe

---

### Wizard de Convite de Parceiro — multi-tela (7 telas)

**Adicionado em:** 2026-07-06 por Scribe (sessão Bibble)

**Descrição:** O convite público de parceiro (`/convite/parceiro/[token]`) era um form single-page (`FormConviteParceiro.tsx`, deletado) e virou um wizard de 7 telas, no mesmo espírito do onboarding multi-step do portal AlphaParceiros.

**Fluxo completo (geração → PIN → preenchimento com busca automática → aprovação):**
```
1. Admin/equipe abre ModalConvidarParceiro.tsx (dentro de /PainelAlpha/Parceiros)
   → gerarConvite({ validadeDias }) cria ConviteParceiro (token randomUUID, PIN de 4 dígitos, status PENDENTE)
   → link copiado automaticamente; PIN exibido na tela (só neste momento — listarConvites NUNCA retorna o pin)
   → quem convida repassa link + PIN manualmente ao convidado (WhatsApp, e-mail etc)

2. Convidado abre o link → src/app/convite/parceiro/[token]/page.tsx (Server Component)
   → validarConvitePublico(token) checa status/expiração, busca ParceiroTermo ativo
   → se inválido: <ConviteInvalido motivo={...} /> (NAO_ENCONTRADO|EXPIRADO|USADO|REVOGADO)
   → se válido: <ConviteWizard token={token} termo={resultado.termo} />

3. ConviteWizard.tsx (src/components/Parceiros/Convite/) orquestra o wizard via 1 useState:
   Step -1 StepPin — pede os 4 dígitos do PIN (só valida FORMATO aqui; a validação real
            do PIN acontece no backend, na primeira consulta de CPF tentada no Step 1)
   Step 0  Apresentação (texto institucional + e-mail — SEM campo de senha, removido)
   Step 1  StepDadosPessoais — CPF + lupa (busca CPF+dataNascimento via InfoSimples,
           rota pública protegida pelo PIN), Data de Nascimento, Nome, Telefone, WhatsApp
   Step 2  StepEndereco (CEP com busca ViaCEP, endereço opcional mas completo-ou-nada)
   Step 3  StepAreaAtuacao (multi-select de 8 áreas fixas)
   Step 4  StepEmpresa — CNPJ + lupa (busca via ReceitaFederal, JÁ pública, sem custo,
           SEM precisar de PIN), Razão Social, Nome Fantasia, campo "sobre"
   Step 5  StepTermos (só aparece se houver ParceiroTermo ativo; senão pula direto pro submit)
   Step 6  StepSucesso
   → submissão final chama submeterConvitePublico(...) (convites-parceiro.ts)

4. submeterConvitePublico cria PreCadastroParceiro (status PENDENTE) + marca convite USADO
   — grava inclusive os payloads BRUTOS das duas consultas (dadosConsultaCpf/dadosConsultaCnpj),
   mesmo os campos que não aparecem na tela, para não precisar reconsultar na aprovação

5. Admin abre ModalPreCadastros.tsx (lista PENDENTE, mostra whatsapp + endereço completo +
   razaoSocial/nomeFantasia + dataNascimento)
   → aprovarPreCadastro(id): monta objeto `endereco` só se cep+logradouro+bairro+cidade+uf
     estiverem TODOS presentes → combina dadosConsultaCpf+dadosConsultaCnpj num único JSON
     → chama criarParceiro() repassando telefone2=whatsapp, nome=razaoSocial‖nomeCompleto,
     nomeFantasia=nomeFantasia‖nomeEmpresa(legado), dadosConsulta=combinado, e
     termoAceito/termoAceitoEm/termoVersao (o parceiro nasce com o termo já aceito)
```

**Segurança da rota de consulta de CPF (`/api/convite/consulta-cpf`):** pública (sem `auth()`),
protegida pelo PIN do convite. Valida nesta ordem antes de gastar a chamada paga na InfoSimples:
token existe → status PENDENTE → não expirou → `convite.pin` não é null → pin bate exatamente.
Convites gerados ANTES desta feature (pin=null) são bloqueados explicitamente, não recebem
passe livre. **PENDÊNCIA DE SEGURANÇA CONHECIDA:** não há rate-limit nem contador de tentativas
— ver `decisions.md` (decisão de risco aceito conscientemente pelo usuário).

**Arquivos envolvidos:**
- `prisma/schema.prisma` — `ConviteParceiro.pin` (nullable); `PreCadastroParceiro` +whatsapp/endereço (rodada anterior) +dataNascimento/dadosConsultaCpf/razaoSocial/nomeFantasia/dadosConsultaCnpj (esta rodada)
- `src/actions/convites-parceiro.ts` — `gerarConvite` (gera PIN), `PreCadastroSchema`, `submeterConvitePublico`, `aprovarPreCadastro`, `listarPreCadastros`
- `src/actions/parceiros.ts` — `ParceiroSchema` ganhou `termoAceito`/`termoAceitoEm` (`z.coerce.date()`)/`termoVersao` opcionais
- `src/app/api/convite/consulta-cpf/route.ts` — rota pública nova, espelha `ConsultaCpf/route.ts` mas sem `auth()`, protegida por PIN
- `src/app/api/ReceitaFederal/route.ts` (`getReceitaData`) — reaproveitada AS-IS para a busca de CNPJ (já era pública, sem custo)
- `src/components/Parceiros/Convite/` — `ConviteWizard.tsx`, `StepPin.tsx` (novo), `StepApresentacao.tsx`, `StepDadosPessoais.tsx`, `StepEndereco.tsx`, `StepAreaAtuacao.tsx`, `StepEmpresa.tsx`, `StepTermos.tsx`, `StepSucesso.tsx`, `shared.tsx`
- `src/app/convite/parceiro/[token]/page.tsx` — renderiza `ConviteWizard` no lugar do form antigo
- `src/components/Parceiros/ModalConvidarParceiro.tsx` — exibe o PIN junto ao link ao gerar
- `src/components/Parceiros/ModalPreCadastros.tsx` — exibe whatsapp/endereço/razaoSocial/nomeFantasia/dataNascimento

**Como adicionar uma nova tela ao wizard no futuro:**
1. Criar `Step[Nome].tsx` em `src/components/Parceiros/Convite/`, seguindo a assinatura `{ ...dados, onChange, onBack, onNext }`
2. Adicionar o campo(s) correspondentes em `ConviteFormData`/`CONVITE_FORM_VAZIO` (`shared.tsx`)
3. Adicionar a entrada no array `STEPS_LABEL` do `ConviteWizard.tsx` (controla o stepper visual) e o `{step === N && <StepNovo .../>}`
4. Se o campo precisa persistir, adicionar coluna em `PreCadastroParceiro` (ver decisão sobre migration no Turso em `decisions.md`) + repassar em `submeterConvitePublico`/`aprovarPreCadastro`

**Editado quando:** Nova etapa de coleta de dados no convite público, ou mudança no fluxo de aprovação de pré-cadastro.

**Última atualização:** 2026-07-06 por Scribe

---

### Alpha Presentation Studio (módulo novo — Onda 1 de 6)

**Adicionado em:** 2026-07-09 por Scribe (sessão Bibble)

**Descrição:** Editor de apresentações HTML interativas. Escopo total aprovado pelo usuário é grande (dashboard, editor visual, biblioteca de componentes, animações 2D/3D, motor de IA, export/publicação, colaboração real-time) — construção fatiada em 6 ondas sequenciais, cada uma passando pelo pipeline serial completo (Scout já mapeou o todo; cada onda ainda passa por Vault/Forge/Probe/Anubis/Lens/Sage/Scribe quando aplicável). **Esta entrada documenta a Onda 1** (schema + Dashboard). Roadmap das ondas seguintes vive nas tasks do Bibble (Onda 2: Editor/canvas/componentes básicos; Onda 3: temas/animações/timeline; Onda 4: 3D; Onda 5: IA; Onda 6: apresentação fullscreen/export/publicação/colaboração).

**Checklist de integração (Onda 1):**
- [x] Aparece no menu/sidebar — via `MODULOS_REGISTRY` (fonte única, sem arrays manuais adicionais)
- [x] Ícone resolve (`MonitorPlay` no `ICON_MAP` de `GlobalSidebar.tsx`)
- [x] Permissão administrável pelo Admin — automática via `MODULOS_GERENCIAVEIS` (deriva do registry em `ModalGerenciarSetor.tsx`/`ModalOverrideUser.tsx`, sem lista manual separada — confirmado por Probe nesta sessão, o CLAUDE.md que fala de array manual em `FormCadastro.tsx` está OBSOLETO)
- [x] Rota protegida por permissão de módulo — `Apresentacoes/page.tsx` chama `getPermissoesEfetivas()` e redireciona se `!perms.includes("apresentacoes")` (adicionado depois que Probe identificou a lacuna; ver `decisions.md`/journal para o padrão geral do projeto, onde só ~6 de 30 páginas de módulo fazem esse check explícito — Apresentações agora é uma delas)
- [x] Rota do editor (`/PainelAlpha/Apresentacoes/[id]/editor`) — **existe e funciona** (Onda 2, 2026-07-09). Testada em browser real com credenciais reais (Probe): o bug original reportado pelo usuário ("dá 404 toda vez que vou editar") está confirmadamente resolvido.

**Arquivos envolvidos (Onda 1):**
- `prisma/schema.prisma` — 7 models novos (`Apresentacao`, `Slide`, `ApresentacaoTema`, `ApresentacaoAsset`, `ApresentacaoVersao`, `ApresentacaoColaborador`, `ApresentacaoComentario`) + 3 relations reversas em `usuarios`. Migration real já aplicada no Turso (script Node pontual com `@libsql/client/web`, confirmado via `PRAGMA table_info`, script descartado após uso — padrão já estabelecido no projeto).
- `src/lib/validations/apresentacao.ts` — schemas Zod (`criarApresentacaoSchema`, `atualizarStatusSchema`, `paginacaoApresentacaoSchema`, `dadosSlideVazioSchema`)
- `src/actions/apresentacoes.ts` — `ListarApresentacoes`, `CriarApresentacao`, `DuplicarApresentacao`, `ExcluirApresentacao`, `AtualizarStatusApresentacao`
- `src/lib/modulos-registry.ts` — entrada `{ id: 'apresentacoes', ... category: 'comercial' ... }`
- `src/components/layout/GlobalSidebar.tsx` — import + `ICON_MAP['MonitorPlay']`
- `src/app/PainelAlpha/Apresentacoes/page.tsx` + `src/components/Apresentacoes/Dashboard/{ApresentacoesDashboard,CardApresentacao,ModalNovaApresentacao}.tsx`

**Como adicionar a Onda 2 (Editor) no futuro:**
1. Criar `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx` (fina) — isso sozinho já resolve o 404 esperado hoje
2. Seguir o blueprint de Scout (camadas: Sidebar/Canvas/Painel Direito/Barra Superior/Timeline, `RenderEngine.tsx` como ÚNICA fonte de renderização de `dadosJson`, reutilizada pelo Editor E futuramente pelo Modo Apresentação/Export)
3. `dadosJson` do `Slide` deve ganhar validação Zod `z.discriminatedUnion("tipo", [...])` antes do Editor começar a escrever conteúdo de usuário nele (ainda não implementado — só a Onda 1 criou o slide inicial vazio `{ componentes: [] }`)

**⚠️ Pendência de segurança registrada para a Onda 6:** `Apresentacao.senhaAcesso` existe no schema como texto plano — ao implementar a verificação de senha da apresentação publicada, usar `bcryptjs` (hash + compare), nunca comparação direta. Ver `decisions.md`.

**Editado quando:** Cada nova onda do módulo for concluída — atualizar o checklist acima e adicionar a seção de arquivos da onda correspondente.

---

### Alpha Presentation Studio — Onda 2 (Editor completo)

**Adicionado em:** 2026-07-09 por Scribe (sessão Bibble, mesma sessão da Onda 1)

**Descrição:** Editor de verdade — canvas com posicionamento livre, sidebar de 7 componentes arrastáveis (via `@dnd-kit`, drop na paleta→canvas), painel de propriedades por tipo, barra superior com autosave, lista de slides reordenável (`@dnd-kit` sortable, mesmo padrão do Kanban `PipelineClient.tsx`), timeline placeholder (lista de camadas por zIndex, sem keyframes reais — isso é Onda 3). Motivo desta onda: usuário reportou "toda vez que vou editar a apresentação dá erro 404" — a rota do editor não existia ainda (Onda 1 só tinha o Dashboard). **Testado em browser real com credenciais reais (Probe) — 404 confirmadamente resolvido.**

**Checklist de integração (Onda 2):**
- [x] Rota `/PainelAlpha/Apresentacoes/[id]/editor` existe, carrega sem 404/crash
- [x] Ownership checado na `page.tsx` (autor, colaborador ou Admin/CEO) ANTES de qualquer dado do slide ser passado ao client — confirmado por Anubis
- [x] Regra de negócio "não pode excluir o último slide" — reflete na UI (botão `disabled`, `aria-label`/`title` explicando), não só no backend (`ExcluirSlide` bloqueia com `count(slides) <= 1`)
- [x] Autosave funcional (debounce 1.5s, indicador visual "Salvando.../Salvo" na barra superior) — confirmado no browser real
- [x] Zoom funcional (testado clique real: 100%→125%)
- [ ] Drag-and-drop físico (arrastar componente da paleta pro canvas) — funcionalidade implementada e usa o mesmo padrão já em produção no CRM (`@dnd-kit`), mas **não foi possível confirmar por automação de browser** (limitação de simular `PointerEvent` sintético contra o `@dnd-kit`, não indício de bug). Recomendado teste manual humano antes de considerar 100% validado.
- [ ] Seleção de componente aninhado (filho dentro de Card/Grid) — implementado conforme decisão de UX confirmada (clique seleciona o filho mais profundo direto), mas não testado em browser real por falta de um componente aninhado na apresentação de teste disponível.

**Arquivos envolvidos (Onda 2):**
- `src/lib/validations/slide-componentes.ts` — union discriminada Zod (7 tipos: texto, imagem, botao, card, grid, icone, divisor), `card`/`grid` recursivos via `z.lazy()`. **Atualizado por Sage após o registro inicial de Nova**: `w`/`h` ganharam `.min(1)` (evita componente invisível por tamanho ≤0) e `dadosSlideSchema` ganhou `.refine()` validando IDs únicos em toda a árvore (evita comportamento confuso na store quando 2 nós compartilham `id`).
- `src/actions/slides.ts` — `ListarSlides`, `ObterSlide`, `CriarSlide`, `AtualizarSlide` (valida `dadosJson` com Zod antes de salvar), `ReordenarSlides` (transação atômica), `ExcluirSlide` (bloqueia se for o último), `DuplicarSlide`. Todas usam `checarOwnershipApresentacao()` — helper compartilhado que sobe do `slideId`/`apresentacaoId` até `Apresentacao.autorId`/`colaboradores`, nunca confia no ID do slide isolado.
- `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx` — fina, ownership check antes de qualquer render.
- `src/components/Apresentacoes/Editor/` — árvore completa: `ApresentacaoEditor.tsx` (orquestrador, `DndContext` global + autosave), `SidebarEsquerda/` (paleta + lista de slides), `Canvas/` (área de trabalho + `useCanvasDragResize` — drag/resize livre via mouse events próprios, não `@dnd-kit`), `PainelDireito/` (propriedades por tipo), `BarraSuperior/`, `Timeline/` (placeholder), `RenderEngine/RenderComponente.tsx` (**fonte única de renderização de `dadosJson`, PURA — sem seleção/side-effects, reutilizada obrigatoriamente pelas Ondas 3/6**), `registry/componentes-registry.ts` (mapa tipo→defaults, usa `crypto.randomUUID()` nativo), `store/useEditorStore.ts` (Zustand simples, sem middleware).

**Decisão de arquitetura chave (não reabrir sem motivo novo):** `@dnd-kit` é usado SÓ para (a) arrastar da paleta pro canvas e (b) reordenar a lista de slides — nunca para mover/redimensionar um componente já posicionado no canvas, que usa mouse events próprios (`useCanvasDragResize.ts`). Motivo: `@dnd-kit` é uma lib de reordenação/colisão, não de posicionamento livre X/Y com resize.

**Dívida técnica registrada (Lens):** `ComponenteNoCanvas.tsx` reimplementa a renderização visual de Card/Grid (`RenderComponenteContainer`) em vez de reaproveitar `RenderComponente` — duplicação aceita porque o RenderEngine puro não pode conhecer o conceito de "seleção". Se essa duplicação crescer numa 3ª variante (ex: Export na Onda 6), considerar parametrizar `RenderComponente` com uma prop `renderFilho?`.

**Pendência de baixa prioridade (Sage):** `CriarSlide`/`DuplicarSlide` concorrentes (2 cliques muito rápidos) podem gerar `ordem` duplicada entre 2 slides — mitigado no fluxo normal pelo `disabled` do botão durante o processamento; não corrigido com lock/transação de leitura+escrita por ser um cenário raro.

**Como adicionar a Onda 3 (Temas + Animações + Timeline real) no futuro:**
1. Campo `animacao` já reservado (`z.unknown().optional()`) em `baseComponenteSchema` — tipar de verdade nesta onda, sem precisar migrar dados existentes.
2. `TimelinePlaceholder.tsx` vira a Timeline real (keyframes) — hoje só lista camadas por zIndex.
3. `ApresentacaoTema` (model já existe desde a Onda 1, ainda sem UI) precisa de tela de gestão/aplicação de tema.

**Editado quando:** Onda 3 concluir.

**Última atualização:** 2026-07-09 por Scribe

---

### Alpha Presentation Studio — Onda 3 (Temas + Animações + Timeline real)

**Adicionado em:** 2026-07-09 por Scribe (sessão Bibble, mesma sessão das Ondas 1 e 2)

**Descrição:** Deu vida ao model `ApresentacaoTema` (existia desde a Onda 1 sem nenhuma UI), tipou o campo `animacao` reservado desde a Onda 2, e substituiu a Timeline placeholder por uma régua de tempo real com barras arrastáveis. Escopo de animação ampliado pelo usuário (13 tipos em vez dos 10 propostos por Scout) e GSAP instalado antecipadamente (sem uso de código ainda) por pedido explícito do usuário.

**Checklist de integração (Onda 3):**
- [x] Botão "Tema" na Barra Superior abre modal `SeletorTema` com os 5 templates seedados — **testado em browser real**
- [x] Aplicar tema persiste e sobrevive a reload completo da página (`Apresentacao.temaId` lido corretamente na `page.tsx` do editor) — **confirmado via teste real: aplicar "Alpha Premium" → reload → tema segue marcado como ativo**
- [x] Timeline mostra régua de tempo (0-5s) + barras de delay/duração arrastáveis por componente — confirmado visualmente (texto mudou de "Camadas (N)" para "TIMELINE (N)")
- [x] Painel de Propriedades ganhou seção "Animação de entrada" comum a todos os tipos (13 tipos disponíveis, com campos extras condicionais para stagger/typing/counter)
- [ ] Seção de Animação com componente selecionado real — **não testado em browser** (mesma limitação de drag-and-drop das Ondas 1/2 impediu adicionar um componente via automação); revisão estrutural do código feita, mas sem confirmação visual renderizada.
- [ ] **Lacuna de UX conhecida, não corrigida ainda**: animação `stagger` configurada num Card/Grid não é visível DENTRO do Editor (só no futuro Modo Apresentação/Export, Onda 6) — ver dívida técnica abaixo.

**Arquivos envolvidos (Onda 3):**
- `src/lib/validations/animacao.ts` — 13 tipos (fade, slide-up/down/left/right, zoom-in/out, flip, bounce, blur, stagger, typing, counter), `configAnimacaoSchema` (tipo/duração/delay/easing + campos condicionais) + `configAnimacaoCompletaSchema` (entrada/saída/loop)
- `src/lib/validations/apresentacao-tema.ts` — schemas de criar/atualizar/aplicar tema
- `src/lib/validations/slide-componentes.ts` — campo `animacao` trocado de `z.unknown()` para `configAnimacaoCompletaSchema` (retrocompatível — dados antigos têm `animacao: undefined`)
- `src/actions/apresentacao-temas.ts` — `ListarTemas` (templates + próprios do usuário, `take: 100` de segurança adicionado por Sage), `CriarTema`, `AtualizarTema` (templates só editáveis por Admin/CEO), `AplicarTema` (ownership via `checarOwnershipApresentacao`)
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx` — ganhou `AnimacaoWrapper` (genérico, cobre 10 dos 13 tipos via `<motion.div>` declarativo), `TextoAnimado` (componente próprio extraído para `typing`/`counter` — hooks não podem rodar condicionalmente dentro de um `case` de switch, violação real das Regras dos Hooks corrigida durante a construção), `FilhosContainer` (stagger em card/grid)
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/AnimacaoProps.tsx` — seção comum de animação, anexada após o formulário específico de cada tipo em `PainelPropriedades.tsx`
- `src/components/Apresentacoes/Editor/Timeline/{TimelineReal.tsx,useTimelineDrag.ts}` — substituem `TimelinePlaceholder.tsx` (removido do repo). Drag em 1 eixo (tempo), reaproveitando o espírito de `Canvas/useCanvasDragResize.ts`
- `src/components/Apresentacoes/Editor/BarraSuperior/SeletorTema.tsx` (novo) + `BarraSuperiorEditor.tsx` (editado) — modal de escolha de tema
- `src/components/Apresentacoes/Editor/Canvas/CanvasArea.tsx` — aplica CSS custom properties do tema (`--tema-cor-primaria/secundaria/accent`), opt-in
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx`, `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx` — propagam `temaInicial`/`TemaResumo` desde o servidor
- **5 templates seedados no Turso real** (não migration de schema — dados): Alpha Premium, Dark Glass, Corporate, Minimalista, Apple-style (`isTemplate: true`, `criadoPorId: null`)
- **GSAP instalado** (`npm install gsap`) — decisão do usuário, sem uso de código ainda, disponível para ondas futuras

**Decisão de arquitetura chave:** Animação é **puramente declarativa** — vive em `componente.animacao?.entrada` no JSON do slide, nunca imperativa/hardcoded. Se ausente (todo dado das Ondas 1/2), renderiza estático, zero regressão. Tema é aplicado via **CSS custom properties opt-in** (`CanvasArea.tsx`) — os 7 tipos de componente não foram forçados a consumir essas variáveis.

**Dívida técnica registrada (Lens), precisa ser fechada antes/durante a Onda 6:** `ComponenteNoCanvas.tsx` (Onda 2) não replica a lógica de `stagger` que `FilhosContainer` (dentro do `RenderComponente.tsx` puro) ganhou nesta onda — um Card/Grid com animação `stagger` configurada não mostra a cascata visualmente DENTRO do Editor, só no futuro Modo Apresentação/Export. Usuário vai notar essa inconsistência ao configurar e não ver efeito. **Resolver antes de considerar o produto "completo"** — ou replicar stagger em `ComponenteNoCanvas`, ou adicionar aviso/preview explícito.

**Pendência de segurança registrada (Anubis), relevante só quando a Onda 6 existir:** `ApresentacaoTema.tokensJson` é objeto Zod livre — nunca gerar uma tag `<style>` via `dangerouslySetInnerHTML` com esse conteúdo bruto no Export Engine (risco de CSS injection). Sempre aplicar via `style`/CSS custom properties.

**Como continuar na Onda 4 (3D — React Three Fiber/drei) no futuro:**
1. Instalar `@react-three/fiber` e `@react-three/drei` (ainda NÃO instalados — só `three` puro está no projeto, usado em `animated-shader-background.tsx`).
2. Novos tipos de componente 3D (Globo, Partículas, ObjetoGLB) entram no mesmo `componenteSchema` (discriminated union) de `slide-componentes.ts` — seguir o padrão dos 7 tipos existentes (base comum x/y/w/h/zIndex/rotacao/animacao + campos específicos).
3. `RenderComponente.tsx` precisa aprender a renderizar esses novos tipos — provavelmente exigindo um `<Canvas>` do R3F embutido dentro do componente do slide (atenção: já existe um bug catalogado em `known-errors.md` sobre canvas Three.js com `width:0` dentro de containers `absolute` no iframe do painel — relevante aqui).
4. `registry/componentes-registry.ts` ganha entradas para os novos tipos (ícone, label, `criarComponentePadrao`).
5. Considerar se os novos tipos 3D precisam de painel de propriedades específico (`camposPorTipo/GloboProps.tsx` etc) seguindo o padrão já estabelecido.

**Editado quando:** Onda 4 concluir.

**Última atualização:** 2026-07-09 por Scribe

---

### Alpha Presentation Studio — Onda 4 (Componentes 3D via React Three Fiber)

**Adicionado em:** 2026-07-10 por Scribe (sessão Bibble)

**Descrição:** 3 novos tipos de componente no editor: `globo` (esfera com textura opcional, marcadores de lat/lng, rotação automática), `particulas` (campo de pontos animados), `objeto3d` (carrega modelo `.glb`/`.gltf` externo via URL). Todos renderizados via `@react-three/fiber` (R3F) + `@react-three/drei`, instalados nesta onda — primeira vez que R3F entra no projeto (`three` puro já era usado, sem R3F, em `animated-shader-background.tsx`). Compatibilidade de versão confirmada por Scout antes de instalar: `@react-three/fiber@9.6.1` exige `react >=19 <19.3`/`three >=0.156` (projeto: React 19.2.3, Three 0.185.1 — compatível); `@react-three/drei@10.7.7` exige `react ^19`/`@react-three/fiber ^9.0.0`.

**Checklist de integração (Onda 4):**
- [x] 3 novos tipos aparecem na sidebar de componentes com ícones corretos (`Globe`, `Orbit`, `Box` do lucide-react) — **confirmado em browser real (Probe)**
- [x] `<canvas>` WebGL renderiza com dimensões válidas (não `width:0`) dentro do Editor — **confirmado**: `rectWidth`/`rectHeight` batem com `w`/`h` do componente
- [x] Painel de Propriedades mostra os campos corretos por tipo (`GloboProps`/`ParticulasProps`/`ObjetoGlbProps`) — **confirmado**
- [x] Edição de campo + autosave + persistência sobrevive a reload — **confirmado ponta a ponta**: editada cor de um componente Partículas existente, `POST .../editor` (Server Action `AtualizarSlide`) retornou 200, reload confirmou o valor novo persistido
- [x] Zero regressão nos 7 tipos de componente das Ondas 1-3 — **confirmado** (componente "Texto" existente no mesmo slide de teste continuou funcionando normalmente após a mudança)
- [x] Console sem erros de WebGL/Three.js/R3F — único erro presente é o hydration mismatch pré-existente do Radix (`id` de `DropdownMenuTrigger`, SSR vs client), não relacionado a esta onda

**Arquivos envolvidos (Onda 4):**
- `src/lib/validations/slide-componentes.ts` — `globoComponenteSchema` (`corBase?`, `texturaUrl?`, `velocidadeRotacao` 0-5 default 0.5, `marcadores[]` com `lat` `.min(-90).max(90)`/`lng` `.min(-180).max(180)`/`label?`/`cor?`), `particulasComponenteSchema` (`quantidade` 10-2000 default 300, `cor?`, `tamanho` 0.5-10 default 2, `velocidade` 0-5 default 1), `objeto3dComponenteSchema` (`url` obrigatório — string vazia é o valor "sem conteúdo ainda", mesmo padrão do componente Imagem; `autoRotacao` default true; `escala` 0.1-10 default 1). Os 3 adicionados ao `discriminatedUnion` e ao `type ComponenteSlide`.
- `src/components/Apresentacoes/Editor/registry/componentes-registry.ts` — 3 entradas novas (`globo`: ícone `Globe`, w/h 300x300; `particulas`: ícone `Orbit` (escolhido em vez de `CircleDot`/`Sparkles` para não confundir com o ícone do tipo `icone`), w/h 400x300; `objeto3d`: ícone `Box`, w/h 300x300).
- `src/components/Apresentacoes/Editor/RenderEngine/useVisibilidadeIframe.ts` (novo) — hook compartilhado via `IntersectionObserver`, usado pelos 3 componentes 3D para alternar `frameloop` do `<Canvas>` entre `"always"`/`"never"` conforme visibilidade real dentro do iframe do painel (R3F resolve resize via `ResizeObserver` interno sozinho, mas NÃO resolve visibilidade — `document.visibilityState` não reflete o iframe, mesma limitação do `animated-shader-background.tsx`, ver `known-errors.md`).
- `src/components/Apresentacoes/Editor/RenderEngine/GloboRender.tsx` (novo) — `latLngParaVetor3` converte lat/lng em posição 3D na superfície da esfera; rotação automática via `useFrame`; textura opcional via `useTexture` do drei, protegida por Error Boundary de classe `LimiteDeErroTextura` (textura 404/inválida não derruba o slide).
- `src/components/Apresentacoes/Editor/RenderEngine/ParticulasRender.tsx` (novo) — `<Points>`/`<PointMaterial>` do drei, posições geradas via `useMemo`.
- `src/components/Apresentacoes/Editor/RenderEngine/ObjetoGlbRender.tsx` (novo) — `useGLTF` do drei dentro de `Suspense`, protegido por Error Boundary de classe `LimiteDeErroGlb` (mesmo padrão de `LimiteDeErroTextura`); placeholder de cubo wireframe quando `url` vazia ou load falha.
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx` (editado) — 3 novos `case` no switch, delegando para os componentes acima dentro do mesmo `AnimacaoWrapper` já usado pelos outros 10 tipos. RenderEngine continua puro.
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/{GloboProps,ParticulasProps,ObjetoGlbProps}.tsx` (novos) — seguem exatamente o padrão visual/estrutural de `ImagemProps.tsx`; registrados em `PainelPropriedades.tsx`.

**Decisão de arquitetura chave:** Nenhum `OrbitControls` dentro do Editor — testado e removido (Lens) porque competia com o `pointerdown`/`pointermove` do drag/resize do canvas 2D (`useCanvasDragResize.ts`). Rotação automática via `useFrame` já dá vida visual sem exigir controle manual do usuário. Se o futuro Modo Apresentação (Onda 6) quiser permitir o usuário final girar a câmera manualmente, isso deve ser condicional a um modo "não-editor" (prop explícita), nunca ligado por padrão dentro do Editor.

**Padrão estabelecido — Error Boundary de classe para asset loading assíncrono:** Primeira vez que o projeto usa Error Boundary de classe (React ainda não tem hook nativo equivalente). `LimiteDeErroTextura`/`LimiteDeErroGlb` seguem o mesmo template minúsculo (`getDerivedStateFromError` + `componentDidCatch` para log + render condicional de fallback) — reaproveitar esse template se outro caso de asset externo carregado via hook-que-lança (`useTexture`/`useGLTF`/similar) aparecer no futuro, em vez de reinventar.

**Pendências de segurança registradas (Anubis), relevantes só quando a Onda 6 (View pública) existir:**
1. `texturaUrl` (Globo) e `url` (Objeto3D) são strings livres sem validação de protocolo/domínio — hoje SEM RISCO real porque o fetch roda 100% client-side, no browser do próprio usuário autenticado com ownership da apresentação (mesmo padrão já aceito desde a Onda 2 em `imagemComponenteSchema.url`). Reavaliar se qualquer parte da renderização passar a rodar server-side (export/thumbnail via headless browser) ou se o Modo Apresentação expuser essas URLs a visitantes anônimos — nesse ponto, considerar allowlist de domínio ou proxy de asset.
2. Sem limite de tamanho de arquivo para texturas/modelos `.glb` — hoje só o próprio usuário se prejudica (autossabotagem); relevante quando terceiros passarem a visualizar via Export/Publicação pública.

Ver `decisions.md` (2026-07-10) para o registro completo dessas duas pendências, junto das outras 2 já catalogadas (hash de senha bcrypt, CSS injection de `tokensJson`) — total de 4 pendências acumuladas para auditoria obrigatória na Onda 6.

**Nota de performance (Lens):** cada componente 3D monta seu próprio `<Canvas>` R3F independente (WebGL contexts são caros, browsers têm limite prático de ~8-16 simultâneos). Não é hard-limitado por UI — ver nota em `known-errors.md` caso um usuário reporte componente 3D "sumindo" em slides com muitos outros componentes 3D.

**Editado quando:** Onda 5 concluir.

**Última atualização:** 2026-07-10 por Scribe

---

### Exportação completa do CS & NPS

**Arquivos:** `src/app/PainelAlpha/CadastroClientes/page.tsx`, `src/app/PainelAlpha/CadastroClientes/BotaoExportarDados.tsx`, `src/app/api/cs-nps/exportar/route.ts`, `src/lib/cs-nps/exportar-dados.ts`

**Propósito:** exportar em `.xlsx` todas as empresas do CS & NPS e as relações explicitamente selecionadas no helper ExcelJS, mantendo `clienteId` nas abas satélite.

**Editado quando:** um campo ou relacionamento ligado a `clientes` passar a fazer parte da exportação; a role/permissão do módulo mudar; o botão de ação do CS & NPS for reorganizado; ou o contrato HTTP de download mudar.

**Como adicionar um novo relacionamento:**

```typescript
const clienteSelect = {
  // campos existentes
  novaRelacao: { select: { id: true, clienteId: true, campo: true } },
} as const;

const sheets = [
  // abas existentes
  {
    name: "Nova Relacao",
    headers: Object.keys(clienteSelect.novaRelacao.select),
    rows: clientes.flatMap((cliente) => cliente.novaRelacao),
  },
];
```

Ao evoluir o exportador, atualizar em conjunto o `select` Prisma, a lista de abas/headers e os testes da rota/helper. Não usar `include: true` ou serialização irrestrita: a seleção explícita evita vazar colunas futuras ou dados não aprovados. Relações opcionais 1:1 devem ser convertidas para zero/uma linha, como `indicacao ? [indicacao] : []`.

Para sócios, manter as duas representações complementares: `quantidadeSocios` + `sociosResumo` na aba `Empresas` para leitura consolidada e uma linha por registro na aba `Socios`. Esta aba deve conservar `clienteId` e o contexto humano `clienteRazaoSocial`, `clienteCnpj` e `clienteServico`, para que o vínculo permaneça identificável sem cruzamento manual obrigatório.

**Contrato de autorização:**

```typescript
const acesso = await verificarAcessoAdministrativoCsNps();
if (!acesso.autorizado) return resposta401Ou403(acesso);
```

A verificação visual de `Admin`/`CEO` em `page.tsx` nunca substitui `verificarAcessoAdministrativoCsNps()` de `src/lib/cs-nps/autorizacao.ts`, compartilhado com a importação. Manter 401 para sessão inválida, 403 para usuário inativo/role/permissão insuficiente, 404 quando não houver clientes e 500 genérico sem detalhes internos. Toda exportação bem-sucedida deve continuar gerando a ação de auditoria `EXPORTAR_CS_NPS_COMPLETO`.

**Contrato de segurança do arquivo:** neutralizar formula injection antes de inserir valores no Excel; entregar com `Content-Type` de XLSX, `Content-Disposition: attachment`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` e `X-Robots-Tag: noindex, nofollow, noarchive`. O client deve usar `credentials: "same-origin"`, `cache: "no-store"`, validar `response.ok` antes do blob e revogar o `ObjectURL` após iniciar o download.

**Abas atuais:** `Empresas`, `Socios`, `CS`, `Feedbacks`, `Log Alteracoes`, `Historico Cliente`, `Indicacoes`, `CRM Oportunidades`, `CRM Contatos`.

**Contrato visual:** aplicar em todas as abas cabeçalho destacado, bordas, zebra, autofiltro, primeira linha congelada, `wrapText`, ajuste de largura por tipo/conteúdo e altura compatível com células multilinha. Na aba `Empresas`, preservar as cores semânticas: `feedbackGoogle` com `SIM` verde e `NÃO` vermelho; `status` com `Deferido` verde, prefixo `Cancelado` vermelho, `Stand By` amarelo, `Em andamento` azul e `Arquivado` cinza. Novos valores de status devem ter sua semântica definida explicitamente antes de receber uma cor.

**Contrato de datas (18 colunas explícitas):** declarar cada campo em `dateColumns`; não inferir formatação pelo nome da coluna. Usar `date-only` e formato Excel `dd/mm/yyyy`, sem conversão de timezone, para `Empresas.dataConstituicao`, `Empresas.dataContratacao`, `Empresas.dataExito`, `Socios.dataNascimento` e `CRM Oportunidades.dataFechamento`. Usar `date-time` e formato Excel `dd/mm/yyyy hh:mm`, convertido para `America/Sao_Paulo`, para `Empresas.createdAt`, `Empresas.updatedAt`, `CS.dataRegistro`, `Feedbacks.dataRegistro`, `Log Alteracoes.dataAlteracao`, `Historico Cliente.criadoEm`, `Indicacoes.dataIndicacao`, `Indicacoes.comprovanteEnviadoEm`, `Indicacoes.createdAt`, `CRM Oportunidades.createdAt`, `CRM Oportunidades.updatedAt`, `CRM Contatos.createdAt` e `CRM Contatos.updatedAt`. Manter nulos como células vazias e entradas não reconhecidas ou inválidas como texto original, sem normalização automática.

**Última atualização:** 2026-07-15 por Scribe

---

### Importação em lote do CS & NPS

**Arquivos:** `src/app/PainelAlpha/CadastroClientes/page.tsx`, `src/app/PainelAlpha/CadastroClientes/importacao/`, `src/app/api/cs-nps/importar/{modelo,previsualizar,salvar}/route.ts`, `src/lib/cs-nps/{autorizacao,importacao-tipos,importacao-rate-limit,importar-dados,preflight-xlsx}.ts`, `tests/cs-nps/`

**Propósito:** importar sócios, registros de CS e feedbacks Google em qualquer combinação, sempre com prévia removível e seleção explícita do cadastro/serviço de destino antes da transação final.

**Editado quando:** um campo persistido de `socios`, `log_cs` ou `logFeedback` mudar; o modelo de planilha mudar; a regra `clientes.cnpj + servicos` mudar; roles/permissões do CS & NPS mudarem; limites de upload/ZIP mudarem; ou outra entidade passar a ser importável.

**Como adicionar um novo tipo importável:** manter sincronizados, no mesmo change set, o tipo em `TIPOS_IMPORTACAO`, nome da aba/cabeçalhos e parser em `importar-dados.ts`, schemas discriminados de preview/save, criação transacional, contadores/resumo, seleção e rótulos da UI e os testes Vitest. Nunca aceitar o objeto da planilha como `data` Prisma irrestrito; mapear cada campo explicitamente.

**Contrato atual das abas:**

| Tipo | Aba | Cabeçalhos exatos |
|---|---|---|
| Sócios | `Socios` | `cnpj`, `razaoSocial`, `nome`, `telefone`, `observacao`, `dataNascimento`, `vinculo` |
| CS | `CS` | `cnpj`, `razaoSocial`, `colaborador`, `sentimento`, `observacao`, `dataRegistro` |
| Feedbacks | `Feedbacks` | `cnpj`, `razaoSocial`, `colaborador`, `sentimento`, `observacao`, `dataRegistro` |

O workbook sempre pode conter `Instrucoes` e contém somente as abas escolhidas no modal. CNPJ ou razão social é obrigatório; quando ambos forem fornecidos, precisam apontar para o mesmo conjunto. Vários sócios são representados repetindo a empresa em uma linha por sócio. `sentimento` aceita somente `pos`, `neg` ou `na`; datas aceitam `DD/MM/AAAA`, `AAAA-MM-DD` ou célula de data do Excel e são normalizadas pelo parser.

**Resolução de destino:** `clientes.cnpj` não é único; o vínculo definitivo é `clienteId`. A prévia devolve todos os candidatos com `clienteId`, CNPJ, razão social, serviço e status. Uma correspondência sugere automaticamente o destino; várias deixam a linha ambígua para escolha de empresa/serviço; nenhuma torna a linha inválida. No `POST /salvar`, o servidor refaz o matching pelo identificador original e rejeita qualquer `clienteId` que não continue entre os candidatos. Não confiar na seleção enviada pelo client sem essa revalidação.

**Autorização compartilhada:** as três rotas e a exportação usam `verificarAcessoAdministrativoCsNps()` de `src/lib/cs-nps/autorizacao.ts`, que exige sessão, usuário ainda `ATIVO` no banco, role atual normalizada `admin`/`ceo` e permissão efetiva `Cliente`. A confirmação também revalida role/status dentro da transação. A condição visual em `page.tsx` é apenas conveniência.

```typescript
const acesso = await verificarAcessoAdministrativoCsNps();
if (!acesso.autorizado) return resposta401Ou403(acesso);
```

**Transação e auditoria:** `salvarImportacao()` faz `createMany` em `socios`, `log_cs` e/ou `logFeedback` e cria `IMPORTAR_CS_NPS_SALVO` em `auditoria` dentro do mesmo `db.$transaction`. Qualquer falha reverte dados e auditoria de sucesso. Modelo, prévia, recusas e falhas usam ações de auditoria best-effort nas rotas, sem expor conteúdo sensível da planilha.

**Contrato de upload/preflight:** manter `.xlsx` apenas, 10 MB por arquivo e 2.000 linhas somadas. Antes de `ExcelJS.load`, `preflight-xlsx.ts` percorre o ZIP em streaming com `yauzl`, verifica tamanho real e restringe a 256 entradas, 20 MB por entrada descompactada, 50 MB no total e razão de compressão 100:1. Macros, ZIP criptografado, fórmulas, abas/cabeçalhos inesperados, caminhos inseguros e metadados/tamanhos incoerentes devem continuar bloqueados. A rota de prévia valida `Origin`/`Sec-Fetch-Site`, `Content-Type` e `Content-Length` antes de materializar o formulário.

**Rate limit e idempotência:** `importacao-rate-limit.ts` mantém no máximo cinco prévias por minuto por `userId + IP` e uma prévia simultânea por chave. É uma defesa em memória por instância, não um limite distribuído; mover para Redis/KV se houver várias réplicas. A confirmação não possui chave persistente de idempotência nesta versão; um replay válido pode duplicar registros. Não declarar a operação idempotente sem adicionar uma chave única persistida e tratamento transacional de repetição — isso está fora do escopo atual.

**Testes obrigatórios ao evoluir:** executar os testes Vitest de `tests/cs-nps/importar-dados.test.ts`, `calculos.test.ts` e `preflight-xlsx.test.ts`, cobrindo ao menos abas selecionadas, múltiplos sócios, conflito/ambiguidade de empresa, datas, fórmulas, `clienteId` adulterado, rollback/auditoria, remoção da prévia e ZIP bomb/tamanho real.

**Última atualização:** 2026-07-15 por Scribe

---

### Alpha Presentation Studio — Onda 5 (Motor de IA para geração de conteúdo de slide)

**Adicionado em:** 2026-07-10 por Scribe (sessão Bibble)

**✅ STATUS: COMPLETA (backend + UI).** Backend testado com 4 gerações reais via Ollama. UI (`ModalGerarComIA.tsx`) construída, revisada por Lens/Sage (2 bugs reais encontrados e corrigidos, ver abaixo), tsc/lint/build aprovados por Forge. **Ressalva:** o teste visual automatizado em browser (cliques reais, confirmação de preview renderizado) não pôde ser executado nesta sessão por instabilidade da ferramenta de preview (limitação de ambiente, não de código) — task de teste manual delegada (`task_99054ff9`). Recomenda-se confirmação humana no navegador antes de considerar 100% validado visualmente, mas o código foi revisado linha a linha e os fluxos de erro/estado foram corrigidos por leitura cuidadosa.

**Descrição:** Motor de IA que gera o conteúdo de 1 slide a partir de um prompt em texto livre. A IA escolhe 1 de 5 templates de layout FIXOS pré-definidos no código e preenche só o conteúdo textual — nunca desenha coordenadas x/y/w/h livres (decisão deliberada para evitar saída visualmente quebrada). Streaming SSE real, reaproveitando o mesmo padrão de eventos já usado no chat do Bibble.

**Descoberta de arquitetura importante desta onda:** O CLAUDE.md raiz do projeto documenta `@anthropic-ai/sdk` (`new Anthropic()`) como "padrão futuro" para IA — mas isso **nunca foi implementado**. O Bibble (assistente do painel) usa desde sempre um client multi-provedor próprio (`src/lib/bibble/client.ts`) que chama múltiplos provedores (Ollama/OpenAI/Anthropic/Google) via formato REST OpenAI-compatible (`/v1/chat/completions`), não o SDK oficial nem o formato nativo `/v1/messages` da Anthropic. O usuário confirmou explicitamente: reaproveitar esse client existente, não instalar o SDK novo. **Esta é a arquitetura real de IA do projeto — o texto do CLAUDE.md sobre `@anthropic-ai/sdk` está desatualizado/nunca-implementado, não confiar nele sem verificar o código.**

**Segunda descoberta importante:** o modelo padrão de IA do projeto é **Ollama local** (`BIBBLE_MODEL` default `gemma4:e4b`, servidor `ollama.alpha-comex.com` em produção), **não Anthropic direta** — não há `ANTHROPIC_API_KEY` configurada no ambiente. Echo inicialmente fixou `claude-sonnet-4-6` como padrão (baseado numa leitura literal do nome da onda "Claude API"), o que gerou 401 em teste real do Probe. Corrigido para `process.env.BIBBLE_MODEL ?? "gemma4:e4b"` — mesmo default do chat do Bibble. Ver `decisions.md` (2026-07-10) para o registro completo dessa correção.

**Checklist de integração (Onda 5):**
- [x] Route Handler `POST /api/apresentacoes/gerar-slide` existe e responde
- [x] Auth → Zod → ownership → SÓ DEPOIS chama IA (ordem confirmada por leitura de código E teste real — nenhum caminho pula a checagem antes do custo de IA)
- [x] Streaming SSE real confirmado (44 eventos ao longo de 2.7s num teste real, não resposta instantânea)
- [x] 3 dos 5 templates testados com geração real bem-sucedida (`titulo-subtitulo`, `titulo-tres-cards`, `citacao`) — os outros 2 (`titulo-paragrafo`, `imagem-texto`) não foram testados individualmente mas usam o mesmo mecanismo, risco de quebra isolada é baixo
- [x] 401 sem autenticação, 400 com Zod claro em campos faltando — confirmados
- [x] **Botão/modal "Gerar com IA" no Editor** — `ModalGerarComIA.tsx` construído, botão na Barra Superior (ícone `WandSparkles` — `Wand2` não existe na versão instalada do lucide-react, confirmado via grep). Preview do slide via `RenderComponente` real, escalado com CSS `transform`. **Teste visual humano recomendado** antes de considerar 100% confirmado (ferramenta de preview instável nesta sessão).

**Arquivos envolvidos (Onda 5):**
- `src/lib/bibble/completion.ts` (novo) — `callCompletion` extraída de `src/app/api/bibble/chat/route.ts` (refatoração pura, mesma lógica/assinatura, confirmada sem regressão por Forge). Também ganhou `encodeSSE<T>()`, helper genérico de frame SSE, reaproveitado tanto pelo chat do Bibble quanto pela geração de slide.
- `src/app/api/bibble/chat/route.ts` (editado) — importa `callCompletion`/`encodeSSE`/tipos do helper extraído, sem mudança de comportamento.
- `src/lib/apresentacoes-ia/templates-layout.ts` (novo) — 5 templates fixos (`titulo-subtitulo`, `titulo-paragrafo`, `titulo-tres-cards`, `imagem-texto`, `citacao`), cada um com `descricao`/`camposEsperados`/`preencher(conteudo)`. Helper `cardComTexto()` evita duplicar a estrutura dos 3 cards do template `titulo-tres-cards`.
- `src/lib/apresentacoes-ia/prompts.ts` (novo) — `montarSystemPromptGeracaoSlide()`, lista os templates dinamicamente (nunca hardcoda a lista — se um 6º template for adicionado em `templates-layout.ts`, o prompt já reflete automaticamente). Exige JSON puro na resposta: `{"template": "nome", "conteudo": {"CAMPO": "texto"}}`.
- `src/lib/apresentacoes-ia/gerar-slide.ts` (novo) — `gerarSlideStream()` (async generator, consome o stream do provedor e repassa deltas) + `validarESlideDoTexto()` (função pura separada, parseia/valida o JSON acumulado, testável isoladamente). `MODELO_GERACAO_SLIDE` = `process.env.BIBBLE_MODEL ?? "gemma4:e4b"`. Guard defensivo contra chaves `__proto__`/`constructor`/`prototype` no conteúdo vindo da IA. Loga (não bloqueia) quando a IA omite um campo esperado do template escolhido.
- `src/app/api/apresentacoes/gerar-slide/route.ts` (novo) — Route Handler POST, `auth()` → Zod (`apresentacaoId`, `prompt` max 2000 chars) → `checarOwnershipApresentacao` (mesmo padrão de `slides.ts`) → só então monta o `ReadableStream` SSE.
- `src/components/Apresentacoes/Editor/BarraSuperior/ModalGerarComIA.tsx` (novo) — Dialog com textarea de prompt, consome o SSE via `fetch`+`ReadableStream.getReader()` no client, preview do slide gerado via `RenderComponente` (escalado com `transform: scale()`), botões Aplicar/Gerar outro/Descartar.
- `src/components/Apresentacoes/Editor/BarraSuperior/BarraSuperiorEditor.tsx` (editado) — novo botão "Gerar com IA" (ícone `WandSparkles`), abre o modal.
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx` (editado) — `handleSlideGeradoAplicado` itera os componentes retornados chamando `adicionarComponente` (Zustand) um a um — decisão deliberada de ADICIONAR ao slide ativo, nunca substituir o que já existe (menos destrutivo).

**⚠️ Duas armadilhas reais encontradas nesta rodada de revisão — ficam registradas para não repetir em futuros consumidores de SSE no client:**
1. **Fechar um modal de streaming precisa limpar TODO o estado local**, não só abortar o fetch — senão reabrir mostra a sessão anterior (preview/erro "fantasma"). `ModalGerarComIA.tsx` corrigido: `fecharEAbortar(false)` agora chama `resetar()` + limpa `prompt`/`gerando` além do `AbortController.abort()`.
2. **Respostas de erro HTTP simples (400/401/403) não são SSE** — um endpoint de streaming pode responder com JSON cru de erro ANTES de começar o stream (ex: falha de auth/Zod/ownership). Um client que só sabe ler `data: {...}\n\n` vai **ignorar silenciosamente** essa resposta (nenhuma linha começa com `data: `), deixando o usuário sem feedback nenhum. Fix: sempre checar `!res.ok` e ler o corpo como JSON simples ANTES de tentar `res.body.getReader()` no modo stream. Qualquer novo componente que consuma um endpoint SSE no projeto deve replicar esse guard.

**Decisão de arquitetura chave:** Templates de layout são FIXOS no código (não gerados pela IA) — a IA só escolhe qual template usar e preenche o texto. Isso elimina o risco de coordenadas x/y/w/h inconsistentes/sobrepostas que uma IA "desenhando" livremente produziria. Se a Onda 6 ou uma sessão futura quiser mais variedade visual, adicionar um 6º/7º template em `templates-layout.ts` (a lista em `prompts.ts` se atualiza sozinha) é mais seguro que dar liberdade de coordenadas à IA.

**Pendência de segurança registrada (Anubis) — risco aceito por ora:** sem rate-limit em `/api/apresentacoes/gerar-slide`. Diferente do CPF/convite (API paga InfoSimples, custo financeiro direto por chamada — pendência crítica registrada separadamente), esta rota usa Ollama próprio/interno, sem custo de terceiro por chamada — risco é só de consumo de recurso de infraestrutura própria. **Reavaliar se o modelo padrão for trocado no futuro para um provedor pago** (Anthropic/OpenAI) — nesse momento a ausência de rate-limit deixa de ser aceitável. Ver `decisions.md` (2026-07-10).

**Pendências residuais (baixa prioridade):**
1. Teste visual humano no navegador (task `task_99054ff9`) — confirmar cliques reais, preview renderizado, aplicar/descartar de ponta a ponta.
2. Testar os 2 templates que não foram exercitados individualmente em teste real (`titulo-paragrafo`, `imagem-texto`) — usam o mesmo mecanismo dos 3 já testados, risco de quebra isolada é baixo.

**Editado quando:** Onda 6 concluir.

**Última atualização:** 2026-07-10 por Scribe

---

### Alpha Presentation Studio — Frente 1 (Expansão de Componentes, pós-Onda 5)

**Adicionado em:** 2026-07-10 por Scribe (sessão Bibble)

**Descrição:** Fora da sequência das 6 ondas originais — inserida entre a Onda 5 e a retomada da Onda 6, motivada por feedback direto do usuário de que a biblioteca de componentes (10 tipos) estava muito aquém do prompt original. Expandiu para **24 tipos** (14 novos). Ver detalhe completo em `components.md` (entrada "Frente 1") e `decisions.md` (2026-07-10, unificação por variante).

**Checklist de integração:**
- [x] Todos os 14 novos tipos aparecem na sidebar, agrupados por categoria (`CATEGORIAS_COMPONENTE`) — Básicos/Dados/Business/IA
- [x] Todos têm painel de propriedades (`camposPorTipo/*.tsx`) registrado em `PainelPropriedades.tsx`
- [x] `container` (recursivo) reconhecido em todos os pontos que já tratavam `card`/`grid`: `ComponenteNoCanvas.tsx`, `useEditorStore.ts` (`ehContainerComFilhos`), `PainelPropriedades.tsx` (`buscarNaArvore`), `AnimacaoProps.tsx` (elegibilidade de stagger)
- [x] Zero regressão nos 10 tipos existentes (Forge: tsc/lint/build limpos; Sage: edge cases graciosos)
- [x] `npm install @xyflow/react` — nova dependência, usada exclusivamente em `RenderBusiness.tsx`

**Arquivos envolvidos:** ver lista completa em `components.md` — resumo: `slide-componentes{-base,-basicos,-3d,-dados,-business,-ia}.ts` (validações fatiadas), `registry/{registry-tipos,registry-basicos,registry-3d,registry-dados,registry-business,registry-ia,componentes-registry}.ts` (registry fatiado), `RenderEngine/{nucleo.tsx,RenderComponente.tsx,render/*.tsx}` (RenderEngine fatiado), 14 `camposPorTipo/*.tsx` novos, `SidebarComponentes.tsx` reescrito.

**⚠️ Dívida técnica que CRESCEU nesta frente (Lens) — atualiza a nota já registrada na Onda 2:** a duplicação de renderização de containers entre `RenderComponente.tsx` (RenderEngine puro, usado no Modo Apresentação/preview) e `ComponenteNoCanvas.tsx`/`RenderComponenteContainer` (Editor, com seleção) — aceita desde a Onda 2 para `card`/`grid` — agora também cobre o novo tipo `container` (4 variações de `layout: grid/flex-row/flex-col/stack`). A mesma lógica condicional de `styleLayout` precisa ficar sincronizada em 2 arquivos para 3 tipos de container. **Prioridade de resolução subiu**: candidata a extrair `styleLayout` para uma função compartilhada (mesmo padrão de `posicionamento.ts`, extraído com sucesso na Onda 6 Fase 1 para o problema análogo de posicionamento absoluto). Resolver antes de uma eventual Frente 3/Onda 7, para não deixar a duplicação crescer para um 4º tipo de container.

**Fix aplicado (Sage):** `GrafoProps.tsx` — `removerNo` agora filtra `conexoes` órfãs ao remover um nó (evita lixo acumulando no JSON salvo).

**Editado quando:** Frente 2 (motor de IA com liberdade de composição) ou nova expansão de componentes ocorrer.

**Última atualização:** 2026-07-10 por Scribe

---

### Agenda Alpha (rota legada CalendarioAlpha — Domain-Wide Delegation)

**Adicionado em:** 2026-07-17 por Scribe (sessão Bibble). Detalhe completo em `codebase-map.md` ("Calendário Alpha — MVP via Domain-Wide Delegation..."). **Atenção:** este módulo passou por uma reconstrução completa de arquitetura na mesma sessão (de OAuth por usuário para Domain-Wide Delegation) — se encontrar referência a "conectar conta Google"/tokens/OAuth em versões antigas de documentação ou commits, está desatualizado.

**Checklist de integração:**
- [x] Aparece no menu/sidebar/grid/TabBar — via `MODULOS_REGISTRY` (fonte única, confirmado que os 4 consumidores leem do registry, sem array manual)
- [x] Ícone resolve (`CalendarClock` no `ICON_MAP` de `GlobalSidebar.tsx`)
- [x] Permissão administrável pelo Admin automaticamente (deriva do registry, mesmo mecanismo do `apresentacoes`/`conectoresIAlpha`)
- [x] Rota protegida por sessão (`middleware.ts`, prefixo `/PainelAlpha`) E por permissão de módulo (`CalendarioAlpha/page.tsx` chama `getPermissoesEfetivas()` e redireciona)
- [x] Todas as Server Actions chamam `verificarAcessoCalendarioAlpha()` — **não há mais Route Handlers** desta feature (removidos com o OAuth)
- [x] Fluxo real com Service Account/Domain-Wide Delegation — **validado em 2026-07-17** com credencial e Service Account reais (`calendario-alpha@projeto-alpha-492917.iam.gserviceaccount.com`, Client ID `116171147796556178597`). `calendar.calendarList.list()` impersonando `ti@alpha-comex.com` retornou os calendários reais da conta. `scripts/calendar-alpha-doctor.mjs` precisou de correção (não carregava `.env.local` via `dotenv` — corrigido, agora carrega `.env` + `.env.local` na mesma ordem de precedência do Next.js). Falta ainda: exercitar o fluxo completo pela UI no navegador (ativar módulo, ver eventos reais, criar/editar/cancelar) — a validação feita foi direto na API, não pela tela.

**Auditoria de segurança:** ativação/desativação do módulo gravam em `Auditoria` via `src/lib/google-calendar/auditoria.ts` (`registrarAuditoriaCalendarioAlpha`, best-effort, mesmo padrão de `cs-nps/autorizacao.ts`). Não há mais eventos de OAuth (state/nonce/callback) para auditar — removidos com a arquitetura antiga.

**Regra de segurança permanente para qualquer código futuro neste módulo:** `emailUsuario` (usado para impersonar no Google) só pode vir de `usuarios.email` resolvido no servidor a partir do `userId` da sessão (`obterUsuarioGoogleAtivo`) — nunca de um campo do payload do cliente. A Service Account pode impersonar qualquer usuário do domínio; aceitar um e-mail externo quebraria o isolamento entre usuários.

**Fase 2A atual — integração operacional flags-off (2026-07-30):**

- `POST /api/calendario-alpha/webhook` autentica canal/resource/token e apenas enfileira/coalesce; nunca chama Google no request.
- `GoogleCalendarPushChannel`, `GoogleCalendarPendingOperation` e `GoogleCalendarSyncLease` foram autorizados pelo Vault, aplicados uma única vez no Turso e validados com 7 índices explícitos + 3 unicidades.
- `src/actions/google-calendar-sync.ts` mantém o sync manual e usa o lock distribuído somente quando a flag correspondente está habilitada.
- `calendar-alpha:worker`, `calendar-alpha:maintenance`, `calendar-alpha:queue` e `calendar-alpha:doctor` são os pontos CLI-first; nenhuma UI controla fila, lease ou canal.
- Ao alterar o webhook, atualizar validação/autenticação, coalescência e `tests/google-calendar/webhook.test.ts`.
- Ao alterar fila/lease, preservar CAS, `claimToken`, owner + fencing e testes SQL/concorrência.
- Ao alterar canal, preservar token somente em hash, overlap na renovação e lifecycle serializado por lease.

**Runbook:** manter lock/fila/push desligados; verificar doctor e status; ativar lock → fila → push somente após comprovar URL HTTPS pública, WAF/rate limit distribuído, scheduler supervisionado e E2E Google/Turso multi-instância; começar por canário. O rollback desliga push, interrompe/drena worker, desliga fila e por último o lock.

**Pendências externas:** URL HTTPS pública, WAF/rate limit distribuído, scheduler supervisionado, E2E Google/Turso multi-instância e ativação canário. Não registrar nenhuma delas como concluída por testes locais.

**Editado quando:** qualquer contrato de webhook, fila, lease/fencing, worker, maintenance, flags ou rollout da Agenda Alpha mudar.

**Atualização 2026-07-17 (mesma sessão) — Compartilhamento entre colegas + Admin full-access + Bibble:**
- Nova tabela `GoogleCalendarColegaVisivel` (4ª migration Vault): qualquer usuário pode adicionar qualquer colaborador ATIVO à própria visão (`userId` viewer, `colegaId` dono, cor automática da paleta de 10 cores, `visivel` para ligar/desligar sem remover). Não é convite aprovado pelo dono — decisão explícita do usuário ("cultura de confiança interna").
- **Admin/CEO** (`isAdminRole` em `src/lib/google-calendar/colegas.ts`) enxerga **qualquer** colaborador mesmo sem estar na lista de compartilhamento, com **leitura + escrita completa** (`src/actions/google-calendar-admin.ts` — `criarEventoParaColega`/`atualizarEventoParaColega`/`cancelarEventoParaColega`). E-mail do colega-alvo é sempre resolvido do banco via `colegaId` (`resolverAlvoAdmin`), nunca aceito do cliente.
- Usuário comum só lê a agenda de colegas que adicionou (`listarEventosDeColega` em `src/actions/google-calendar-colegas.ts` — leitura ao vivo, sem cache/syncToken, teto de 10 páginas) e recebe somente blocos **“Ocupado”**, sem título, e-mail, Meet, ETag ou id real; Admin/CEO mantém detalhes e escrita.
- UI: `PainelColegas.tsx` (Sheet — adicionar/remover/cor/switch), botão `Users` no `HeaderCalendario`, eventos de colegas mesclados na grade com `colegaId` marcado em `EventoExibicao` (roteia `DetalhePopover`/`FormularioEvento` para as ações de Admin quando aplicável).
- Bibble ganhou tools reais neste módulo (`listar_eventos_calendario`, `criar_evento_calendario`, `cancelar_evento_calendario`, `consultar_disponibilidade_calendario`, `consultar_agenda_colega`) — catálogo completo em `bibble-flows.md`. `consultar_agenda_colega` só recebe nome/e-mail em texto livre do modelo, nunca um `colegaId`, tornando IDOR pelo parâmetro da tool estruturalmente impossível — a validação de compartilhamento/admin acontece 100% server-side dentro de `listarEventosDeColega`.

**Atualização 2026-07-17 (mesma sessão, rodada 2) — Gate de permissão para o compartilhamento entre colegas:**
- 5ª migration Vault: nova tabela `GoogleCalendarPermissaoColegas` (presença de linha = permitido; Admin/CEO sempre permitido sem precisar de linha). Antes disso, QUALQUER usuário ativo podia adicionar QUALQUER outro livremente — agora só quem o Admin liberou explicitamente pode usar a função (dos dois lados: quem adiciona e quem é adicionado).
- Helper único `temPermissaoCompartilhamento(userId, role)` em `src/actions/google-calendar-colegas.ts` — usado em `listarUsuariosParaCompartilhar`, `adicionarColegaVisivel` e `listarEventosDeColega` (checagem contínua: se o Admin revogar depois, o acesso para de funcionar mesmo com o registro de compartilhamento antigo ainda no banco).
- **Correção importante (mesmo dia, logo depois da 1ª entrega):** a permissão é **assimétrica** — só quem ADICIONA/CONSULTA (o viewer) precisa estar liberado. O colega-alvo NÃO precisa da permissão para ser adicionado. Motivo real do usuário: ele libera só líderes de setor, que precisam poder adicionar a agenda de colaboradores comuns (que nunca terão essa permissão). A 1ª versão exigia os dois lados liberados e isso quebrava esse caso de uso. Se mexer nesse fluxo de novo, não reintroduza a checagem do lado do `colega`.
- Novo painel Admin-only `PainelPermissoesColegas.tsx` (botão `ShieldCheck` no `HeaderCalendario.tsx`, visível só se `isAdmin`) com `listarPermissoesColegasTodosUsuarios`/`alternarPermissaoColegas` (ambas Admin-only, checadas via `isAdminRole` na Server Action, nunca só no cliente).
- Cores agora são personalizáveis (`personalizarCorCalendario`/`personalizarCorColega`, `input[type=color]`) — cuidado ao mexer em `definirCalendarioSelecionado`: o campo `corHex` foi deliberadamente removido do objeto `update` do upsert para não resetar a cor customizada a cada toggle de visibilidade/gravável.

**Atualização 2026-07-23 — integração Calendário Alpha ↔ Bibble/IAlpha:**

- [x] Registrar cada tool em `src/lib/bibble/tools.ts` e em `CALENDAR_TOOL_NAMES` de `src/lib/bibble/calendar-tools.ts`
- [x] Rotear tools por `src/lib/bibble/tool-executor.ts`, passando apenas `userId`, role e permissões vindos do servidor
- [x] Documentar capacidade e regras de esclarecimento/confirmação em `src/lib/bibble/system-prompt.ts`
- [x] Em `src/app/api/bibble/chat/route.ts`, recarregar usuário `ATIVO`, role e `getPermissoesEfetivas(userId)` do banco; injetar a hora atual de `America/Sao_Paulo`
- [x] Executar chamadas sequencialmente e manter limites de 6 tools/turno, 12/requisição e 3 mutações de calendário
- [x] Para edição, consultar antes, carregar `google_event_id` + `etag` e usar patch parcial com `If-Match`
- [x] Para cancelamento, exigir confirmação em duas fases antes de chamar a action
- [x] Manter resolução de calendário/colega em allowlists server-side; ambiguidades retornam candidatos
- [x] Não expor `userId`, `colegaId`, `calendarId` nem e-mail de impersonation nos schemas das tools

**As 10 tools integradas:** `listar_calendarios_calendario`, `listar_eventos_calendario`, `criar_evento_calendario`, `editar_evento_calendario`, `cancelar_evento_calendario`, `consultar_disponibilidade_calendario`, `consultar_agenda_colega`, `criar_evento_calendario_colega`, `editar_evento_calendario_colega` e `cancelar_evento_calendario_colega`.

**Como adicionar ou alterar uma tool de calendário:**
1. Definir o contrato público em `src/lib/bibble/tools.ts`.
2. Adicionar nome, schema Zod estrito e executor em `src/lib/bibble/calendar-tools.ts`.
3. Rotear pelo `tool-executor.ts` sem aceitar identificadores de ownership do modelo.
4. Atualizar o `system-prompt.ts` quando a capacidade ou regra conversacional mudar.
5. Cobrir happy path e edge cases em `tests/bibble/`; alterações do cliente Google/edição parcial também exigem testes em `tests/google-calendar/`.
6. Preservar janela máxima de 60 dias, teto de 200 eventos, timezone SP, execução sequencial, confirmação de cancelamento e ETag/`If-Match`.

**Exemplo seguro:** “Mostre minha agenda de 2026-07-24 a 2026-07-31” consulta por intervalo exato. “Cancele a reunião X” primeiro lista o evento e pede confirmação; somente a resposta afirmativa seguinte permite executar `cancelar_evento_calendario` com id, ETag e `confirmado: true`.

**Regras permanentes:** escrita de colega continua exclusiva de Admin/CEO atual do banco. Configuração do módulo (ativação, calendários visíveis/graváveis, cores e concessão de compartilhamento) continua na UI. Esta integração não altera schema; qualquer mudança futura de banco volta a exigir Vault, backup e confirmação.

**Dívidas não bloqueantes registradas pelo Anubis:** rate limit cross-request, idempotência persistente e token persistente/específico para confirmação. Não confundir os limites/deduplicação da requisição atual com garantias persistentes.

**Atualização 2026-07-30 — cache-first, sincronização explícita e UI Agenda Alpha:**

- [x] O rebranding é apenas visual: `MODULOS_REGISTRY` exibe **Agenda Alpha**, mas rota `/PainelAlpha/CalendarioAlpha`, id e permissão `calendarioAlpha` permanecem estáveis.
- [x] O SSR da rota usa somente cache local. `listarEventosCache` não chama Google; sincronização passa exclusivamente por `sincronizarAgendaAlpha`.
- [x] O contrato de sync retorna resultado por calendário (`sincronizado`, `cooldown`, `em_andamento`, `erro`), contadores, falhas sanitizadas e última sincronização. Dedupe/cooldown são apenas in-process; não tratá-los como lock distribuído.
- [x] Cache + `syncToken` são persistidos atomicamente só após todas as páginas. Em `410 Gone`, o full sync de recuperação é obtido antes de substituir o snapshot/cursor anterior.
- [x] `GoogleCalendarConexao.ultimaSincronizacaoEm` só avança após sucesso integral da conexão; falha parcial não produz marcador falso.
- [x] Antes de editar, o servidor recarrega detalhes completos com sessão, permissão e ownership. PATCH parcial usa `If-Match`/ETag; descrição, metadados de participantes e Google Meet são preservados quando ausentes do payload.
- [x] Invalidação entre abas/iframes usa `BroadcastChannel`, fallback `storage`/evento DOM e dedupe/agregação para evitar refresh em loop.
- [x] Sidebar, status e overlays usam `AgendaSidebar`, `StatusSincronizacao` e `AgendaModal3D`/`AgendaOverlays`; desktop tem profundidade 3D e mobile usa Sheet responsivo, preservando foco e reduced motion.
- [x] Privacidade DWD de colegas: usuário comum vê apenas disponibilidade “Ocupado”; Admin/CEO conserva detalhes e CRUD.

**Contrato operacional:** agendas compartilhadas continuam fora do cache SSR e são consultadas ao vivo somente após ação explícita. A Fase 2A concluiu fila, lease/fencing, push, webhook, worker, maintenance, CLIs, flags e observabilidade, todos mantidos flags-off. 183 testes Agenda Alpha, Forge build/lint/schema, Probe, Anubis, Lens e Sage passaram; typecheck conserva quatro baselines externos.

**Atualização 2026-07-31 — contrato responsivo do viewport:**

- [x] `CalendarioAlpha/layout.tsx` fornece a altura do viewport; `CalendarioAlphaDashboard.tsx` propaga `h-full`/`min-h-0` até o conteúdo.
- [x] `AgendaSidebar.tsx` mantém ações fixas e rolagem apenas nas listas, com Sheet e alvos de toque preservados no mobile.
- [x] `VisaoMes.tsx` preenche seis linhas flexíveis; `GradeHoraria.tsx` mantém cabeçalhos fixos e rolagem apenas na grade de horas.
- [x] `ConteudoAgenda.tsx` mantém a visão anual em scroll interno.

**Editado quando:** qualquer wrapper/layout da Agenda mudar altura, flex ou overflow; conferir a cadeia completa até cada visão para evitar corte de funções ou retorno da rolagem externa.

**Última atualização:** 2026-07-30 por Scribe

---

### Consulta RADAR (Habilitação Radar) — gate de permissão + botão "Excluir do banco"

**Adicionado em:** 2026-07-21 por Scribe (sessão Bibble)

**Rota:** `/PainelAlpha/HabilitacaoRadar` (sem mudança de URL). **Menu:** via `MODULOS_REGISTRY` (`id: 'radar'`, sem mudança). **Permissão necessária:** `radar` — **agora efetivamente checada**, o que não acontecia antes desta sessão.

**O que mudou no wiring:**
- `page.tsx` deixou de ser um Client Component monolítico e virou Server Component fino: `auth()` → se não-admin, `getPermissoesEfetivas(userId)` → redireciona para `/PainelAlpha` se `!perms.includes("radar")`. Renderiza `<HabilitacaoRadarClient />` (`src/components/ComponentesRadar/HabilitacaoRadarClient.tsx`, novo arquivo, todo o conteúdo antigo movido sem alteração de lógica).
- Botão novo "Excluir do banco" em `BotoesModal.tsx` chama `onDeletarDoBanco` (prop) → `handleDeletarDoBanco` (em `HabilitacaoRadarClient.tsx`) → Server Action `deletarRegistrosBanco` (`src/actions/RadarAction.ts`, já existia, ganhou `auth()`).

**⚠️ Checkpoint para novos módulos/auditorias:** antes desta sessão, `HabilitacaoRadar/page.tsx` era um dos módulos onde a URL era acessível a qualquer usuário logado, sem checar a permissão do módulo (`MODULOS_REGISTRY.permission`) — só o menu escondia o link, não a rota em si. Isso só foi pego porque o Anubis audita toda vez que uma feature nova mexe em algo destrutivo. **Ao tocar em qualquer módulo para adicionar uma capacidade nova (especialmente destrutiva), verificar se a `page.tsx` é um Server Component com o gate de permissão (`auth()` + `getPermissoesEfetivas()`) ou um Client Component monolítico sem esse gate** — o segundo caso é uma lacuna a corrigir, seguindo o padrão de `Apresentacoes/page.tsx`.

**Última atualização:** 2026-07-21 por Scribe

---

### Model novo relacionando com `documentos` ou `usuarios` — relação reversa nos dois lados

**Adicionado em:** 2026-07-22 por Scribe (feature: Confirmação de Leitura de Documento)

Prisma exige a relação declarada nos DOIS models quando há `@relation` — ao criar `ConfirmacaoLeituraDocumento` com FK pra `documentos` e `usuarios`, foi preciso adicionar `confirmacoes ConfirmacaoLeituraDocumento[]` dentro de `documentos` e `confirmacoesLeituraDocumento ConfirmacaoLeituraDocumento[]` dentro de `usuarios` — sem isso, `prisma generate` falha ou o client não expõe os tipos esperados. Ao criar qualquer model novo com FK para `usuarios`/`documentos`/outro model existente, sempre voltar e editar o model-alvo também.

**Também registrado:** mesmo para uma migration classificada 🟢 (CREATE TABLE puro, sem risco), se o usuário pedir explicitamente um backup fresco antes (em vez de aceitar o backup diário já dentro das 48h), gerar via script pontual Node (`@libsql/client`, mesma técnica dos backups diários — dump completo schema+dados por tabela dentro de uma transação de leitura) salvo em `database-backups/pre-change/`, e só then rodar a migration (script pontual separado, descartado depois, confirmado via `PRAGMA`).

---

### Alpha Blueprint — módulo novo (MVP completo)

**Adicionado em:** 2026-07-27 por Scribe (sessão Bibble, execução completa da fila `prompt-phases/`)

**Checklist de integração:**
- [x] Aparece no menu/sidebar — via `MODULOS_REGISTRY` (`id: 'blueprint'`, ícone `Compass` adicionado ao `ICON_MAP` de `GlobalSidebar.tsx`)
- [x] Permissão administrável pelo Admin — automática via `MODULOS_GERENCIAVEIS` (deriva do registry em `ModalGerenciarSetor.tsx`/`ModalOverrideUser.tsx`/`PreviewModulosSetor.tsx`, confirmado por leitura direta do código nesta sessão — sem edição manual adicional necessária)
- [x] Pode ser fixado como atalho — mecanismo de atalhos (`usuarios.atalhos`) referencia módulos pelo `id` do registry, qualifica automaticamente
- [x] Rota protegida por permissão de módulo — `AlphaBlueprint/page.tsx` chama `auth()` + `getPermissoesEfetivas()` e redireciona se `!perms.includes("blueprint")` (Admin/CEO bypassa), seguindo o padrão dos ~7 módulos que já fazem esse check explícito (ver checkpoint do RADAR acima)
- [x] Rota do projeto (`/PainelAlpha/AlphaBlueprint/[projectId]`) — ownership por projeto verificado via `ObterProjetoBlueprint` → `exigirAcessoBlueprint`, não apenas permissão de módulo

**Permissão por PROJETO é um conceito novo, além da permissão de módulo:** diferente de todo o resto do painel (que só tem permissão de módulo, tudo-ou-nada), o Blueprint tem uma segunda camada — `BlueprintMember` com 5 roles (Proprietário/Administrador/Editor/Comentarista/Visualizador) × 14 ações granulares (`src/lib/blueprint/ownership.ts`). Ter a permissão de módulo `blueprint` só dá acesso ao Dashboard/Kanban (ver quais projetos existem, criar novo); para abrir/editar um projeto específico é preciso ser membro dele (ou Admin/CEO global). Ao integrar qualquer feature nova que leia/escreva dados de um projeto do Blueprint, **sempre** usar `exigirAcessoBlueprint(projectId, userId, role, acao)` — nunca confiar só na permissão de módulo.

**Upload usa store de Vercel Blob dedicado**, não o `IACHAT_*` compartilhado do Bibble nem UploadThing (que está no `package.json` mas nunca foi configurado no projeto real). Env vars `BLUEPRINT_STORE_ID`/`BLUEPRINT_READ_WRITE_TOKEN` em `.env.local`. Se um módulo futuro precisar de um store de Blob próprio, seguir esse mesmo padrão (token dedicado identifica o store automaticamente no `put()`, sem precisar passar `storeId` — a versão instalada do SDK não aceita esse parâmetro).

**⚠️ Lição de IDOR para toda action que recebe `entityId` + `projectId` como parâmetros separados:** validar acesso ao `projectId` (via `exigirAcessoBlueprint`) NÃO é suficiente — é preciso também confirmar que a entidade (`fileId`/`documentId`/`boardId`/etc) de fato pertence a esse `projectId` antes de `update`/`delete`, senão um usuário com acesso legítimo a QUALQUER projeto pode alterar/apagar entidades de outros projetos. 6 ocorrências desse bug foram encontradas e corrigidas nesta sessão (Anubis) em `BlueprintFiles.ts`/`BlueprintDocuments.ts`/`BlueprintBoards.ts`. O padrão correto (já usado desde o início em `Requirements`/`Questions`/`Comments`/`Members`) é resolver o `projectId` a partir do PRÓPRIO registro buscado por `entityId`, nunca confiar no `projectId` do parâmetro para a mutação em si — só usá-lo para o gate de acesso.

**Editado quando:** Camada 2 (evolução avançada) começar, ou se outro módulo precisar do mesmo padrão de permissão granular por registro.

**Última atualização:** 2026-07-27 por Scribe
