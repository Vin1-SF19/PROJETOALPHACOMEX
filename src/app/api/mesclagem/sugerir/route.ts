import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ErroMesclagem, LIMITE_COLUNAS_MESCLAGEM, sugerirMapeamentoMesclagem } from "@/lib/mesclagem";
import { mapeamentoEntradaSchema } from "@/lib/mesclagem/schemas";
import {
  MESCLAGEM_NO_STORE_HEADERS, registrarAuditoriaMesclagemBestEffort, verificarAcessoMesclagem,
} from "@/lib/mesclagem/autorizacao";
import { normalizarCabecalho } from "@/lib/mesclagem/mapeamento-deterministico";
import { adquirirLimiteMesclagem, obterIpMesclagem } from "@/lib/mesclagem/rate-limit";
import { validarJsonMesclagem } from "@/lib/mesclagem/http-guards";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const LIMITE_PAYLOAD_BYTES = 128 * 1024;
const colunaSchema = z.object({
  numero: z.number().int().positive().max(LIMITE_COLUNAS_MESCLAGEM),
  nome: z.string().trim().min(1).max(120),
  nomeNormalizado: z.string().max(120).optional(),
}).strict();
const payloadSchema = z.object({
  colunasPrincipal: z.array(colunaSchema).max(LIMITE_COLUNAS_MESCLAGEM),
  colunasComplementar: z.array(colunaSchema).max(LIMITE_COLUNAS_MESCLAGEM),
  mapeamento: mapeamentoEntradaSchema.optional(),
}).strict();

function jsonError(error: string, status: number, code: string) {
  return NextResponse.json({ success: false, error, code }, { status, headers: MESCLAGEM_NO_STORE_HEADERS });
}

export async function POST(request: NextRequest) {
  let userId: number | null = null;
  let liberarLimite: (() => void) | null = null;
  try {
    const acesso = await verificarAcessoMesclagem();
    if (!acesso.autorizado) {
      if (acesso.userId !== null) await registrarAuditoriaMesclagemBestEffort(acesso.userId, "MESCLAGEM_SUGERIR_NEGADA", "Sugestão negada; sucesso=false");
      return jsonError(acesso.status === 401 ? "Não autenticado" : "Sem permissão para usar mesclagem", acesso.status, acesso.code);
    }
    userId = acesso.userId;
    validarJsonMesclagem(request, LIMITE_PAYLOAD_BYTES);
    const limite = adquirirLimiteMesclagem(userId, obterIpMesclagem(request.headers));
    if (!limite.permitido) throw new ErroMesclagem("Já existe uma sugestão em processamento", limite.motivo, limite.motivo === "RATE_LIMIT" ? 429 : 409);
    liberarLimite = limite.liberar;
    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) throw new ErroMesclagem("Cabeçalhos ou mapeamento inválidos", "INVALID_PAYLOAD", 422);
    const normalizar = (colunas: typeof parsed.data.colunasPrincipal) => {
      const numeros = new Set<number>();
      return colunas.map((coluna) => {
        if (numeros.has(coluna.numero)) throw new ErroMesclagem("Índice de cabeçalho duplicado", "INVALID_HEADERS", 422);
        numeros.add(coluna.numero);
        return { numero: coluna.numero, nome: coluna.nome, nomeNormalizado: normalizarCabecalho(coluna.nome) };
      });
    };
    const resultado = await sugerirMapeamentoMesclagem({
      colunasPrincipal: normalizar(parsed.data.colunasPrincipal),
      colunasComplementar: normalizar(parsed.data.colunasComplementar),
      mapeamento: parsed.data.mapeamento,
    });
    await registrarAuditoriaMesclagemBestEffort(
      userId, "MESCLAGEM_SUGERIR",
      `Sugestão concluída; campos=${resultado.mapeamento.length}; iaStatus=${resultado.ia.status}; iaAplicados=${resultado.ia.aplicados}; duracaoMs=${resultado.ia.duracaoMs}; sucesso=true`,
    );
    return NextResponse.json({ success: true, data: resultado }, { headers: MESCLAGEM_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof ErroMesclagem) return jsonError(error.message, error.status, error.code);
    if (userId !== null) await registrarAuditoriaMesclagemBestEffort(userId, "MESCLAGEM_SUGERIR_FALHA", "Falha técnica na sugestão; sucesso=false");
    return jsonError("Não foi possível sugerir o mapeamento", 500, "SUGGESTION_FAILED");
  } finally {
    liberarLimite?.();
  }
}
