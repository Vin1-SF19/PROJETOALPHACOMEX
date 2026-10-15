import { normalizeRole } from "../roles";

export type CategoriaInicialChamado = {
  nome: string;
  descricao: string;
  ordem: number;
};

// Somente sugestões para provisionamento explícito. Leituras do aplicativo
// consultam o catálogo persistido e nunca criam ou reativam categorias.
const CATALOGO: Record<string, ReadonlyArray<readonly [string, string]>> = {
  TI: [
    ["Hardware", "Equipamentos e infraestrutura física"],
    ["Software", "Sistemas, aplicativos e atualizações"],
    ["Rede", "Conexão, VPN e acesso remoto"],
    ["Acesso", "Login, senhas e permissões"],
  ],
  ADMIN: [
    ["Compras e suprimentos", "Solicitação de compras e materiais"],
    ["Documentos administrativos", "Documentos, registros e apoio administrativo"],
    ["Infraestrutura e patrimônio", "Estrutura, equipamentos e patrimônio"],
  ],
  CEO: [
    ["Aprovação estratégica", "Solicitações que exigem decisão da direção"],
    ["Priorização e decisão", "Definição de prioridades e direcionamento"],
    ["Assuntos institucionais", "Demandas institucionais e representação"],
  ],
  OPERACIONAL: [
    ["Processos de importação", "Apoio no andamento dos processos"],
    ["Desembaraço e documentação", "Documentos e exigências do desembaraço"],
    ["Logística e entrega", "Transporte, acompanhamento e entregas"],
  ],
  COMERCIAL: [
    ["Propostas e cotações", "Preparação e revisão de condições comerciais"],
    ["Clientes e oportunidades", "Atendimento de clientes e oportunidades"],
    ["Pós-venda", "Acompanhamento e apoio após a contratação"],
  ],
  LIDERCOMERCIAL: [
    ["Aprovação comercial", "Aprovação de condições e negociações"],
    ["Metas e distribuição de carteira", "Metas, carteira e distribuição de oportunidades"],
    ["Apoio à negociação", "Orientação e suporte em negociações"],
  ],
  RECURSOSHUMANOS: [
    ["Férias e ausências", "Solicitações de férias, ausências e afastamentos"],
    ["Folha e benefícios", "Dúvidas sobre folha e benefícios"],
    ["Documentos e admissão", "Documentação de colaboradores e admissões"],
  ],
  FINANCEIRO: [
    ["Pagamentos e reembolsos", "Pagamentos, adiantamentos e reembolsos"],
    ["Contas a receber", "Recebimentos e acompanhamento de cobranças"],
    ["Conciliação e comprovantes", "Conferência de valores e comprovantes"],
  ],
  JURIDICO: [
    ["Contratos", "Elaboração e revisão de contratos"],
    ["Pareceres e dúvidas", "Orientações e análise jurídica"],
    ["Notificações e prazos", "Demandas formais e acompanhamento de prazos"],
  ],
  PARCEIRO: [
    ["Apoio ao parceiro", "Dúvidas e solicitações de parceiros"],
    ["Documentação de parceria", "Documentos e registros da parceria"],
    ["Integração operacional", "Alinhamento e integração entre equipes"],
  ],
  SERVICOSGERAIS: [
    ["Limpeza e conservação", "Limpeza e conservação dos ambientes"],
    ["Manutenção predial", "Reparos e manutenção das instalações"],
    ["Apoio e organização de ambientes", "Preparação e organização dos espaços"],
  ],
  MARKETING: [
    ["Comunicação e conteúdo", "Textos, comunicados e conteúdo institucional"],
    ["Materiais e identidade visual", "Peças, apresentações e materiais de marca"],
    ["Campanhas e divulgação", "Planejamento e apoio às campanhas"],
  ],
  ADMINISTRATIVO: [
    ["Processos administrativos", "Rotinas e solicitações administrativas"],
    ["Documentos e registros", "Organização e conferência de documentos"],
    ["Materiais e suprimentos", "Materiais e apoio às rotinas do escritório"],
  ],
};

export function getCategoriasIniciaisDoSetor(nomeSetor: string): CategoriaInicialChamado[] {
  if (normalizeRole(nomeSetor) === "DESVINCULADO") return [];
  const sugestoes = CATALOGO[normalizeRole(nomeSetor)] ?? [];
  return [...sugestoes, ["Outros do setor", "Outras solicitações destinadas a este setor"] as const]
    .map(([nome, descricao], ordem) => ({ nome, descricao, ordem }));
}
