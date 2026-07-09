# COMPONENTS — Catálogo de Componentes

> Mantido por: Nova (frontend) e Scribe (cartógrafo)
> Consultar SEMPRE antes de criar um novo componente.

---

## Template de entrada

```
### [NomeDoComponente]
**Arquivo:** `src/components/[caminho].tsx`
**Tipo:** Server Component | Client Component
**Props:** [lista das props principais]
**Uso:** `<NomeDoComponente prop1="..." />`
**Notas:** [quando usar, variantes disponíveis]
```

---

## Componentes

<!-- Adicionar aqui conforme o projeto cresce -->

### ConviteWizard (+ Step* + shared)
**Arquivo:** `src/components/Parceiros/Convite/ConviteWizard.tsx`
**Tipo:** Client Component
**Props:** `token: string`, `termo: { versao: string; conteudo: string } | null`
**Uso:** `<ConviteWizard token={token} termo={resultado.termo} />` em `src/app/convite/parceiro/[token]/page.tsx`
**Notas:** Wizard multi-step (7 telas) do convite público de parceiro, substituiu o form single-page `FormConviteParceiro.tsx` (deletado). Reaproveita o padrão de stepper visual do onboarding do AlphaParceiros (`OnboardingWizard.tsx`) e a lógica de busca de CEP do `ModalEndereco.tsx`. Estado do formulário inteiro num único `useState<ConviteFormData>` (tipo e helpers em `shared.tsx`: `Campo`, `inputCls`, `CardSecao`, `BotoesNavegacao`, `UFS`, `AREAS`). A etapa de Termos (`StepTermos.tsx`) só aparece se houver `ParceiroTermo` ativo — senão o submit ocorre direto ao fim de `StepEmpresa.tsx`. Ver fluxo completo em `integration-points.md`.

### StepPin
**Arquivo:** `src/components/Parceiros/Convite/StepPin.tsx`
**Tipo:** Client Component
**Props:** `pin: string`, `onChange: (patch: { pin: string }) => void`, `onNext: () => void`
**Uso:** primeira tela do `ConviteWizard` (step -1), antes da Apresentação.
**Notas:** só valida FORMATO (4 dígitos numéricos) client-side — a validação real do PIN contra o banco acontece no backend, na primeira tentativa de busca automática de CPF (`/api/convite/consulta-cpf`). Decisão consciente: evita gastar uma chamada paga só para validar o PIN isoladamente.

### ModalMensagemConvite
**Arquivo:** `src/components/Parceiros/ModalMensagemConvite.tsx`
**Tipo:** Client Component
**Props:** `open: boolean`, `onClose: () => void`, `link: string`, `pin: string`, `template: { id, nome, mensagem } | null`
**Uso:** `<ModalMensagemConvite open onClose={...} link={...} pin={...} template={templateConvite} />` — montado como irmão independente em `ParceirosClient.tsx`, nunca dentro de `ModalConvidarParceiro`.
**Notas:** Espelha visualmente o `ModalCredenciais.tsx` (bloco "Mensagem de Boas-vindas" + botão copiar). Usa `substituirPlaceholders` para trocar `[LINK]`/`[PIN]`. Sem template ativo, cai em mensagem de fallback hardcoded.

### substituirPlaceholders (helper compartilhado)
**Arquivo:** `src/lib/onboarding-placeholders.ts`
**Tipo:** função pura (não componente, sem "use server" — importável por client e server)
**Uso:** `substituirPlaceholders(mensagem, { LOGIN: "...", SENHA: "..." })` ou `substituirPlaceholders(mensagem, { LINK: "...", PIN: "..." })`
**Notas:** Substitui `[CHAVE]` (formato atual) E `{chave}` minúsculo (formato legado, retrocompatibilidade). Usado por `ModalCredenciais.tsx` e `ModalMensagemConvite.tsx`. Se um novo tipo de template precisar de novos placeholders, basta passar o `Record<string,string>` correspondente — não precisa alterar o helper.

### Módulo Extratos Bancários (reescrito em 2026-07-09)
**Arquivo:** `src/components/Extratos/` (ExtratosListagem.tsx, ExtratoDetalhe.tsx, ModalNovaEmpresa.tsx, ModalVincularBanco.tsx, ModalNovoPeriodo.tsx, ModalUploadExtrato.tsx, ModalConferencia.tsx, ModalTransacoesSalvas.tsx, TabelaTransacoesPaginada.tsx, lib/{exportar-excel,bancos-catalogo,formatters}.ts)
**Tipo:** Client Components
**Uso:** `src/app/PainelAlpha/ExtratosBancarios/page.tsx` e `[Id]/page.tsx` ficam finos, só renderizam `<ExtratosListagem />`/`<ExtratoDetalhe extratoId={Id} />`.
**Notas:** Substitui completamente a estrutura antiga em `[Id]/Modais/` e `ModalCadastros/` (deletada). Primeiro módulo do painel a usar `AlertDialog` (exclusão de banco) e `Badge` (indicador "data incerta") do shadcn — ambos existiam mas nunca tinham sido adotados. `TabelaTransacoesPaginada` é o primeiro componente do painel com paginação server-side real (skip/take via Prisma) — reutilizável para outros módulos que precisem do mesmo padrão. `AnimatedShaderBackground` (`src/components/ui/animated-shader-background.tsx`) é o background de aurora shader (Three.js) usado atrás da listagem — pausa quando a aba não está visível, usa `ResizeObserver`, cores calibradas em indigo/slate. `Transacao.data` agora é `DateTime | null` — qualquer novo código que exiba transações deve tratar null com fallback pra `dataOriginalTexto` (ver `formatarDataTransacao` em `lib/formatters.ts`).

### enderecoResumo (helper local)
**Arquivo:** `src/components/Parceiros/ModalPreCadastros.tsx`
**Tipo:** função pura (não componente)
**Uso:** `enderecoResumo(preCadastro)` — monta endereço completo (`logradouro, número - complemento - bairro - cidade/UF`) se os campos estruturados novos estiverem presentes, com fallback para `município/UF` legado.
**Notas:** Usada na listagem de pré-cadastros pendentes para o admin ver o endereço coletado no wizard antes de aprovar.
