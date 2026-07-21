import db from "@/lib/prisma";
import { getReceitaData } from "@/app/api/ReceitaFederal/route";
import { gerarFichaServer } from "@/lib/bibble/gerar-ficha-server";

export interface UserCtx {
  userId: number;
  userName: string;
  role: string;
  permissoes: string[];
}

// Admin/CEO têm acesso irrestrito a todas as tools
function isAdmin(ctx: UserCtx): boolean {
  return ctx.role === "Admin" || ctx.role === "CEO";
}

function temPermissao(ctx: UserCtx, modulo: string): boolean {
  if (isAdmin(ctx)) return true;
  return ctx.permissoes.includes(modulo);
}

function negado(modulo: string): string {
  return `Você não tem permissão para acessar o módulo "${modulo}". Fale com um administrador para solicitar acesso.`;
}

export async function executarTool(
  nome: string,
  params: Record<string, unknown>,
  ctx: UserCtx
): Promise<string> {
  const { userId } = ctx;

  switch (nome) {
    case "buscar_empresa": {
      if (!temPermissao(ctx, "analise") && !temPermissao(ctx, "radar")) {
        return negado("Pré Análise / Consulta RADAR");
      }

      const cnpjRaw = String(params.cnpj || "");
      const cnpj = cnpjRaw.replace(/\D/g, "").padStart(14, "0").substring(0, 14);

      if (!cnpj || cnpj === "00000000000000") {
        return "CNPJ inválido.";
      }

      const cached = await db.consultas_radar.findUnique({ where: { cnpj } });
      if (cached) {
        return JSON.stringify({
          cnpj,
          razao_social: cached.razao_social,
          nome_fantasia: cached.nome_fantasia,
          situacao_radar: cached.situacao_radar,
          submodalidade: cached.submodalidade,
          regime_tributario: cached.regime_tributario,
          capital_social: cached.capital_social,
          municipio: cached.municipio,
          uf: cached.uf,
          data_constituicao: cached.data_constituicao,
          fonte: "cache_local",
        });
      }

      try {
        const receita = await getReceitaData(cnpj);
        return JSON.stringify({
          cnpj,
          razao_social: receita.razaoSocial,
          nome_fantasia: receita.nomeFantasia,
          municipio: receita.municipio,
          uf: receita.uf,
          regime_tributario: receita.regimeTributario,
          capital_social: receita.capitalSocial,
          situacao: receita.situacao,
          data_constituicao: receita.dataConstituicao,
          fonte: "receita_federal",
        });
      } catch {
        return `Empresa com CNPJ ${cnpj} não encontrada ou serviço da Receita Federal indisponível.`;
      }
    }

    case "listar_clientes": {
      if (!temPermissao(ctx, "Cliente") && !temPermissao(ctx, "crm")) {
        return negado("CS & NPS / Alpha CRM");
      }

      const busca = String(params.busca || "").trim();
      const limite = Math.min(Number(params.limite || 5), 10);

      if (!busca) return "Informe um nome ou CNPJ para buscar.";

      const clientes = await db.clientes.findMany({
        where: {
          OR: [
            { razaoSocial: { contains: busca } },
            { nomeFantasia: { contains: busca } },
            { cnpj: { contains: busca.replace(/\D/g, "") } },
          ],
        },
        take: limite,
        select: {
          cnpj: true,
          razaoSocial: true,
          nomeFantasia: true,
          status: true,
          regimeTributario: true,
          analistaResponsavel: true,
          uf: true,
        },
      });

      if (!clientes.length) {
        return `Nenhum cliente encontrado para "${busca}".`;
      }

      return JSON.stringify(clientes);
    }

    case "abrir_chamado": {
      // Abrir chamado é liberado para QUALQUER usuário autenticado — igual ao
      // fluxo manual (createChamadoAction / API AbrirChamado). A permissão
      // "chamados" controla apenas a gestão/visualização do módulo, não o
      // direito de registrar o próprio chamado de suporte.
      const titulo = String(params.titulo || "").trim().substring(0, 100);
      const descricao = String(params.descricao || "").trim();
      const prioridade = String(params.prioridade || "MEDIA");

      if (!titulo || !descricao) {
        return "Dados insuficientes para abrir o chamado.";
      }

      const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000);
      const duplicado = await db.chamados.findFirst({
        where: { usuarioId: userId, titulo, createdAt: { gte: cincoMinAtras } },
      });

      if (duplicado) {
        return `Chamado "${titulo}" já foi registrado recentemente (ID #${duplicado.id}).`;
      }

      const chamado = await db.chamados.create({
        data: {
          titulo,
          descricao: `[Aberto via Bibble]\n\n${descricao}`,
          categoria: "SUPORTE",
          prioridade,
          usuarioId: userId,
          status: "ABERTO",
        },
      });

      return `Chamado #${chamado.id} criado com título "${titulo}" e prioridade ${prioridade}.`;
    }

    case "gerar_ficha_pre_analise": {
      if (!temPermissao(ctx, "analise")) {
        return negado("Pré Análise");
      }

      const cnpjRaw = String(params.cnpj || "");
      const cnpj = cnpjRaw.replace(/\D/g, "");

      if (!cnpj || cnpj.length !== 14) {
        return "CNPJ inválido para gerar ficha. Informe 14 dígitos.";
      }

      try {
        const result = await gerarFichaServer({
          cnpj,
          userName: ctx.userName,
          nomeResponsavel: params.nome_responsavel ? String(params.nome_responsavel) : undefined,
          observacoes: params.observacoes ? String(params.observacoes) : undefined,
          dataSituacao: params.data_reuniao ? String(params.data_reuniao) : undefined,
          horaSituacao: params.hora_reuniao ? String(params.hora_reuniao) : undefined,
        });

        return JSON.stringify({
          sucesso: true,
          razaoSocial: result.razaoSocial,
          cnpj: result.cnpj,
          pdfUrl: result.url,
          mensagem: `Ficha de reunião gerada com sucesso para ${result.razaoSocial}.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro interno";
        return `Não foi possível gerar a ficha: ${msg}`;
      }
    }

    case "buscar_consultas_recentes": {
      if (!temPermissao(ctx, "analise")) {
        return negado("Pré Análise");
      }

      const limite = Math.min(Number(params.limite || 10), 20);

      const consultas = await db.consultaPreAnalise.findMany({
        take: limite,
        orderBy: { updatedAt: "desc" },
        select: {
          cnpj: true,
          razaoSocial: true,
          nomeFantasia: true,
          situacao: true,
          submodalidade: true,
          updatedAt: true,
        },
      });

      if (!consultas.length) {
        return "Nenhuma pré-análise encontrada no sistema.";
      }

      const linhas = consultas.map((c) => {
        const data = new Date(c.updatedAt).toLocaleDateString("pt-BR");
        return `- **${c.razaoSocial}** (${c.cnpj}) — ${c.situacao ?? "?"} | RADAR: ${c.submodalidade ?? "não consultado"} | ${data}`;
      });

      return `### Últimas ${consultas.length} pré-análises\n\n${linhas.join("\n")}`;
    }

    // ── Alpha Skills ────────────────────────────────────────────────────────────

    case "lista_cursos": {
      const setor = params.setor ? String(params.setor) : undefined;
      const incluirModulos = Boolean(params.incluir_modulos);

      const cursos = await db.curso.findMany({
        where: setor
          ? { setores: { some: { setor: { contains: setor } } } }
          : undefined,
        orderBy: { ordem: "asc" },
        include: {
          setores: true,
          modulos: {
            orderBy: { ordem: "asc" },
            include: {
              modulo: {
                include: {
                  videos: true,
                },
              },
            },
          },
        },
      });

      if (!cursos.length) return "Nenhum curso encontrado no Alpha Skills.";

      let totalModulos = 0;
      let totalAulas = 0;

      const lista = cursos.map((curso) => {
        const modCount = curso.modulos.length;
        const aulasCount = curso.modulos.reduce((acc, cm) => acc + cm.modulo.videos.length, 0);
        totalModulos += modCount;
        totalAulas += aulasCount;

        const info: Record<string, unknown> = {
          nome: curso.nome,
          descricao: curso.descricao ?? null,
          setores: curso.setores.map((s) => s.setor),
          total_modulos: modCount,
          total_aulas: aulasCount,
        };

        if (incluirModulos) {
          info.modulos = curso.modulos.map((cm) => ({
            nome: cm.modulo.nome,
            descricao: cm.modulo.descricao ?? null,
            total_aulas: cm.modulo.videos.length,
          }));
        }

        return info;
      });

      return JSON.stringify({
        resumo: {
          total_cursos: cursos.length,
          total_modulos: totalModulos,
          total_aulas: totalAulas,
        },
        cursos: lista,
      });
    }

    case "detalhes_curso": {
      const nome = String(params.curso || "").trim();
      if (!nome) return "Informe o nome do curso.";

      const curso = await db.curso.findFirst({
        where: { nome: { contains: nome } },
        include: {
          setores: true,
          modulos: {
            orderBy: { ordem: "asc" },
            include: {
              modulo: {
                include: {
                  videos: {
                    orderBy: { ordem: "asc" },
                    include: { video: { select: { id: true, titulo: true, duracao: true, descricao: true } } },
                  },
                },
              },
            },
          },
        },
      });

      if (!curso) return `Curso "${nome}" não encontrado.`;

      return JSON.stringify({
        id: curso.id,
        nome: curso.nome,
        descricao: curso.descricao,
        setores: curso.setores.map((s) => s.setor),
        total_modulos: curso.modulos.length,
        total_aulas: curso.modulos.reduce((acc, cm) => acc + cm.modulo.videos.length, 0),
        modulos: curso.modulos.map((cm, i) => ({
          ordem: i + 1,
          nome: cm.modulo.nome,
          descricao: cm.modulo.descricao,
          bloqueado: cm.modulo.bloqueado,
          total_aulas: cm.modulo.videos.length,
          aulas: cm.modulo.videos.map((mv) => ({
            ordem: mv.ordem,
            titulo: mv.video.titulo,
            descricao: mv.video.descricao,
            duracao_segundos: mv.video.duracao,
          })),
        })),
      });
    }

    case "lista_modulos": {
      const nomeCurso = String(params.curso || "").trim();
      if (!nomeCurso) return "Informe o nome do curso para listar os módulos.";

      const curso = await db.curso.findFirst({
        where: { nome: { contains: nomeCurso } },
        include: {
          modulos: {
            orderBy: { ordem: "asc" },
            include: {
              modulo: {
                include: { videos: true },
              },
            },
          },
        },
      });

      if (!curso) return `Curso "${nomeCurso}" não encontrado.`;
      if (!curso.modulos.length) return `O curso "${curso.nome}" não tem módulos cadastrados.`;

      const modulos = curso.modulos.map((cm, i) => ({
        ordem: i + 1,
        nome: cm.modulo.nome,
        descricao: cm.modulo.descricao,
        aprendizado: cm.modulo.aprendizado,
        bloqueado: cm.modulo.bloqueado,
        percentual_minimo: cm.modulo.percentualMinimo,
        total_aulas: cm.modulo.videos.length,
      }));

      return JSON.stringify({
        curso: curso.nome,
        total_modulos: modulos.length,
        modulos,
      });
    }

    case "detalhes_modulo": {
      const nomeModulo = String(params.modulo || "").trim();
      if (!nomeModulo) return "Informe o nome do módulo.";

      const modulo = await db.modulos.findFirst({
        where: { nome: { contains: nomeModulo } },
        include: {
          videos: {
            orderBy: { ordem: "asc" },
            include: {
              video: {
                select: { id: true, titulo: true, descricao: true, duracao: true, url: true },
              },
            },
          },
          cursos: {
            include: { curso: { select: { nome: true } } },
          },
        },
      });

      if (!modulo) return `Módulo "${nomeModulo}" não encontrado.`;

      return JSON.stringify({
        nome: modulo.nome,
        descricao: modulo.descricao,
        aprendizado: modulo.aprendizado,
        setor: modulo.setor,
        bloqueado: modulo.bloqueado,
        percentual_minimo: modulo.percentualMinimo,
        pertence_aos_cursos: modulo.cursos.map((c) => c.curso.nome),
        total_aulas: modulo.videos.length,
        aulas: modulo.videos.map((mv) => ({
          ordem: mv.ordem,
          titulo: mv.video.titulo,
          descricao: mv.video.descricao,
          duracao_segundos: mv.video.duracao,
        })),
      });
    }

    case "consulta_progreso_aluno": {
      const targetId = params.aluno_id ? Number(params.aluno_id) : userId;

      // Admin pode consultar qualquer aluno; usuário comum só a si mesmo
      if (targetId !== userId && !isAdmin(ctx)) {
        return negado("progresso de outros usuários");
      }

      const progressos = await db.progressoVideo.findMany({
        where: { userId: targetId, concluido: true },
        select: { videoId: true },
      });

      const videosConcluidosIds = new Set(progressos.map((p) => p.videoId));
      const totalVideos = await db.videos.count();

      return JSON.stringify({
        usuario_id: targetId,
        total_aulas_disponiveis: totalVideos,
        total_aulas_concluidas: videosConcluidosIds.size,
        percentual_geral: totalVideos > 0
          ? Math.round((videosConcluidosIds.size / totalVideos) * 100)
          : 0,
      });
    }

    // ── Chamados ─────────────────────────────────────────────────────────────

    case "consultar_chamados": {
      const statusFiltro = params.status ? String(params.status).toUpperCase() : undefined;
      const limite = Math.min(Number(params.limite || 10), 20);
      const usuarioNome = params.usuario_nome ? String(params.usuario_nome).trim() : undefined;

      // Admin pode filtrar por nome de usuário e ver todos
      // Usuário comum vê apenas os seus
      let whereUsuarioId: number | undefined = isAdmin(ctx) ? undefined : userId;

      if (isAdmin(ctx) && usuarioNome) {
        const usuario = await db.usuarios.findFirst({
          where: { nome: { contains: usuarioNome } },
          select: { id: true },
        });
        if (!usuario) return `Nenhum usuário encontrado com nome "${usuarioNome}".`;
        whereUsuarioId = usuario.id;
      }

      const chamados = await db.chamados.findMany({
        where: {
          ...(whereUsuarioId !== undefined ? { usuarioId: whereUsuarioId } : {}),
          ...(statusFiltro ? { status: statusFiltro } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limite,
        select: {
          id: true,
          titulo: true,
          status: true,
          prioridade: true,
          categoria: true,
          createdAt: true,
          solicitante: { select: { nome: true } },
        },
      });

      if (!chamados.length) {
        const contexto = statusFiltro ? ` com status ${statusFiltro}` : "";
        return `Nenhum chamado encontrado${contexto}.`;
      }

      // Contagem por status para resumo
      const totalConsultados = isAdmin(ctx) ? await db.chamados.count() : undefined;
      const abertos = isAdmin(ctx)
        ? await db.chamados.count({ where: { status: "ABERTO" } })
        : chamados.filter((c) => c.status === "ABERTO").length;

      const lista = chamados.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        status: c.status,
        prioridade: c.prioridade,
        categoria: c.categoria,
        solicitante: c.solicitante.nome,
        criado_em: new Date(c.createdAt).toLocaleDateString("pt-BR"),
      }));

      return JSON.stringify({
        resumo: {
          total_sistema: totalConsultados,
          total_abertos: abertos,
          exibindo: chamados.length,
        },
        chamados: lista,
      });
    }

    // ── Usuários (admin only) ─────────────────────────────────────────────────

    case "consultar_usuarios": {
      if (!isAdmin(ctx)) {
        return negado("Usuários — acesso restrito a Admin/CEO");
      }

      const busca = params.busca ? String(params.busca).trim() : undefined;
      const statusFiltro = params.status ? String(params.status).toUpperCase() : undefined;
      const limite = Math.min(Number(params.limite || 20), 50);

      const usuarios = await db.usuarios.findMany({
        where: {
          ...(busca
            ? { OR: [{ nome: { contains: busca } }, { email: { contains: busca } }] }
            : {}),
          ...(statusFiltro ? { status: statusFiltro } : {}),
        },
        orderBy: { nome: "asc" },
        take: limite,
        select: {
          id: true,
          nome: true,
          email: true,
          usuario: true,
          role: true,
          cargo: true,
          status: true,
          data_contratacao: true,
          // senha NÃO é retornada — campo armazena hash bcrypt, expor é inseguro
        },
      });

      const total = await db.usuarios.count({
        where: statusFiltro ? { status: statusFiltro } : undefined,
      });
      const ativos = await db.usuarios.count({ where: { status: "ATIVO" } });

      return JSON.stringify({
        resumo: {
          total_usuarios: total,
          total_ativos: ativos,
          total_inativos: total - ativos,
          exibindo: usuarios.length,
        },
        usuarios,
      });
    }

    case "consultar_metas_comerciais": {
      const now = new Date();
      const mes = (params.mes as number | undefined) ?? (now.getMonth() + 1);
      const ano = (params.ano as number | undefined) ?? now.getFullYear();
      const apenasConfirmados = (params.apenas_confirmados as boolean | undefined) ?? false;
      const usuarioNomeBusca = (params.usuario_nome as string | undefined)?.trim();

      // Resolve usuário alvo
      let usuarioId: number | undefined;
      let usuarioInfo: { id: number; nome: string; cargo?: string | null } | null = null;

      if (usuarioNomeBusca) {
        if (!isAdmin(ctx)) return JSON.stringify({ erro: "Sem permissão para consultar outro usuário." });
        usuarioInfo = await db.usuarios.findFirst({
          where: { nome: { contains: usuarioNomeBusca } },
          select: { id: true, nome: true, cargo: true },
        });
        if (!usuarioInfo) return JSON.stringify({ erro: `Usuário "${usuarioNomeBusca}" não encontrado.` });
        usuarioId = usuarioInfo.id;
      } else {
        usuarioId = ctx.userId;
        usuarioInfo = await db.usuarios.findUnique({
          where: { id: usuarioId },
          select: { id: true, nome: true, cargo: true },
        });
      }

      const contratos = await db.contratoComercial.findMany({
        where: {
          mes,
          ano,
          arquivado: false,
          contaComVenda: true,
          ...(apenasConfirmados ? { pagamentoConfirmado: true } : {}),
          ...(usuarioId !== undefined ? { usuarioId } : {}),
        },
        select: {
          razaoSocial: true,
          valorContrato: true,
          servico: true,
          canalAquisicao: true,
          status: true,
          pagamentoConfirmado: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Meta individual
      let metaMensal: number | null = null;
      if (usuarioInfo) {
        const meta = await db.metaUsuario.findUnique({
          where: { colaboradoraId_mes_ano: { colaboradoraId: usuarioInfo.nome, mes, ano } },
          select: { metaMensal: true },
        });
        metaMensal = meta?.metaMensal ?? null;
      }

      // Meta da equipe
      const metaEquipe = await db.metaEquipe.findUnique({
        where: { mes_ano: { mes, ano } },
        select: { metaMensal: true },
      });

      const total = contratos.length;
      const confirmados = contratos.filter(c => c.pagamentoConfirmado).length;
      const valorTotal = contratos.reduce((s, c) => s + c.valorContrato, 0);

      return JSON.stringify({
        periodo: `${String(mes).padStart(2, "0")}/${ano}`,
        colaborador: usuarioInfo ? { nome: usuarioInfo.nome, cargo: usuarioInfo.cargo } : null,
        vendas: {
          total,
          confirmados,
          pendentes: total - confirmados,
          valor_total: `R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        },
        meta_individual: metaMensal !== null ? { quantidade: metaMensal, progresso: `${total}/${metaMensal} (${metaMensal > 0 ? Math.round((total / metaMensal) * 100) : 0}%)` } : null,
        meta_equipe: metaEquipe?.metaMensal ?? null,
        contratos: contratos.map(c => ({
          empresa: c.razaoSocial,
          valor: `R$ ${c.valorContrato.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          servico: c.servico,
          canal: c.canalAquisicao,
          status: c.status,
          pago: c.pagamentoConfirmado,
        })),
      });
    }

    case "ler_arquivo": {
      const caminho = String(params.caminho ?? "").trim();
      const limiteChars = Math.min(Number(params.limite_chars ?? 10000), 50000);

      if (!caminho) return JSON.stringify({ erro: "Caminho não fornecido." });

      // Segurança: bloquear caminhos com ../ que saiam do projeto
      if (caminho.includes("..")) {
        return JSON.stringify({ erro: "Caminho inválido: navegação relativa não permitida por segurança." });
      }

      try {
        const path = await import("path");
        const fs = await import("fs/promises");

        const basePath = process.cwd();
        const fullPath = path.isAbsolute(caminho) ? caminho : path.join(basePath, caminho);

        // Verificar se o arquivo existe
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          // Listar diretório
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          const listing = entries.map(e => `${e.isDirectory() ? "[DIR]" : "[ARQ]"} ${e.name}`).join("\n");
          return JSON.stringify({ tipo: "diretorio", caminho: fullPath, conteudo: listing });
        }

        const content = await fs.readFile(fullPath, "utf-8");
        const truncado = content.length > limiteChars;
        return JSON.stringify({
          tipo: "arquivo",
          caminho: fullPath,
          tamanho_chars: content.length,
          truncado,
          conteudo: truncado ? content.slice(0, limiteChars) + "\n\n...[truncado]" : content,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ erro: `Não foi possível ler o arquivo: ${msg}` });
      }
    }

    case "criar_pasta": {
      const caminho = String(params.caminho ?? "").trim();
      if (!caminho) return JSON.stringify({ erro: "Caminho não fornecido." });
      if (caminho.includes("..")) return JSON.stringify({ erro: "Caminho inválido." });

      try {
        const path = await import("path");
        const fs = await import("fs/promises");
        const fullPath = path.isAbsolute(caminho) ? caminho : path.join(process.cwd(), caminho);
        await fs.mkdir(fullPath, { recursive: true });
        return JSON.stringify({ sucesso: true, mensagem: `Pasta criada: ${fullPath}` });
      } catch (err) {
        return JSON.stringify({ erro: `Não foi possível criar a pasta: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    case "criar_arquivo": {
      const caminho = String(params.caminho ?? "").trim();
      const conteudo = String(params.conteudo ?? "");
      if (!caminho) return JSON.stringify({ erro: "Caminho não fornecido." });
      if (caminho.includes("..")) return JSON.stringify({ erro: "Caminho inválido." });

      try {
        const path = await import("path");
        const fs = await import("fs/promises");
        const fullPath = path.isAbsolute(caminho) ? caminho : path.join(process.cwd(), caminho);

        // Verifica se já existe
        try {
          await fs.access(fullPath);
          return JSON.stringify({ erro: `Arquivo já existe: ${fullPath}. Use escrever_arquivo para sobrescrever.` });
        } catch { /* não existe, pode criar */ }

        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, conteudo, "utf-8");
        return JSON.stringify({ sucesso: true, mensagem: `Arquivo criado: ${fullPath}` });
      } catch (err) {
        return JSON.stringify({ erro: `Não foi possível criar o arquivo: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    case "escrever_arquivo": {
      const caminho = String(params.caminho ?? "").trim();
      const conteudo = String(params.conteudo ?? "");
      if (!caminho) return JSON.stringify({ erro: "Caminho não fornecido." });
      if (caminho.includes("..")) return JSON.stringify({ erro: "Caminho inválido." });

      try {
        const path = await import("path");
        const fs = await import("fs/promises");
        const fullPath = path.isAbsolute(caminho) ? caminho : path.join(process.cwd(), caminho);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, conteudo, "utf-8");
        return JSON.stringify({ sucesso: true, mensagem: `Arquivo salvo: ${fullPath}`, tamanho_chars: conteudo.length });
      } catch (err) {
        return JSON.stringify({ erro: `Não foi possível escrever no arquivo: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    case "apagar": {
      const caminho = String(params.caminho ?? "").trim();
      const recursivo = Boolean(params.recursivo);
      if (!caminho) return JSON.stringify({ erro: "Caminho não fornecido." });
      if (caminho.includes("..")) return JSON.stringify({ erro: "Caminho inválido." });

      try {
        const path = await import("path");
        const fs = await import("fs/promises");
        const fullPath = path.isAbsolute(caminho) ? caminho : path.join(process.cwd(), caminho);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await fs.rm(fullPath, { recursive: recursivo, force: false });
        } else {
          await fs.unlink(fullPath);
        }
        return JSON.stringify({ sucesso: true, mensagem: `Apagado: ${fullPath}` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const dica = msg.includes("ENOTEMPTY") ? " A pasta não está vazia — use recursivo: true para apagar tudo." : "";
        return JSON.stringify({ erro: `Não foi possível apagar: ${msg}${dica}` });
      }
    }

    case "mover_arquivo": {
      const origem = String(params.origem ?? "").trim();
      const destino = String(params.destino ?? "").trim();
      if (!origem || !destino) return JSON.stringify({ erro: "Origem e destino são obrigatórios." });
      if (origem.includes("..") || destino.includes("..")) return JSON.stringify({ erro: "Caminho inválido." });

      try {
        const path = await import("path");
        const fs = await import("fs/promises");
        const base = process.cwd();
        const fullOrigem = path.isAbsolute(origem) ? origem : path.join(base, origem);
        const fullDestino = path.isAbsolute(destino) ? destino : path.join(base, destino);
        await fs.mkdir(path.dirname(fullDestino), { recursive: true });
        await fs.rename(fullOrigem, fullDestino);
        return JSON.stringify({ sucesso: true, mensagem: `Movido de ${fullOrigem} para ${fullDestino}` });
      } catch (err) {
        return JSON.stringify({ erro: `Não foi possível mover: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    case "copiar_arquivo": {
      const origem = String(params.origem ?? "").trim();
      const destino = String(params.destino ?? "").trim();
      if (!origem || !destino) return JSON.stringify({ erro: "Origem e destino são obrigatórios." });
      if (origem.includes("..") || destino.includes("..")) return JSON.stringify({ erro: "Caminho inválido." });

      try {
        const path = await import("path");
        const fs = await import("fs/promises");
        const base = process.cwd();
        const fullOrigem = path.isAbsolute(origem) ? origem : path.join(base, origem);
        const fullDestino = path.isAbsolute(destino) ? destino : path.join(base, destino);
        await fs.mkdir(path.dirname(fullDestino), { recursive: true });
        await fs.copyFile(fullOrigem, fullDestino);
        return JSON.stringify({ sucesso: true, mensagem: `Copiado de ${fullOrigem} para ${fullDestino}` });
      } catch (err) {
        return JSON.stringify({ erro: `Não foi possível copiar: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    case "consultar_base_onyx": {
      const pergunta = String(params.pergunta ?? "").trim();
      if (!pergunta) return JSON.stringify({ erro: "Informe a pergunta a consultar." });

      try {
        const { askOnyxOneShot, isOnyxConfigured } = await import("@/lib/onyx/client");
        if (!isOnyxConfigured()) {
          return JSON.stringify({ erro: "A base de conhecimento do Onyx não está configurada." });
        }
        const resposta = await askOnyxOneShot(pergunta);
        if (!resposta) {
          return JSON.stringify({ resultado: "A base do Onyx não retornou informação para essa pergunta." });
        }
        return JSON.stringify({ resultado: resposta });
      } catch (err) {
        return JSON.stringify({ erro: `Falha ao consultar a base do Onyx: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    // ── Calendário Alpha (Google Calendar) ─────────────────────────────────────

    case "listar_eventos_calendario": {
      if (!temPermissao(ctx, "calendarioAlpha")) return negado("Calendário Alpha");

      const { listarCalendariosSelecionados, listarEventosDoCalendario } = await import(
        "@/actions/google-calendar-eventos"
      );

      const diasAFrente = Math.min(Math.max(Number(params.dias_a_frente) || 7, 1), 60);
      const agora = new Date();
      const fim = new Date(agora.getTime() + diasAFrente * 24 * 60 * 60 * 1000);

      const calendariosResultado = await listarCalendariosSelecionados();
      if (!calendariosResultado.success) return calendariosResultado.error;
      const calendariosVisiveis = calendariosResultado.data.filter((c) => c.visivel);
      if (!calendariosVisiveis.length) return "Nenhum calendário selecionado no Calendário Alpha ainda.";

      const todosEventos: {
        titulo: string | null;
        inicio: Date | null;
        fim: Date | null;
        dia_inteiro: boolean;
        link_meet: string | null;
        calendario: string;
        google_event_id: string;
      }[] = [];

      for (const calendario of calendariosVisiveis) {
        const resultado = await listarEventosDoCalendario(calendario.id, agora.toISOString(), fim.toISOString());
        if (!resultado.success) continue;
        for (const evento of resultado.data) {
          todosEventos.push({
            titulo: evento.titulo,
            inicio: evento.inicioEm,
            fim: evento.fimEm,
            dia_inteiro: evento.diaInteiro,
            link_meet: evento.linkMeet,
            calendario: calendario.nome,
            google_event_id: evento.googleEventId,
          });
        }
      }

      if (!todosEventos.length) return `Nenhum evento encontrado nos próximos ${diasAFrente} dias.`;
      todosEventos.sort((a, b) => (a.inicio?.getTime() ?? 0) - (b.inicio?.getTime() ?? 0));

      return JSON.stringify({ periodo_dias: diasAFrente, total: todosEventos.length, eventos: todosEventos });
    }

    case "criar_evento_calendario": {
      if (!temPermissao(ctx, "calendarioAlpha")) return negado("Calendário Alpha");

      const titulo = String(params.titulo || "").trim();
      if (!titulo) return "Informe o título do evento.";

      const diaInteiro = Boolean(params.dia_inteiro);
      const dataInicioRaw = String(params.data_inicio || "");
      const inicio = new Date(diaInteiro && dataInicioRaw.length === 10 ? `${dataInicioRaw}T00:00:00` : dataInicioRaw);
      if (Number.isNaN(inicio.getTime())) return "Data de início inválida.";

      let fim: Date;
      if (params.data_fim) {
        const dataFimRaw = String(params.data_fim);
        fim = new Date(diaInteiro && dataFimRaw.length === 10 ? `${dataFimRaw}T00:00:00` : dataFimRaw);
      } else {
        fim = new Date(inicio.getTime() + (diaInteiro ? 24 : 1) * 60 * 60 * 1000);
      }
      if (Number.isNaN(fim.getTime())) return "Data de fim inválida.";

      const calendarioGravavel = await db.googleCalendarSelecionado.findFirst({
        where: { conexao: { userId }, gravavel: true },
        orderBy: { nome: "asc" },
      });
      if (!calendarioGravavel) {
        return "Você não tem nenhum calendário gravável configurado no Calendário Alpha. Configure um calendário próprio primeiro.";
      }

      const participantes = params.participantes
        ? String(params.participantes)
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean)
        : [];

      const { criarEventoNoCalendario } = await import("@/actions/google-calendar-eventos");
      const resultado = await criarEventoNoCalendario({
        calendarId: calendarioGravavel.googleCalendarId,
        titulo,
        descricaoGoogle: params.descricao ? String(params.descricao) : undefined,
        localizacao: params.local ? String(params.local) : undefined,
        timezone: "America/Sao_Paulo",
        diaInteiro,
        inicio,
        fim,
        participantes,
        criarMeet: Boolean(params.criar_meet),
      });

      if (!resultado.success) return resultado.error;
      return JSON.stringify({ ok: true, google_event_id: resultado.data.googleEventId, calendario: calendarioGravavel.nome });
    }

    case "cancelar_evento_calendario": {
      if (!temPermissao(ctx, "calendarioAlpha")) return negado("Calendário Alpha");

      const googleEventId = String(params.google_event_id || "").trim();
      if (!googleEventId) return "Informe o ID do evento a cancelar (use listar_eventos_calendario antes).";

      const cache = await db.googleCalendarEventoCache.findFirst({
        where: { googleEventId, calendario: { conexao: { userId } } },
        include: { calendario: true },
      });
      if (!cache) return "Evento não encontrado na sua agenda.";

      const { cancelarEventoNoCalendario } = await import("@/actions/google-calendar-eventos");
      const resultado = await cancelarEventoNoCalendario({
        calendarId: cache.calendario.googleCalendarId,
        googleEventId,
      });
      if (!resultado.success) return resultado.error;
      return "Evento cancelado com sucesso.";
    }

    case "consultar_disponibilidade_calendario": {
      if (!temPermissao(ctx, "calendarioAlpha")) return negado("Calendário Alpha");

      const inicio = new Date(String(params.data_inicio || ""));
      const fim = new Date(String(params.data_fim || ""));
      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return "Datas inválidas.";

      const { listarCalendariosSelecionados, consultarDisponibilidade } = await import(
        "@/actions/google-calendar-eventos"
      );
      const calendariosResultado = await listarCalendariosSelecionados();
      if (!calendariosResultado.success) return calendariosResultado.error;
      const googleCalendarIds = calendariosResultado.data.filter((c) => c.visivel).map((c) => c.googleCalendarId);
      if (!googleCalendarIds.length) return "Nenhum calendário selecionado no Calendário Alpha ainda.";

      const resultado = await consultarDisponibilidade({ googleCalendarIds, inicio, fim });
      if (!resultado.success) return resultado.error;
      return JSON.stringify(resultado.data);
    }

    case "consultar_agenda_colega": {
      if (!temPermissao(ctx, "calendarioAlpha")) return negado("Calendário Alpha");

      const nomeOuEmail = String(params.nome_ou_email || "").trim();
      if (!nomeOuEmail) return "Informe o nome ou e-mail do colega.";

      const colega = await db.usuarios.findFirst({
        where: {
          status: "ATIVO",
          id: { not: userId },
          OR: [{ nome: { contains: nomeOuEmail } }, { email: { equals: nomeOuEmail.toLowerCase() } }],
        },
        select: { id: true, nome: true },
      });
      if (!colega) return `Nenhum colaborador ativo encontrado com "${nomeOuEmail}".`;

      const diasAFrente = Math.min(Math.max(Number(params.dias_a_frente) || 7, 1), 60);
      const agora = new Date();
      const fim = new Date(agora.getTime() + diasAFrente * 24 * 60 * 60 * 1000);

      const { listarEventosDeColega } = await import("@/actions/google-calendar-colegas");
      const resultado = await listarEventosDeColega(colega.id, agora.toISOString(), fim.toISOString());
      if (!resultado.success) return resultado.error;

      if (!resultado.data.length) {
        return `${colega.nome} não tem eventos nos próximos ${diasAFrente} dias (ou a agenda está vazia).`;
      }

      const eventos = resultado.data.map((e) => ({
        titulo: e.titulo,
        inicio: e.inicioEm,
        fim: e.fimEm,
        dia_inteiro: e.diaInteiro,
        link_meet: e.linkMeet,
      }));

      return JSON.stringify({ colega: colega.nome, periodo_dias: diasAFrente, total: eventos.length, eventos });
    }

    default:
      return `Tool desconhecida: ${nome}`;
  }
}
