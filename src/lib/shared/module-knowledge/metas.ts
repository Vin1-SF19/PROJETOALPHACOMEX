import type { ManualModulo } from "./types";

export const MANUAL_ALPHA_METAS: ManualModulo = {
  id: "alpha-metas",
  nome: "Alpha Metas",
  rota: "/PainelAlpha/Metas",
  permissao: "metas",
  rolesComAcesso: ["Lider Comercial"],
  aliases: ["metas", "alpha metas", "meta comercial", "painel de metas"],
  resumo:
    "Painel de performance comercial que reúne metas individuais e da equipe, vendas confirmadas, gerenciamento de leads/contratos, justificativas e modo TV.",
  topicos: [
    {
      id: "dashboard",
      titulo: "Entender o dashboard e o ranking",
      aliases: ["dashboard", "ranking", "progresso", "vendas", "performance"],
      conteudo: `O dashboard ordena os colaboradores comerciais pela quantidade de vendas do período e mostra ranking, avatar, vendas realizadas, meta individual e barra de progresso. A meta da equipe aparece no cabeçalho. Só contam contratos FECHADOS, marcados para contar como venda e com pagamento confirmado no mês consultado. Atualmente os serviços que contam como venda são Revisão RADAR 150K e Revisão RADAR ILIMITADO. O painel recebe atualizações em tempo real quando uma venda é confirmada.`,
    },
    {
      id: "configurar-metas",
      titulo: "Configurar metas individuais e da equipe",
      aliases: ["configurar metas", "meta individual", "meta da equipe", "ocultar colaborador", "visibilidade"],
      conteudo: `1. Abra Alpha Metas.
2. Clique em **Configurar Metas**. O botão aparece para Admin, CEO, TI e Líder Comercial.
3. Informe a meta mensal da equipe.
4. Informe a meta individual de cada colaborador comercial.
5. Use o controle de visibilidade para mostrar ou ocultar o colaborador no painel.
6. Salve. A configuração vale para o mês e ano selecionados.`,
    },
    {
      id: "gerenciamento-leads",
      titulo: "Usar o Gerenciamento de Leads",
      aliases: ["gerenciamento de leads", "leads", "contratos enviados", "arquivados", "fechados"],
      conteudo: `1. No cabeçalho de Alpha Metas, clique em **Gerenciamento de Leads**.
2. Escolha mês e ano. Contratos fechados usam a data de confirmação do pagamento; Enviados e Arquivados continuam disponíveis independentemente do mês.
3. O painel próprio mostra os registros do usuário. Admin, Líder Comercial e Financeiro podem alternar para o painel global e filtrar por colaborador.
4. Em **Enviados**, é possível editar, registrar observações positivas/negativas/neutras, confirmar fechamento, arquivar ou excluir conforme a permissão. Registros enviados há mais de 24 horas ficam destacados como atrasados.
5. Em **Arquivados**, é possível restaurar o registro.
6. **Contratos Fechados** mostra os negócios concluídos e o valor total do período.`,
    },
    {
      id: "novo-cliente",
      titulo: "Cadastrar um novo lead/contrato",
      aliases: ["novo cliente", "cadastrar cliente", "cadastrar lead", "novo contrato", "adicionar lead"],
      conteudo: `No Alpha Metas, o botão **Novo Cliente** abre o cadastro de um lead/Contrato Comercial; ele ainda não cria imediatamente um cliente no CS & NPS.

1. Abra **Gerenciamento de Leads** e clique em **Novo Cliente**.
2. Informe o CNPJ e consulte a Receita Federal, ou marque empresa em constituição.
3. Preencha valor, forma de pagamento, serviço e closer.
4. Se necessário, inclua os sócios.
5. Escolha o canal de aquisição: tráfego pago Meta/Instagram, tráfego pago Google, indicação de parceiros, indicação de clientes, WhatsApp, Instagram, orgânico, evento, prospecção ativa ou outro. Para parceiro cadastrado, selecione-o na lista e, se precisar, abra os detalhes somente leitura de documento, nível, contato, endereço e representantes.
6. Salve. O registro entra em Enviados.

O cliente do CS & NPS é criado ou reativado somente quando o pagamento/fechamento é confirmado.`,
    },
    {
      id: "prospeccao-ativa",
      titulo: "Registrar e reutilizar uma prospecção ativa",
      aliases: ["prospecção ativa", "nova prospecção", "canal de prospecção", "lista de prospecções"],
      conteudo: `1. No formulário do lead/contrato, escolha **Prospecção ativa** no Canal de Aquisição.
2. Se ainda não houver opções cadastradas, descreva a prospecção no input obrigatório.
3. Salve o lead. O texto passa a integrar o catálogo compartilhado de prospecções.
4. Nos próximos cadastros, escolha uma prospecção já usada no select.
5. Para alimentar outro valor, selecione **Adicionar nova prospecção**, preencha o input e salve. Valores iguais com diferença apenas de caixa ou espaçamento não são duplicados.`,
    },
    {
      id: "fechar-contrato",
      titulo: "Confirmar fechamento e pagamento",
      aliases: ["fechar contrato", "confirmar pagamento", "confirmar venda", "contrato assinado"],
      conteudo: `1. Em Gerenciamento de Leads > Enviados, localize o contrato.
2. Clique na ação de fechamento.
3. Confirme o pagamento e informe/anexe o contrato assinado quando exigido.
4. Ao concluir, o contrato muda para FECHADO, o cliente é criado ou reativado no CS & NPS e o dashboard de Metas é atualizado.
5. Se houver parceiro cadastrado como indicador, a indicação é criada e o nível do parceiro é recalculado.`,
    },
    {
      id: "parceiro-nao-cadastrado",
      titulo: "Registrar indicação de parceiro não cadastrado",
      aliases: ["parceiro não cadastrado", "outro parceiro", "indicação de parceiro", "parceiro pendente"],
      conteudo: `1. No formulário do lead/contrato, escolha **Indicação de parceiros** no canal de aquisição.
2. Ao final da lista, selecione **Outro parceiro / Não cadastrado**.
3. Informe o nome do parceiro (obrigatório). Empresa e telefone são opcionais.
4. Se quiser cancelar, clique novamente no mesmo botão **Outro parceiro / Não cadastrado** para voltar à lista de parceiros cadastrados.
5. Salve o lead. O sistema não cria um parceiro incompleto.
6. No módulo Parceiros, responsáveis com permissão de edição verão a pendência na gaveta de cadastros.
7. Abra a gaveta, clique em **Finalizar cadastro**, revise os dados pré-preenchidos e conclua o cadastro manual. O parceiro será vinculado ao contrato.`,
    },
    {
      id: "justificativa-meta",
      titulo: "Consultar ou gerenciar a justificativa de meta",
      aliases: ["justificativa", "justificativa de meta", "pdf da meta", "histórico da meta"],
      conteudo: `O botão **Justificativa de Meta** fica visível no cabeçalho. Usuários do módulo consultam o PDF vigente. Gestores podem escolher mês/ano, enviar um PDF de até 15 MB, confirmar a substituição do vigente, consultar o histórico e excluir a justificativa vigente. O arquivo é privado e exige autenticação.`,
    },
    {
      id: "modo-tv",
      titulo: "Usar o modo TV e as celebrações",
      aliases: ["modo tv", "telão", "celebração", "som da meta"],
      conteudo: `Clique em **Modo TV** no cabeçalho para ocultar os controles e ajustar automaticamente as linhas do ranking à tela, sem rolagem. Vendas confirmadas e metas atingidas podem exibir celebrações e som. A mesma celebração é deduplicada durante a sessão para não repetir continuamente.`,
    },
  ],
};
