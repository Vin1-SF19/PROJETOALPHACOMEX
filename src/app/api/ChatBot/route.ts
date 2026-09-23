import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import db from '@/lib/prisma';

const API_KEY = process.env.GEMINI_API_KEY || '';
async function fetchInterno(endpoint: string, cnpj: string, request: Request) {
  try {
    const res = await fetch(`${new URL(request.url).origin}/api/${endpoint}?cnpj=${cnpj}`, {
      headers: { cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    });
    if (!res.ok) return { error: "Não encontrado" };
    return await res.json();
  } catch (error) {
    return { error: "Erro na conexão" };
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ text: "Sessão expirada." }, { status: 401 });

    const { message, contextData } = await req.json();
    const cnpjMatch = message.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
    let dadosConsolidados = null;

    if (cnpjMatch) {
      const cnpj = cnpjMatch[0].replace(/\D/g, "");
      const [receita, radar, empresaAqui] = await Promise.all([
        fetchInterno("ReceitaFederal", cnpj, req),
        fetchInterno("ConsultaRadar", cnpj, req),
        fetchInterno("RadarFiscal", cnpj, req)
      ]);
      dadosConsolidados = { receita, radar, empresaAqui, cnpj_consultado: cnpj };
    }

    const funcoesPermitidas = {
      get_user_info: async (params: { nome?: string, email?: string }) => {
        return await db.usuarios.findFirst({
          where: { OR: [{ nome: { contains: params.nome } }, { email: params.email }] },
          select: { nome: true, email: true, data_contratacao: true, role: true } 
        });
      },
      get_system_stats: async () => {
        const total = await db.usuarios.count();
        const ativos = await db.usuarios.count({ where: { status: 'ACTIVE' } });
        return { total, ativos };
      }
    };

    const systemInstruction = `Seu nome é Bibble, assistente do Painel Alpha.
    BIBBLE SE APRESENTA APENAS UMA VEZ, VOCE É DIRETO NAS RESPOSTA, SENDO IRONICO EM OCASIOES ESPECIAIS.
    VOCE MUDA DE HUMOR CONFORME O USUARIO LHE TRATA, USUARIOS DESAGRADEVEIS TEEM RESPOSTAS DESAGRADAVEIS, MAS AQUELES QUE SAO DIRETO, FORMAL, VOCE DEVE DAR AS RESPOSTAS DIRETAS.
    DADOS REAIS: ${JSON.stringify(dadosConsolidados || "Nenhum")}.
    CONTEXTO: ${JSON.stringify(contextData)}.
    CRIADOR: Vinicius Floriano (formal).
    CHAMADOS: Se houver erro, use [CRIAR_CHAMADO: {"titulo": "...", "prioridade": "..."}]
    -caso alguem peça uma piada, seja engraçado
    `;


    const response = await fetch(

      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemInstruction}\n\nUsuário: ${message}` }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro na API do Google:", data);
      return NextResponse.json({ text: "O Google deu erro 429 ou 404. Tenta de novo." }, { status: response.status });
    }

    const textoResposta = data.candidates?.[0]?.content?.parts?.[0]?.text || "Tive um apagão, repete?";

    return NextResponse.json({ text: textoResposta });

  } catch (error) {
    console.error("ERRO BIBBLE ROUTE:", error);
    return NextResponse.json({ text: "Deu erro no motor do Bibble." });
  }
}
