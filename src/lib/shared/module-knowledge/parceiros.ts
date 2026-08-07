import type { ManualModulo } from "./types";

export const MANUAL_PARCEIROS: ManualModulo = {
  id: "parceiros",
  nome: "Parceiros",
  rota: "/PainelAlpha/Parceiros",
  permissao: "parceiros",
  aliases: ["parceiros", "alpha parceiros", "módulo de parceiros", "modulo de parceiros"],
  resumo:
    "Gestão de parceiros, indicações, convites, pré-cadastros, níveis, comissões, termos, comprovantes e acesso ao portal.",
  topicos: [
    {
      id: "dashboard",
      titulo: "Entender o dashboard de Parceiros",
      aliases: ["dashboard", "cards", "estatísticas", "lista de parceiros"],
      conteudo: `O dashboard mostra totais por nível (Gold, Platinum e Black), parceiros pendentes vindos do Alpha Metas, filtros e cards. Cada card informa nível/comissão, PF ou PJ, status de acesso, termo, primeira indicação, documento e e-mail. Clique no card para abrir o detalhe.`,
    },
    {
      id: "buscar-filtrar",
      titulo: "Buscar e filtrar parceiros",
      aliases: ["buscar", "pesquisar", "filtrar", "filtro por nível"],
      conteudo: `Use a busca para localizar por nome, documento ou e-mail. O filtro de nível limita a lista a GOLD, PLATINUM ou BLACK. Os filtros atualizam a URL, então a pesquisa pode ser recarregada ou compartilhada sem perder o estado.`,
    },
    {
      id: "cadastrar-parceiro",
      titulo: "Cadastrar um parceiro manualmente",
      aliases: ["cadastrar parceiro", "novo parceiro", "adicionar parceiro", "cadastro manual"],
      conteudo: `1. No dashboard Parceiros, clique em **Novo Parceiro**.
2. Escolha PF ou PJ e faça a consulta opcional de CPF/CNPJ.
3. Selecione o tipo: Padrão (comissão pelo nível), Sem comissão ou Especial (percentual fixo).
4. Preencha dados cadastrais, endereço e dados bancários/Pix.
5. Para PF, informe o WhatsApp. Para PJ, cadastre ao menos um responsável físico; outros responsáveis podem ser adicionados.
6. Salve. O sistema gera uma senha segura e exibe login e senha uma única vez para cópia/envio.`,
    },
    {
      id: "vincular-cliente",
      titulo: "Vincular um cliente por uma nova indicação",
      aliases: ["cadastrar cliente", "novo cliente", "nova indicação", "vincular cliente", "indicação"],
      conteudo: `O módulo Parceiros **não cadastra um cliente novo**. Ele vincula a um parceiro uma empresa/cliente que já existe no CS & NPS.

1. Clique em **Indicação** no dashboard.
2. Selecione o parceiro.
3. Busque e selecione o cliente/empresa já cadastrado no CS & NPS.
4. Confirme o vínculo. Clientes já vinculados ficam indisponíveis.

Se o cliente ainda não existe, cadastre o lead/contrato no Alpha Metas e confirme o fechamento/pagamento; esse fluxo cria ou reativa o cliente no CS & NPS.`,
    },
    {
      id: "convidar-parceiro",
      titulo: "Convidar um parceiro para pré-cadastro",
      aliases: ["convidar", "convite", "pin", "link de convite"],
      conteudo: `1. Abra **Ações > Convidar parceiro**.
2. Escolha a validade do convite (1, 3, 7, 15 ou 30 dias).
3. Gere o link e o PIN.
4. Copie ou envie a mensagem preparada.
5. O convite é de uso único e pode ser listado, reaberto ou revogado enquanto válido.
6. O convidado preenche o wizard público com PIN, dados pessoais, endereço, área de atuação, PF/PJ, empresa/responsáveis e termo quando houver.`,
    },
    {
      id: "pre-cadastros",
      titulo: "Revisar e aprovar pré-cadastros",
      aliases: ["pré-cadastro", "pre cadastro", "aprovar parceiro", "rejeitar parceiro", "notificação"],
      conteudo: `1. Abra o sino de notificação ou **Ações > Pré-cadastros**.
2. Consulte as abas Pendentes, Aprovados e Rejeitados.
3. Revise as respostas do candidato.
4. Aprove para criar o parceiro real e gerar credenciais, ou rejeite informando a decisão.
5. Um item rejeitado pode ser revertido por uma aprovação posterior.`,
    },
    {
      id: "finalizar-pendente-metas",
      titulo: "Finalizar parceiro não cadastrado vindo do Alpha Metas",
      aliases: ["pendente do metas", "parceiro pendente", "não cadastrado", "finalizar cadastro"],
      conteudo: `1. No topo do dashboard, localize **Parceiros não cadastrados**.
2. O card mostra nome, empresa/telefone disponíveis, cliente indicado e data.
3. Clique em **Finalizar cadastro**.
4. Revise os dados pré-preenchidos e complete o cadastro manual.
5. Ao salvar, o parceiro é criado e vinculado ao contrato de origem. Se o contrato já estava fechado, a indicação ao cliente também é regularizada.`,
    },
    {
      id: "detalhe-edicao",
      titulo: "Consultar e editar um parceiro",
      aliases: ["editar parceiro", "detalhe", "dados bancários", "responsáveis", "senha"],
      conteudo: `Clique no card do parceiro. A página de detalhe reúne empresas indicadas, dados cadastrais, descrição, banco/Pix, endereço, representantes e acesso. Usuários autorizados podem editar cadastro, tipo/comissão especial, banco/Pix, endereço e responsáveis. Alterar dados bancários invalida a confirmação anterior. Admin pode redefinir senha temporária e desvincular indicação.`,
    },
    {
      id: "comprovantes",
      titulo: "Gerenciar comprovante de comissão",
      aliases: ["comprovante", "comprovante de comissão", "upload comissão"],
      conteudo: `No detalhe do parceiro, expanda a indicação e use a ação de comprovante. Admin ou usuário com permissão de edição pode enviar, substituir, visualizar metadados ou remover o comprovante de comissão.`,
    },
    {
      id: "niveis-comissoes",
      titulo: "Entender níveis e comissões",
      aliases: ["nível", "gold", "platinum", "black", "comissão", "percentual"],
      conteudo: `Padrão: GOLD 5%, PLATINUM 10% e BLACK 15%. A primeira contratação leva a GOLD; a segunda em até 60 dias leva a PLATINUM; a terceira em até 60 dias leva a BLACK. Intervalo ou inatividade superior a 60 dias reinicia/rebaixa para GOLD. A comissão histórica da indicação usa o nível no momento da contratação. A base exibida é o valor do contrato menos 19,53% de tributos. Parceiros Sem comissão ou Especiais substituem essa regra.`,
    },
    {
      id: "termos-acesso",
      titulo: "Gerenciar termo e controle de acesso",
      aliases: ["termo", "termo de adesão", "controle de acesso", "permissões", "portal"],
      conteudo: `Admin usa **Ações > Atualizar termo** para publicar uma nova versão imutável e consultar o histórico. Em **Controle de acesso**, pode liberar a usuários internos as capacidades de editar, excluir e aprovar no módulo, além de configurar convite por parceiro. Nos cards, Admin também pode ativar ou desativar o acesso do parceiro ao portal.`,
    },
    {
      id: "excluir-parceiros",
      titulo: "Excluir parceiros em lote",
      aliases: ["excluir", "apagar parceiro", "exclusão em massa"],
      conteudo: `Usuários com permissão de exclusão ativam o modo de seleção pelo botão de lixeira, marcam um ou mais cards e confirmam a exclusão permanente. Antes de confirmar, revise os nomes exibidos no diálogo, pois a ação não pode ser desfeita.`,
    },
  ],
};
