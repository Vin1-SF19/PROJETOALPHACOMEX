"use client";


import { getTema } from "@/lib/temas";
import { useSession } from "next-auth/react";
import {
  Rocket, Wrench, Bug, Sparkles, Shield, Zap,
  Users, FileText, BarChart3, Bell, Palette, Package,
  MessageCircle, Phone,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────
type ItemTipo = "novo" | "melhoria" | "fix" | "segurança";

interface ReleaseItem {
  tipo: ItemTipo;
  texto: string;
}

interface Release {
  versao: string;
  data: string;
  destaque?: boolean;
  titulo: string;
  subtitulo: string;
  icon: typeof Rocket;
  cor: string;
  grupos: {
    label: string;
    icon: typeof Rocket;
    items: ReleaseItem[];
  }[];
}

// ── Config das badges ─────────────────────────────────────
const TIPO_CONFIG: Record<ItemTipo, { label: string; cls: string }> = {
  novo:      { label: "NOVO",      cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  melhoria:  { label: "UPDATE",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  fix:       { label: "FIX",       cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  segurança: { label: "SEGURANÇA", cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

// ── Changelog ─────────────────────────────────────────────
const RELEASES: Release[] = [
  {
    versao: "2.5",
    data: "Maio 2026",
    destaque: true,
    titulo: "Protocolos & Automação",
    subtitulo: "Sistema de protocolos de chamados, integração WhatsApp e gestão dinâmica de setores",
    icon: Sparkles,
    cor: "text-emerald-400",
    grupos: [
      {
        label: "Sistema de Protocolos de Chamados",
        icon: FileText,
        items: [
          { tipo: "novo",     texto: "Sistema completo de protocolos de encerramento: causa raiz, solução técnica e mensagem final" },
          { tipo: "novo",     texto: "Modal de finalização em 2 etapas — Etapa 1 (causa + solução + template) → Etapa 2 (preview e envio)" },
          { tipo: "novo",     texto: "Biblioteca de templates de protocolo por categoria (Hardware, Software, Rede, Acesso, Financeiro, Outro, GERAL)" },
          { tipo: "novo",     texto: "Placeholders dinâmicos: [NOME], [PROTOCOLO], [SOLUCAO], [CAUSA], [RESPONSAVEL], [DATA], [CATEGORIA]" },
          { tipo: "novo",     texto: "Painel de Gestão de Protocolos com CRUD completo de templates — exclusivo Admin/CEO" },
          { tipo: "novo",     texto: "Botão 'Finalizar com Protocolo' em paralelo ao encerramento rápido existente — retrocompatível" },
          { tipo: "melhoria", texto: "Chamados agora registram campos: causa, mensagemFinal, templateId, closedAt" },
          { tipo: "melhoria", texto: "Histórico de chamados exibe badge 'Com protocolo' quando solução foi gerada via template" },
        ],
      },
      {
        label: "Integração WhatsApp",
        icon: MessageCircle,
        items: [
          { tipo: "novo",     texto: "Busca automática do telefone do solicitante no perfil (telefone_corporativo tem preferência sobre telefone pessoal)" },
          { tipo: "novo",     texto: "Botão 'WhatsApp' abre wa.me com número e mensagem preenchidos — sem API externa, zero configuração" },
          { tipo: "novo",     texto: "Formatação automática para padrão internacional BR (5547XXXXXXXX) — aceita qualquer formato de entrada" },
          { tipo: "novo",     texto: "Indicador visual 'WhatsApp disponível' / 'Sem telefone' no header do modal de protocolo" },
          { tipo: "novo",     texto: "Histórico de envios WhatsApp salvo (tabela whatsapp_log): chamado, usuário, telefone, mensagem, operador, horário" },
          { tipo: "melhoria", texto: "Arquitetura preparada para Evolution API / WhatsApp Cloud API sem refatoração futura" },
        ],
      },
      {
        label: "Gestão Dinâmica de Setores e Cargos",
        icon: Users,
        items: [
          { tipo: "novo",     texto: "Painel de Gestão de Setores: adicionar, excluir e visualizar setores com contagem de usuários em tempo real" },
          { tipo: "novo",     texto: "Aba de Cargos integrada — cargos influenciam a seleção no cadastro de usuários" },
          { tipo: "novo",     texto: "Setor/cargo base 'DESVINCULADO' protegido: ao excluir setor com usuários, estes são migrados automaticamente" },
          { tipo: "novo",     texto: "Botão 'Gerenciar Setores' no formulário de cadastro substitui lista estática — sem mais hardcode" },
          { tipo: "melhoria", texto: "Selects de setor em Gestão de Equipe e perfil de colaborador agora carregam do banco dinamicamente" },
          { tipo: "fix",      texto: "Setores Admin/CEO/DESVINCULADO protegidos contra exclusão — ícone de escudo indica proteção" },
        ],
      },
      {
        label: "Segurança — Identidade nas Server Actions",
        icon: Shield,
        items: [
          { tipo: "segurança", texto: "Todas as server actions leem identidade do usuário via auth() server-side — eliminado trust em dados do cliente" },
          { tipo: "fix",      texto: "Bug crítico: nomes salvos como 'Usuário', 'Analista' ou 'SISTEMA' em navegação SPA (useSession async) corrigido" },
          { tipo: "fix",      texto: "ReservaSalas: reservas agora sempre registram o nome real do operador — F5 não mais necessário" },
          { tipo: "segurança", texto: "Afetado: salvarLogCS, salvarLogFeedback, salvarAlteracoesGeral, restaurarVersaoCliente, upsertPerformance, agendarSala" },
        ],
      },
    ],
  },
  {
    versao: "2.2",
    data: "Maio 2026",
    destaque: false,
    titulo: "Painel Inteligente",
    subtitulo: "Visão personalizada por setor e controle de acesso refinado",
    icon: Sparkles,
    cor: "text-blue-400",
    grupos: [
      {
        label: "Painel Principal",
        icon: Package,
        items: [
          { tipo: "melhoria", texto: "Painel Alpha exibe apenas módulos liberados para o usuário — sem cards bloqueados" },
          { tipo: "melhoria", texto: "Módulos agrupados por setor real (Operacional, Comercial, Financeiro, Pessoas, Infra & Docs, Admin)" },
          { tipo: "melhoria", texto: "Setores sem módulos atribuídos não aparecem — interface limpa e relevante" },
          { tipo: "melhoria", texto: "Sistema de atalhos da tela principal removido — sidebar mantém fixação de favoritos" },
        ],
      },
      {
        label: "Controle de Acesso",
        icon: Shield,
        items: [
          { tipo: "melhoria", texto: "Gestão de Equipe agora visível para perfis RH e Financeiro sem necessidade de permissão manual" },
          { tipo: "novo",     texto: "Administrador pode liberar acesso à Gestão de Equipe para qualquer setor via Gerenciador de Permissões" },
          { tipo: "melhoria", texto: "Usuários com acesso liberado veem apenas a aba de equipe — cadastro de novos usuários permanece exclusivo para Administradores" },
          { tipo: "fix",      texto: "Permissões resolvidas em tempo real via banco de dados, eliminando leituras de sessão desatualizadas" },
        ],
      },
      {
        label: "Interface & Navegação",
        icon: Palette,
        items: [
          { tipo: "melhoria", texto: "Menu lateral: opção 'Atalhos Rápidos' removida do dropdown de perfil" },
          { tipo: "melhoria", texto: "Fixação de módulos no topo da sidebar mantida e funcional (ícone de pin)" },
          { tipo: "melhoria", texto: "Botões 'Voltar ao Painel' removidos de todos os módulos — navegação centralizada na sidebar" },
          { tipo: "fix",      texto: "Selects do painel de gestão de equipe com visibilidade correta no tema escuro" },
        ],
      },
    ],
  },
  {
    versao: "2.1",
    data: "Maio 2026",
    titulo: "Gestão Comercial",
    subtitulo: "Contratos, metas e sistema de permissões por setor",
    icon: BarChart3,
    cor: "text-indigo-400",
    grupos: [
      {
        label: "Alpha Metas — Gestão de Contratos",
        icon: BarChart3,
        items: [
          { tipo: "novo",    texto: "Painel de gerenciamento de contratos comerciais integrado ao módulo Metas" },
          { tipo: "novo",    texto: "Registro de contratos com quadro societário, forma de pagamento e canal de aquisição" },
          { tipo: "novo",    texto: "Fluxo de confirmação de fechamento com upload de contrato assinado (PDF)" },
          { tipo: "novo",    texto: "Botão de upload pulsante em vermelho para contratos fechados sem documento anexado" },
          { tipo: "melhoria", texto: "Formas de pagamento atualizadas: Entrada/Êxito, Parcelamento CC e Integral com desconto" },
          { tipo: "melhoria", texto: "Vínculos do quadro societário alinhados com os cadastros de CS & NPS" },
          { tipo: "melhoria", texto: "Ao fechar contrato, cliente é automaticamente criado no módulo CS & NPS quando inexistente" },
        ],
      },
      {
        label: "Permissões por Setor",
        icon: Users,
        items: [
          { tipo: "novo",    texto: "Sistema de permissões herdadas automaticamente pelo setor do colaborador" },
          { tipo: "novo",    texto: "Gerenciador de permissões por setor: admin configura quais módulos cada setor acessa" },
          { tipo: "novo",    texto: "Overrides individuais: adicionar ou remover módulo específico para um usuário sem alterar o setor" },
          { tipo: "melhoria", texto: "Formulário de cadastro exibe preview dos módulos do setor selecionado antes de confirmar" },
          { tipo: "melhoria", texto: "Gestão de Equipe com filtros, edição inline e controle de overrides por colaborador" },
        ],
      },
      {
        label: "Notificações Realtime",
        icon: Bell,
        items: [
          { tipo: "novo",    texto: "Notificações em tempo real via Pusher para novos chamados (administradores)" },
          { tipo: "novo",    texto: "Toast de notificação com barra de progresso, urgência colorida e acesso direto ao chamado" },
          { tipo: "fix",     texto: "Memory leak no sistema de chat: conexões WebSocket reutilizadas corretamente" },
        ],
      },
    ],
  },
  {
    versao: "2.0",
    data: "Maio 2026",
    titulo: "Módulos de RH e Extrato",
    subtitulo: "Alpha Holerites, OCR aprimorado e reformulação de Chamados",
    icon: FileText,
    cor: "text-emerald-400",
    grupos: [
      {
        label: "Alpha Holerites",
        icon: FileText,
        items: [
          { tipo: "novo",     texto: "Módulo completo de gestão de holerites digitais com heatmap anual por colaborador" },
          { tipo: "novo",     texto: "Upload de PDF com declaração de autenticidade — colaboradores enviam seus próprios holerites" },
          { tipo: "novo",     texto: "Validação e rejeição com motivo pelo setor de gestão (Financeiro / RH / Admin)" },
          { tipo: "novo",     texto: "Visualizador de PDF integrado — sem necessidade de download para conferência" },
          { tipo: "segurança", texto: "Acesso ao arquivo sempre via rota protegida com verificação de propriedade" },
        ],
      },
      {
        label: "Extratos Bancários — OCR",
        icon: Zap,
        items: [
          { tipo: "fix",     texto: "10 correções críticas no processamento OCR de extratos (Itaú, BB, Bradesco, Santander, Inter, Mercado Pago)" },
          { tipo: "fix",     texto: "Conversão de valores monetários reescrita — trata milhar, decimal e formatos mistos corretamente" },
          { tipo: "melhoria", texto: "IDs de transação trocados de Math.random para UUID criptograficamente seguro" },
          { tipo: "melhoria", texto: "Validação de limite de 10 MB antes de enviar ao serviço de OCR" },
        ],
      },
      {
        label: "Módulo de Chamados",
        icon: Bell,
        items: [
          { tipo: "melhoria", texto: "Redesign completo: dark slate, tabela limpa com status coloridos e tempo relativo" },
          { tipo: "fix",     texto: "Abertura de chamados corrigida — 6 categorias com cards descritivos e contador de caracteres" },
          { tipo: "fix",     texto: "Notificações de novas mensagens resolvidas (stale closure no handler Pusher)" },
          { tipo: "segurança", texto: "Credenciais de notificação WhatsApp movidas para variáveis de ambiente" },
        ],
      },
    ],
  },
  {
    versao: "1.5",
    data: "Abril — Maio 2026",
    titulo: "Pré-Análise e Alpha Skills",
    subtitulo: "Consulta RADAR com histórico e trilhas de aprendizado",
    icon: Wrench,
    cor: "text-amber-400",
    grupos: [
      {
        label: "Sistema de Pré-Análise",
        icon: Zap,
        items: [
          { tipo: "melhoria", texto: "Data da última consulta Radar exibida por cliente — evita reconsultas desnecessárias" },
          { tipo: "melhoria", texto: "Histórico de consultas recarrega com todos os dados incluindo timestamp de consulta" },
        ],
      },
      {
        label: "Alpha Skills",
        icon: Package,
        items: [
          { tipo: "melhoria", texto: "Fallback de capa de curso para imagem padrão quando não fornecida" },
          { tipo: "melhoria", texto: "Seleção de trilhas em lote redesenhada com dropdown estilizado" },
        ],
      },
    ],
  },
];

// ── Componente principal ──────────────────────────────────
export default function NotasAtualizacao() {
  const { data: session } = useSession();
  const style = getTema((session?.user as any)?.tema_interface);

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 relative overflow-hidden">
      {/* BG glow */}
      <div className={`fixed top-[-15%] right-[-10%] w-[500px] h-[500px] ${style.glow} blur-[140px] rounded-full opacity-15 pointer-events-none`} />

      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-16 relative z-10">

        {/* Header */}
        <header className="mb-14">
          <div className="mt-8 flex items-start gap-6">
            <div className={`p-4 rounded-2xl ${style.bg} shadow-2xl shrink-0`}>
              <Rocket size={32} className="text-white" />
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-[0.4em] mb-2 ${style.text}`}>Painel Alpha</p>
              <h1 className="text-3xl lg:text-4xl font-black uppercase italic tracking-tighter text-white leading-none">
                Notas de Atualização
              </h1>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-2">
                Histórico de versões e melhorias do sistema
              </p>
            </div>
          </div>
        </header>

        {/* Releases */}
        <div className="space-y-10">
          {RELEASES.map((release, ri) => {
            const ReleaseIcon = release.icon;
            const isDestaque = release.destaque;

            return (
              <article
                key={release.versao}
                className={`rounded-[2rem] border overflow-hidden transition-all ${
                  isDestaque
                    ? `border-white/15 bg-slate-900/50 shadow-[0_0_60px_-20px_rgba(99,102,241,0.2)]`
                    : "border-white/5 bg-slate-900/20"
                }`}
              >
                {/* Release header */}
                <div className={`px-8 py-6 border-b ${isDestaque ? "border-white/10 bg-white/[0.03]" : "border-white/5"}`}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 ${release.cor}`}>
                        <ReleaseIcon size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-full border ${
                            isDestaque
                              ? `${style.text} border-current bg-current/10`
                              : "text-slate-500 border-white/10 bg-white/5"
                          }`}>
                            v{release.versao}
                          </span>
                          {isDestaque && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Atual
                            </span>
                          )}
                        </div>
                        <h2 className="text-base font-black text-white uppercase italic tracking-tight mt-1.5">
                          {release.titulo}
                        </h2>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                          {release.subtitulo}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest shrink-0">
                      {release.data}
                    </span>
                  </div>
                </div>

                {/* Grupos */}
                <div className="divide-y divide-white/[0.04]">
                  {release.grupos.map((grupo, gi) => {
                    const GrupoIcon = grupo.icon;
                    return (
                      <div key={gi} className="px-8 py-6">
                        <div className="flex items-center gap-2 mb-4">
                          <GrupoIcon size={12} className="text-slate-500 shrink-0" />
                          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
                            {grupo.label}
                          </span>
                        </div>
                        <ul className="space-y-2.5">
                          {grupo.items.map((item, ii) => {
                            const cfg = TIPO_CONFIG[item.tipo];
                            return (
                              <li key={ii} className="flex items-start gap-3">
                                <span className={`mt-0.5 shrink-0 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.cls}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-[11px] text-slate-400 font-bold leading-relaxed">
                                  {item.texto}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between flex-wrap gap-4">
          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">
            Painel Alpha © 2026
          </p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
              Sistema Operacional — v2.5
            </span>
          </div>
        </footer>

      </div>
    </main>
  );
}
