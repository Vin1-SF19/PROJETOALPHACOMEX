export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

export const BIBBLE_TOOLS: OllamaTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_empresa",
      description:
        "Consulta dados de uma empresa via CNPJ: razão social, situação RADAR Aduaneiro, regime tributário, capital social, município, UF e data de constituição.",
      parameters: {
        type: "object",
        properties: {
          cnpj: {
            type: "string",
            description:
              "CNPJ da empresa — pode ser formatado (XX.XXX.XXX/XXXX-XX) ou só números",
          },
        },
        required: ["cnpj"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_clientes",
      description:
        "Busca clientes cadastrados no PainelAlpha pelo nome, nome fantasia ou CNPJ. Retorna status, regime tributário e analista responsável.",
      parameters: {
        type: "object",
        properties: {
          busca: {
            type: "string",
            description: "Texto parcial para buscar — pode ser nome da empresa ou CNPJ",
          },
          limite: {
            type: "number",
            description: "Máximo de resultados a retornar (padrão: 5, máximo: 10)",
          },
        },
        required: ["busca"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "abrir_chamado",
      description:
        "Cria um chamado de suporte no sistema quando o usuário relatar um erro, bug ou problema.",
      parameters: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Título resumido do problema (máximo 100 caracteres)",
          },
          descricao: {
            type: "string",
            description: "Descrição detalhada do problema relatado",
          },
          prioridade: {
            type: "string",
            description: "Prioridade: BAIXA, MEDIA, ALTA ou URGENTE",
          },
        },
        required: ["titulo", "descricao", "prioridade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_ficha_pre_analise",
      description:
        "Gera uma ficha de reunião completa para uma empresa a partir do CNPJ. Consulta Receita Federal e situação RADAR Aduaneiro. Use quando o usuário pedir para gerar ficha de reunião, analisar empresa, ou preparar reunião com um cliente/prospect. A ficha é gerada em PDF e disponibilizada para download diretamente no chat.",
      parameters: {
        type: "object",
        properties: {
          cnpj: {
            type: "string",
            description:
              "CNPJ da empresa — pode ser formatado (XX.XXX.XXX/XXXX-XX) ou só números",
          },
          nome_responsavel: {
            type: "string",
            description: "Nome do responsável comercial (opcional)",
          },
          observacoes: {
            type: "string",
            description:
              "Observações adicionais para incluir na ficha (opcional)",
          },
          data_reuniao: {
            type: "string",
            description: "Data da reunião no formato DD/MM/AAAA (opcional)",
          },
          hora_reuniao: {
            type: "string",
            description: "Hora da reunião no formato HH:MM (opcional)",
          }
        },
        required: ["cnpj"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_consultas_recentes",
      description:
        "Lista as consultas de pré-análise mais recentes do sistema. Use quando o usuário perguntar sobre histórico de pré-análises ou quiser ver quais empresas já foram consultadas.",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "number",
            description: "Número máximo de resultados (padrão: 10, máximo: 20)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lista_cursos",
      description:
        "Lista todos os cursos disponíveis no sistema Alpha Skills com seus setores, categorias e módulos. Use quando o usuário perguntar sobre cursos disponíveis, treinamentos, módulos ou quiser ver o que está disponível para aprendizado. Essa função retorna informações completas sobre os cursos cadastrados.",
      parameters: {
        type: "object",
        properties: {
          setor: {
            type: "string",
            description: "Filtrar cursos por setor específico (ex: Marketing, Liderança, Comunicação)",
          },
          incluir_modulos: {
            type: "boolean",
            description: "Incluir lista de módulos em cada curso na resposta",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detalhes_curso",
      description:
        "Retorna detalhes completos de um curso específico, incluindo descrição, módulos com sequenciamento, capa e setores. Use quando o usuário pedir mais informações sobre um curso específico ou quiser ver todos os módulos disponíveis em um treinamento.",
      parameters: {
        type: "object",
        properties: {
          curso: {
            type: "string",
            description: "Nome ou identificador do curso para obter detalhes completos",
          },
        },
        required: ["curso"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lista_modulos",
      description:
        "Lista todos os módulos de um curso específico com suas descrições, vídeos e ordem de execução. Use quando o usuário quiser ver o conteúdo disponível em um curso específico e entender como ele está estruturado.",
      parameters: {
        type: "object",
        properties: {
          curso: {
            type: "string",
            description: "Nome ou identificador principal de um curso com módulos listados",
          },
        },
        required: ["curso"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detalhes_modulo",
      description:
        "Obém detalhes completos de um módulo específico, incluindo todas as aulas, vídeos, duração e status de liberação. Use quando o usuário perguntar sobre um módulo específico ou quiser ver o conteúdo detalhado disponível em um treinamento.",
      parameters: {
        type: "object",
        properties: {
          modulo: {
            type: "string",
            description: "Nome ou identificador do módulo para obter detalhes completos",
          },
          curso: {
            type: "string",
            description: "Nome do curso ao qual o módulo pertence (para contexto e melhor precisão)",
          },
        },
        required: ["modulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consulta_progreso_aluno",
      description:
        "Consulta o progresso do aluno nos cursos Alpha Skills, mostrando quais módulos e aulas foram concluídas, as pendentes e o progresso geral. Use quando o usuário quiser saber sobre seu próprio progresso nos treinamentos ou quais aulas precisa concluir.",
      parameters: {
        type: "object",
        properties: {
          aluno_id: {
            type: "string",
            description: "ID do usuário/aluno para consultar o progresso (padrão: usuário atual)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_chamados",
      description:
        "Consulta chamados de suporte do sistema. Usuários comuns veem apenas seus próprios chamados. Admins/CEOs podem ver todos ou filtrar por usuário. Retorna título, status, prioridade, categoria e data. Use quando o usuário perguntar sobre chamados abertos, pendentes, histórico de suporte ou quantidade de chamados.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Filtrar por status: ABERTO, EM_ANDAMENTO, FECHADO, RESOLVIDO, CANCELADO. Omitir para todos.",
          },
          limite: {
            type: "number",
            description: "Máximo de chamados a retornar (padrão: 10, máximo: 20)",
          },
          usuario_nome: {
            type: "string",
            description: "Admin/CEO apenas: nome parcial do usuário para filtrar chamados dele.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_usuarios",
      description:
        "Admin/CEO apenas: lista usuários cadastrados no sistema com nome, email, usuário, cargo, role e status. Pode buscar por nome ou email. Use quando perguntarem sobre quantidade de usuários, quem está ativo, dados de um colaborador específico.",
      parameters: {
        type: "object",
        properties: {
          busca: {
            type: "string",
            description: "Buscar por nome ou email (parcial). Omitir para listar todos.",
          },
          status: {
            type: "string",
            description: "Filtrar por status: ATIVO ou INATIVO. Omitir para todos.",
          },
          limite: {
            type: "number",
            description: "Máximo de usuários a retornar (padrão: 20, máximo: 50)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_metas_comerciais",
      description:
        "Consulta vendas (contratos comerciais) e metas do painel de metas. Retorna quantidade de vendas, valor total, meta mensal e progresso de um colaborador ou de toda a equipe. Use quando perguntarem sobre vendas, contratos, metas, progresso comercial ou desempenho de vendas.",
      parameters: {
        type: "object",
        properties: {
          usuario_nome: {
            type: "string",
            description: "Nome parcial do colaborador para filtrar. Omitir para ver toda a equipe (admin) ou o próprio usuário.",
          },
          mes: {
            type: "number",
            description: "Mês para consultar (1-12). Padrão: mês atual.",
          },
          ano: {
            type: "number",
            description: "Ano para consultar. Padrão: ano atual.",
          },
          apenas_confirmados: {
            type: "boolean",
            description: "Se true, retorna apenas contratos com pagamento confirmado. Padrão: false.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ler_arquivo",
      description:
        "Lê o conteúdo de um arquivo ou lista o conteúdo de uma pasta. Disponível apenas quando o usuário habilitou acesso ao computador.",
      parameters: {
        type: "object",
        properties: {
          caminho: {
            type: "string",
            description: "Caminho absoluto ou relativo. Para listar pasta, passe o caminho do diretório.",
          },
          limite_chars: {
            type: "number",
            description: "Limite de caracteres a retornar (padrão: 10000, máximo: 50000).",
          },
        },
        required: ["caminho"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_pasta",
      description:
        "Cria uma nova pasta (diretório) no sistema de arquivos. Cria pastas intermediárias automaticamente se necessário. Disponível apenas com acesso ao computador habilitado.",
      parameters: {
        type: "object",
        properties: {
          caminho: {
            type: "string",
            description: "Caminho absoluto ou relativo da pasta a criar.",
          },
        },
        required: ["caminho"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_arquivo",
      description:
        "Cria um novo arquivo com conteúdo opcional. Se o arquivo já existir, retorna erro (use escrever_arquivo para sobrescrever). Disponível apenas com acesso ao computador habilitado.",
      parameters: {
        type: "object",
        properties: {
          caminho: {
            type: "string",
            description: "Caminho absoluto ou relativo do arquivo a criar.",
          },
          conteudo: {
            type: "string",
            description: "Conteúdo inicial do arquivo. Pode ser vazio.",
          },
        },
        required: ["caminho"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escrever_arquivo",
      description:
        "Escreve ou sobrescreve o conteúdo completo de um arquivo. Cria o arquivo se não existir. Disponível apenas com acesso ao computador habilitado.",
      parameters: {
        type: "object",
        properties: {
          caminho: {
            type: "string",
            description: "Caminho absoluto ou relativo do arquivo.",
          },
          conteudo: {
            type: "string",
            description: "Novo conteúdo completo do arquivo.",
          },
        },
        required: ["caminho", "conteudo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apagar",
      description:
        "Apaga um arquivo ou pasta. Para apagar uma pasta e todo seu conteúdo, passe recursivo: true. Disponível apenas com acesso ao computador habilitado.",
      parameters: {
        type: "object",
        properties: {
          caminho: {
            type: "string",
            description: "Caminho absoluto ou relativo do arquivo ou pasta a apagar.",
          },
          recursivo: {
            type: "boolean",
            description: "Se true, apaga a pasta e todo o conteúdo interno. Necessário para pastas não-vazias.",
          },
        },
        required: ["caminho"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mover_arquivo",
      description:
        "Move ou renomeia um arquivo ou pasta. Disponível apenas com acesso ao computador habilitado.",
      parameters: {
        type: "object",
        properties: {
          origem: {
            type: "string",
            description: "Caminho atual do arquivo ou pasta.",
          },
          destino: {
            type: "string",
            description: "Novo caminho de destino.",
          },
        },
        required: ["origem", "destino"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "copiar_arquivo",
      description:
        "Copia um arquivo para outro local. Disponível apenas com acesso ao computador habilitado.",
      parameters: {
        type: "object",
        properties: {
          origem: {
            type: "string",
            description: "Caminho do arquivo de origem.",
          },
          destino: {
            type: "string",
            description: "Caminho de destino da cópia.",
          },
        },
        required: ["origem", "destino"],
      },
    },
  },
];
