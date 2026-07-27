export interface ModuloRegistryItem {
  id: string;
  label: string;
  href: string;
  iconName: string;
  category: string;
  permission: string | null;
  adminOnly?: boolean;
  allowedRoles?: string[];
  img?: string;
  desc?: string;
  tag?: string;
  color?: string;
}

export interface CategoriaItem {
  id: string;
  label: string;
  color: string;
  activeColor: string;
  iconName: string;
  adminOnly?: boolean;
}

export const MODULOS_REGISTRY: ModuloRegistryItem[] = [
  // ─── OPERACIONAL ───
  { id: 'chamados',           label: 'Chamados',              href: '/PainelAlpha/Chamados',                                                         iconName: 'MessageSquare', category: 'operacional', permission: 'chamados',           img: '/discussion_655664.png',   desc: 'Suporte técnico e registro de incidentes.',             tag: 'Suporte',    color: 'from-amber-600/20' },
  { id: 'checkList',          label: 'Alpha CheckList',       href: '/PainelAlpha/CheckList',                                                        iconName: 'CheckSquare',   category: 'operacional', permission: 'checkList',          img: '/test.png',               desc: 'Checklists operacionais e de conformidade.',            tag: 'CheckList',  color: 'from-pink-600/20' },
  { id: 'tarefasComercial',   label: 'Tarefas Comercial',     href: '/PainelAlpha/PainelTarefas/PainelTarefaC',                                      iconName: 'ListTodo',      category: 'operacional', permission: 'tarefasComercial',   img: '/planning.png',           desc: 'Bancada de tarefas do time comercial.',                 tag: 'Comercial',  color: 'from-pink-600/20' },
  { id: 'gerenciamentoTarefas', label: 'Ger. Tarefas',        href: '/PainelAlpha/PainelTarefas/GerenciarTarefas/GerenciamentoUserTarefa',            iconName: 'ClipboardList', category: 'operacional', permission: 'gerenciamentoTarefas', img: '/task-management.png',  desc: 'Gerenciamento central de tarefas.',                     tag: 'Tarefas',    color: 'from-pink-600/20' },
  { id: 'Reservas',           label: 'Reserva de Salas',      href: '/PainelAlpha/ReservaSalas',                                                     iconName: 'CalendarDays',  category: 'operacional', permission: 'Reservas',           img: '/icons8-sala-de-reuniões-64.png', desc: 'Agendamento de salas com controle de horários.', tag: 'Facilities', color: 'from-emerald-600/20' },
  { id: 'calendarioAlpha',    label: 'Calendário Alpha',      href: '/PainelAlpha/CalendarioAlpha',                                                  iconName: 'CalendarClock', category: 'operacional', permission: 'calendarioAlpha',   img: '/google.png',                      desc: 'Sua agenda Google conectada ao Painel.',         tag: 'Agenda',     color: 'from-blue-600/20' },
  { id: 'ServiçosGerais',     label: 'Serviços Gerais',       href: '/PainelAlpha/PainelTarefas/painelTarefaSG',                                     iconName: 'Wrench',        category: 'operacional', permission: 'ServiçosGerais',    img: '/cleaning.png',           desc: 'Bancada de tarefas diárias dos serviços gerais.',       tag: 'Serviços',   color: 'from-pink-600/20' },

  // ─── COMERCIAL ───
  { id: 'crm',                label: 'Alpha CRM',             href: '/PainelAlpha/AlphaCRM',                                                         iconName: 'BarChart3',     category: 'comercial',   permission: 'crm',               img: '/management.png',         desc: 'Pipeline, contatos, atividades e relatórios.',          tag: 'CRM',        color: 'from-violet-600/20' },
  { id: 'Cliente',            label: 'CS & NPS',              href: '/PainelAlpha/CadastroClientes',                                                 iconName: 'UserCheck',     category: 'comercial',   permission: 'Cliente',            img: '/local-na-rede-internet.png', desc: 'Controle de CS, NPS e feedbacks.',               tag: 'Clientes',   color: 'from-orange-600/20' },
  { id: 'parceiros',           label: 'Parceiros',              href: '/PainelAlpha/Parceiros',                                                        iconName: 'Handshake',     category: 'comercial',   permission: 'parceiros',          img: '/handshake.png',          desc: 'Cadastro e gestão de parceiros PF e PJ.',               tag: 'Parceiros',  color: 'from-yellow-600/20' },
  { id: 'leads',              label: 'Alpha Leads',           href: '/PainelAlpha/ControleLeads',                                                    iconName: 'Target',        category: 'comercial',   permission: 'leads',              img: '/security.png',           desc: 'Controle e qualificação de leads.',                     tag: 'Leads',      color: 'from-purple-600/20' },
  { id: 'marketing',          label: 'Alpha Marketing',       href: '/PainelAlpha/ControleLeads/Marketing',                                          iconName: 'Megaphone',     category: 'comercial',   permission: 'marketing',          img: '/marketing.png',          desc: 'Gestão de campanhas e materiais de marketing.',         tag: 'Marketing',  color: 'from-rose-600/20' },
  { id: 'instagramStudio',    label: 'Instagram Studio',      href: '/PainelAlpha/Marketing',                                                        iconName: 'Instagram',     category: 'comercial',   permission: 'instagramStudio',    img: '/icone-marketing.png',    desc: 'Painel de gestão de campanhas no Instagram.',           tag: 'Marketing',  color: 'from-pink-600/20' },
  { id: 'metas',              label: 'Alpha Metas',           href: '/PainelAlpha/Metas',                                                            iconName: 'Trophy',        category: 'comercial',   permission: 'metas',              img: '/revenue.png',            desc: 'Painel de metas e performance comercial.',              tag: 'Metas',      color: 'from-emerald-600/20', allowedRoles: ['Lider Comercial'] },
  { id: 'apresentacoes',      label: 'Alpha Presentation Studio', href: '/PainelAlpha/Apresentacoes',                                                iconName: 'MonitorPlay',   category: 'comercial',   permission: 'apresentacoes',      img: '/planning.png',           desc: 'Editor de apresentações interativas em HTML.',          tag: 'Studio',     color: 'from-fuchsia-600/20' },
  { id: 'blueprint',          label: 'Alpha Blueprint',       href: '/PainelAlpha/AlphaBlueprint',                                                   iconName: 'Compass',       category: 'comercial',   permission: 'blueprint',          img: '/planning.png',           desc: 'Central de planejamento, especificação e acompanhamento de sistemas.', tag: 'Blueprint', color: 'from-cyan-600/20' },

  // ─── FINANCEIRO ───
  { id: 'Extratos',           label: 'Extratos Bancários',    href: '/PainelAlpha/ExtratosBancarios',                                                iconName: 'Landmark',      category: 'financeiro',  permission: 'Extratos',           img: '/taxa.png',               desc: 'Análise de extratos bancários.',                        tag: 'Financeiro', color: 'from-slate-600/20' },
  { id: 'analise',            label: 'Pré Análise',           href: '/PainelAlpha/SistemaPreAnalise',                                                iconName: 'FileSearch',    category: 'financeiro',  permission: 'analise',            img: '/document.png',           desc: 'Sistema de pré análise e gerador de ficha de reunião.', tag: 'Análise',    color: 'from-purple-600/20' },
  { id: 'radar',              label: 'Consulta RADAR',        href: '/PainelAlpha/HabilitacaoRadar',                                                 iconName: 'ScanSearch',    category: 'financeiro',  permission: 'radar',              img: '/cargueiro.png',          desc: 'Consultas unitárias ou em lote via API.',               tag: 'RADAR',      color: 'from-blue-600/20' },
  { id: 'Perse',              label: 'Análise Fiscal',        href: '/PainelAlpha/AlphaConnect',                                                     iconName: 'Scale',         category: 'financeiro',  permission: 'Perse',              img: '/planejamento-tributario.png', desc: 'Análise prévia para oportunidades tributárias.',  tag: 'Fiscal',     color: 'from-green-600/20' },
  { id: 'holerites',          label: 'Alpha Holerites',       href: '/PainelAlpha/Holerites',                                                        iconName: 'FileText',      category: 'financeiro',  permission: 'holerites',          img: '/bank-check.png',         desc: 'Gestão de holerites digitais com assinatura Gov.br.',   tag: 'RH',         color: 'from-teal-600/20' },

  // ─── PESSOAS / CONHECIMENTO ───
  { id: 'schools',            label: 'Alpha Schools',         href: '/PainelAlpha/AlphaSchools',                                                     iconName: 'GraduationCap', category: 'pessoas',     permission: 'schools',            img: '/textbook.png',           desc: 'Plataforma de cursos e conteúdos educacionais.',        tag: 'Schools',    color: 'from-orange-600/20' },
  { id: 'skills',             label: 'Alpha Skills',          href: '/PainelAlpha/AlphaSkills',                                                      iconName: 'BookOpen',      category: 'pessoas',     permission: 'skills',             img: '/elearning.png',          desc: 'Trilhas de aprendizado e vídeos técnicos.',             tag: 'Skills',     color: 'from-green-600/20' },
  { id: 'Senhas',             label: 'Alpha Vault',           href: '/PainelAlpha/AlphaVault',                                                       iconName: 'KeyRound',      category: 'pessoas',     permission: 'Senhas',             img: '/senha.png',              desc: 'Gerenciamento de senhas e acessos corporativos.',       tag: 'Vault',      color: 'from-red-600/20' },

  // ─── INFRA / DOCS ───
  { id: 'Documentos',         label: 'POP',                   href: '/PainelAlpha/DocsAlpha',                                                        iconName: 'FileStack',     category: 'infra',       permission: 'Documentos',         img: '/arquivo.png',            desc: 'Documentos de guia e normas para funções.',             tag: 'POP',        color: 'from-indigo-600/20' },

  // ─── ADMIN ───
  { id: 'skillsGerenciamento', label: 'Ger. Alpha Skills', href: '/PainelAlpha/AlphaSkills/Gerenciamento', iconName: 'Settings', category: 'admin', permission: 'skillsGerenciamento', allowedRoles: ['Admin', 'CEO'], img: '/elearning.png', desc: 'Gerenciamento de cursos, módulos e vídeos do Alpha Skills.', tag: 'Admin', color: 'from-green-600/20' },
  { id: 'cadastro',              label: 'Gestão de Equipe',         href: '/PainelAlpha/cadastro',                                                      iconName: 'Users',         category: 'admin',       permission: 'cadastro',          adminOnly: true, allowedRoles: ['Admin', 'CEO'], img: '/people_10893485.png', desc: 'Gerenciamento de contas, permissões e usuários.',      tag: 'Admin',      color: 'from-purple-600/20' },
  { id: 'gestaoColaboradores',   label: 'Gestão de Colaboradores',  href: '/PainelAlpha/GestaoColaboradores',                                           iconName: 'UserCog',       category: 'admin',       permission: 'gestaoColaboradores', allowedRoles: ['RECURSOS HUMANOS', 'FINANCEIRO'],               img: '/developers.png',     desc: 'Visualização e edição de perfis de colaboradores.',    tag: 'RH',         color: 'from-teal-600/20' },
  { id: 'gestaoProtocolos',      label: 'Gestão de Protocolos',     href: '/PainelAlpha/GestaoProtocolos',                                              iconName: 'BookOpen',      category: 'admin',       permission: 'gestaoProtocolos',  allowedRoles: ['Admin', 'CEO', 'SUPORTE'],                      img: '/comments.png',        desc: 'Biblioteca de templates de protocolo para chamados.',  tag: 'Suporte',    color: 'from-violet-600/20' },
  { id: 'gestaoOnboarding',      label: 'Onboarding',               href: '/PainelAlpha/GestaoOnboarding',                                              iconName: 'Sparkles',      category: 'admin',       permission: null,                allowedRoles: ['Admin', 'CEO'],                                 img: '/onboarding.png',        desc: 'Templates de boas-vindas para novos colaboradores.',   tag: 'RH',         color: 'from-indigo-600/20' },
  { id: 'conectoresIAlpha',      label: 'Conectores IAlpha',        href: '/PainelAlpha/Conectores',                                                    iconName: 'Cable',         category: 'admin',       permission: 'conectoresIAlpha',  allowedRoles: ['Admin', 'CEO'],                                 img: '/local-na-rede-internet.png', desc: 'Fontes de conhecimento da IA: indexação, sincronização e bases.', tag: 'IAlpha', color: 'from-cyan-600/20' },
];

export const CATEGORIAS: CategoriaItem[] = [
  { id: 'operacional', label: 'Operacional',    color: 'text-blue-400',    activeColor: 'bg-blue-500/10 border-blue-500/30',   iconName: 'Briefcase' },
  { id: 'comercial',   label: 'Comercial',      color: 'text-indigo-400',  activeColor: 'bg-indigo-500/10 border-indigo-500/30', iconName: 'TrendingUp' },
  { id: 'financeiro',  label: 'Financeiro',     color: 'text-emerald-400', activeColor: 'bg-emerald-500/10 border-emerald-500/30', iconName: 'Landmark' },
  { id: 'pessoas',     label: 'Pessoas',        color: 'text-rose-400',    activeColor: 'bg-rose-500/10 border-rose-500/30',   iconName: 'Users' },
  { id: 'infra',       label: 'Infra & Docs',   color: 'text-amber-400',   activeColor: 'bg-amber-500/10 border-amber-500/30', iconName: 'Layers' },
  { id: 'admin',       label: 'Admin',          color: 'text-slate-400',   activeColor: 'bg-slate-500/10 border-slate-500/30', iconName: 'Shield', adminOnly: true },
];
