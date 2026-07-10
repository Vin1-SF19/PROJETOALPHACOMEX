# INTEGRATION POINTS — Pontos de Integração

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
