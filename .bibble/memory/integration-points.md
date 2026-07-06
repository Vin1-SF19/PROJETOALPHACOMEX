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
