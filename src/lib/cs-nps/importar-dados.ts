import ExcelJS from "exceljs";
import JSZip from "jszip";
import { z } from "zod";

import {
  type CandidatoEmpresaImportacao,
  type DadosLinhaImportacao,
  type DadosLogImportacao,
  type DadosSocioImportacao,
  type IdentificadorEmpresaImportacao,
  type LinhaImportacaoPreview,
  type LinhaSalvarImportacao,
  type PrevisualizacaoImportacao,
  type ResumoEmpresaImportacao,
  type ResumoImportacaoSalva,
  type SentimentoImportacao,
  TIPOS_IMPORTACAO,
  type TipoImportacao,
  type TotaisImportacao,
} from "@/lib/cs-nps/importacao-tipos";
import db from "@/lib/prisma";
import {
  ErroPreflightXlsx,
  validarXlsxStreaming,
} from "@/lib/cs-nps/preflight-xlsx";

export const LIMITE_ARQUIVO_IMPORTACAO_BYTES = 10 * 1024 * 1024;
export const LIMITE_LINHAS_IMPORTACAO = 2_000;
const LIMITE_CLIENTES_PARA_MATCH = 10_000;

const NOMES_ABAS: Record<TipoImportacao, "Socios" | "CS" | "Feedbacks"> = {
  socios: "Socios",
  cs: "CS",
  feedbacks: "Feedbacks",
};

const CABECALHOS: Record<TipoImportacao, readonly string[]> = {
  socios: [
    "cnpj",
    "razaoSocial",
    "nome",
    "telefone",
    "observacao",
    "dataNascimento",
    "vinculo",
  ],
  cs: [
    "cnpj",
    "razaoSocial",
    "colaborador",
    "sentimento",
    "observacao",
    "dataRegistro",
  ],
  feedbacks: [
    "cnpj",
    "razaoSocial",
    "colaborador",
    "sentimento",
    "observacao",
    "dataRegistro",
  ],
};

const tipoSchema = z.enum(TIPOS_IMPORTACAO);
const identificadorSchema = z
  .object({
    cnpj: z.string().trim().max(32).nullable(),
    razaoSocial: z.string().trim().max(200).nullable(),
  })
  .strict()
  .refine((valor) => Boolean(valor.cnpj || valor.razaoSocial), {
    message: "Informe CNPJ ou razão social",
  });

const socioSchema = z
  .object({
    nome: z.string().trim().min(1).max(200),
    telefone: z.string().trim().max(50).nullable(),
    observacao: z.string().trim().max(1_000).nullable(),
    dataNascimento: z
      .string()
      .regex(/^\d{2}\/\d{2}\/\d{4}$/)
      .refine((valor) => valor === null || validarDataCanonica(valor, "br"), "Data inválida")
      .nullable(),
    vinculo: z.string().trim().max(100).nullable(),
  })
  .strict();

const logSchema = z
  .object({
    colaborador: z.string().trim().min(1).max(150),
    sentimento: z.enum(["pos", "neg", "na"]),
    observacao: z
      .string()
      .trim()
      .min(10)
      .max(140)
      .nullable(),
    dataRegistro: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((valor) => valor === null || validarDataCanonica(valor, "iso"), "Data inválida")
      .nullable(),
  })
  .strict();

const baseLinhaSalvarSchema = z.object({
  id: z.string().min(1).max(80),
  aba: z.enum(["Socios", "CS", "Feedbacks"]),
  numeroLinha: z.number().int().min(2).max(1_048_576),
  identificador: identificadorSchema,
  clienteId: z.number().int().positive(),
});

const linhaSocioSalvarSchema = baseLinhaSalvarSchema
  .extend({ tipo: z.literal("socios"), aba: z.literal("Socios"), dados: socioSchema })
  .strict();
const linhaCsSalvarSchema = baseLinhaSalvarSchema
  .extend({ tipo: z.literal("cs"), aba: z.literal("CS"), dados: logSchema })
  .strict();
const linhaFeedbackSalvarSchema = baseLinhaSalvarSchema
  .extend({
    tipo: z.literal("feedbacks"),
    aba: z.literal("Feedbacks"),
    dados: logSchema,
  })
  .strict();

export const payloadSalvarImportacaoSchema = z
  .object({
    linhas: z
      .array(
        z.discriminatedUnion("tipo", [
          linhaSocioSalvarSchema,
          linhaCsSalvarSchema,
          linhaFeedbackSalvarSchema,
        ]),
      )
      .min(1)
      .max(LIMITE_LINHAS_IMPORTACAO),
  })
  .strict();

type ClienteMatch = {
  id: number;
  cnpj: string;
  razaoSocial: string;
  servicos: string | null;
  status: string;
};

type LinhaLida = {
  id: string;
  tipo: TipoImportacao;
  aba: "Socios" | "CS" | "Feedbacks";
  numeroLinha: number;
  identificador: IdentificadorEmpresaImportacao;
  dados: DadosLinhaImportacao;
  erros: string[];
};

export class ErroImportacao extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: 400 | 403 | 409 | 413 | 422 | 429 = 400,
  ) {
    super(message);
    this.name = "ErroImportacao";
  }
}

export function validarTiposImportacao(valor: unknown): TipoImportacao[] {
  const resultado = z.array(tipoSchema).min(1).max(3).safeParse(valor);
  if (!resultado.success) {
    throw new ErroImportacao(
      "Selecione ao menos um tipo de importação válido",
      "INVALID_TYPES",
    );
  }
  return [...new Set(resultado.data)];
}

export function validarArquivoImportacao(arquivo: File): void {
  const nome = arquivo.name.trim().toLowerCase();
  const mimesAceitos = new Set([
    "",
    "application/octet-stream",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);

  if (!nome.endsWith(".xlsx") || nome.endsWith(".xlsm") || !mimesAceitos.has(arquivo.type)) {
    throw new ErroImportacao("Envie somente um arquivo .xlsx", "INVALID_FILE_TYPE");
  }
  if (arquivo.size <= 0) {
    throw new ErroImportacao("O arquivo está vazio", "EMPTY_FILE");
  }
  if (arquivo.size > LIMITE_ARQUIVO_IMPORTACAO_BYTES) {
    throw new ErroImportacao(
      "O arquivo excede o limite de 10 MB",
      "FILE_TOO_LARGE",
      413,
    );
  }
}

function aplicarCabecalho(worksheet: ExcelJS.Worksheet, totalColunas: number): void {
  const linha = worksheet.getRow(1);
  linha.height = 28;
  linha.font = { bold: true, color: { argb: "FFFFFFFF" } };
  linha.alignment = { vertical: "middle", horizontal: "center" };
  linha.eachCell({ includeEmpty: true }, (cell, coluna) => {
    if (coluna <= totalColunas) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF312E81" } },
      };
    }
  });
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: totalColunas } };
}

function adicionarAbaModelo(workbook: ExcelJS.Workbook, tipo: TipoImportacao): void {
  const cabecalhos = CABECALHOS[tipo];
  const worksheet = workbook.addWorksheet(NOMES_ABAS[tipo]);
  worksheet.addRow([...cabecalhos]);
  aplicarCabecalho(worksheet, cabecalhos.length);
  worksheet.columns = cabecalhos.map((cabecalho) => ({
    key: cabecalho,
    width:
      cabecalho === "razaoSocial" || cabecalho === "observacao"
        ? 34
        : cabecalho.startsWith("data")
          ? 18
          : 22,
  }));

  if (tipo !== "socios") {
    for (let linha = 2; linha <= 2_001; linha += 1) {
      worksheet.getCell(linha, 1).numFmt = "@";
      worksheet.getCell(linha, 4).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"pos,neg,na"'],
        showErrorMessage: true,
        errorTitle: "Sentimento inválido",
        error: "Use pos, neg ou na.",
      };
      worksheet.getCell(linha, 6).numFmt = "dd/mm/yyyy";
    }
  } else {
    for (let linha = 2; linha <= 2_001; linha += 1) {
      worksheet.getCell(linha, 1).numFmt = "@";
      worksheet.getCell(linha, 4).numFmt = "@";
      worksheet.getCell(linha, 6).numFmt = "dd/mm/yyyy";
    }
  }
}

export async function gerarModeloImportacao(tipos: TipoImportacao[]): Promise<Buffer> {
  const tiposValidos = validarTiposImportacao(tipos);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Painel Alpha";
  workbook.created = new Date();
  workbook.modified = new Date();

  const instrucoes = workbook.addWorksheet("Instrucoes");
  instrucoes.columns = [{ width: 28 }, { width: 100 }];
  instrucoes.addRow(["IMPORTAÇÃO EM LOTE - CS & NPS"]);
  instrucoes.mergeCells("A1:B1");
  instrucoes.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  instrucoes.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF312E81" },
  };
  instrucoes.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  instrucoes.getRow(1).height = 34;
  const orientacoes: Array<[string, string]> = [
    ["Identificação", "Preencha CNPJ ou razaoSocial. Se preencher ambos, precisam apontar para a mesma empresa."],
    ["Vários sócios", "Use uma linha por sócio e repita o mesmo CNPJ ou razão social em todas as linhas."],
    ["Datas", "Use DD/MM/AAAA ou AAAA-MM-DD. Células de data do Excel também são aceitas."],
    ["CNPJ e telefone", "Preencha as colunas de CNPJ e telefone como texto para preservar zeros à esquerda."],
    ["Sentimento", "Nas abas CS e Feedbacks, use somente pos, neg ou na."],
    ["Observações de logs", "Quando preenchidas, devem ter entre 10 e 140 caracteres."],
    ["Limites", "Somente .xlsx, até 10 MB e no máximo 2.000 linhas somadas."],
    ["Exemplo de empresa", "CNPJ fictício: 00.000.000/0000-00; razão social fictícia: EMPRESA EXEMPLO LTDA."],
    ["Importante", "Não renomeie abas ou cabeçalhos e não adicione colunas. Fórmulas não são aceitas."],
  ];
  orientacoes.forEach(([titulo, texto]) => instrucoes.addRow([titulo, texto]));
  instrucoes.eachRow((row, numero) => {
    if (numero > 1) {
      row.alignment = { vertical: "top", wrapText: true };
      row.getCell(1).font = { bold: true, color: { argb: "FF312E81" } };
      row.height = 32;
    }
  });

  tiposValidos.forEach((tipo) => adicionarAbaModelo(workbook, tipo));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function valorTemFormula(valor: ExcelJS.CellValue): boolean {
  if (valor === null || typeof valor !== "object" || valor instanceof Date) return false;
  return "formula" in valor || "sharedFormula" in valor;
}

function textoCelula(cell: ExcelJS.Cell): string {
  const valor = cell.value;
  if (valorTemFormula(valor)) {
    throw new ErroImportacao(
      `Fórmulas não são permitidas (${cell.worksheet.name}!${cell.address})`,
      "FORMULA_NOT_ALLOWED",
      422,
    );
  }
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") {
    return String(valor).trim();
  }
  if (valor instanceof Date) return valor.toISOString();
  throw new ErroImportacao(
    `Célula não suportada em ${cell.worksheet.name}!${cell.address}`,
    "UNSUPPORTED_CELL",
    422,
  );
}

function linhaPossuiConteudo(row: ExcelJS.Row): boolean {
  let possui = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cell.value !== null && cell.value !== "") possui = true;
  });
  return possui;
}

function normalizarCnpj(valor: string | null): string {
  return (valor ?? "").replace(/\D/g, "");
}

function normalizarRazaoSocial(valor: string | null): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

interface IndiceClientes {
  porCnpj: Map<string, ClienteMatch[]>;
  porRazao: Map<string, ClienteMatch[]>;
}

function criarIndiceClientes(clientes: ClienteMatch[]): IndiceClientes {
  const indice: IndiceClientes = { porCnpj: new Map(), porRazao: new Map() };
  for (const cliente of clientes) {
    const cnpj = normalizarCnpj(cliente.cnpj);
    const razao = normalizarRazaoSocial(cliente.razaoSocial);
    if (cnpj) indice.porCnpj.set(cnpj, [...(indice.porCnpj.get(cnpj) ?? []), cliente]);
    if (razao) indice.porRazao.set(razao, [...(indice.porRazao.get(razao) ?? []), cliente]);
  }
  return indice;
}

function dataCivilValida(ano: number, mes: number, dia: number): boolean {
  if (ano < 1900 || ano > 9999 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia, 12));
  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

function validarDataCanonica(valor: string, formato: "br" | "iso"): boolean {
  const match =
    formato === "br"
      ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor)
      : /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!match) return false;
  const partes: [number, number, number] =
    formato === "br"
      ? [Number(match[3]), Number(match[2]), Number(match[1])]
      : [Number(match[1]), Number(match[2]), Number(match[3])];
  return dataCivilValida(...partes);
}

function partesData(valor: ExcelJS.CellValue, date1904: boolean): [number, number, number] | null {
  if (valor instanceof Date) {
    return [valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate()];
  }
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const base = Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30);
    const data = new Date(base + Math.floor(valor) * 86_400_000);
    return [data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate()];
  }
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (match) return [Number(match[3]), Number(match[2]), Number(match[1])];
  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
  return null;
}

function lerData(
  cell: ExcelJS.Cell,
  date1904: boolean,
  formato: "br" | "iso",
): { valor: string | null; erro: string | null } {
  if (valorTemFormula(cell.value)) {
    return { valor: null, erro: "Fórmulas não são permitidas" };
  }
  if (cell.value === null || cell.value === "") return { valor: null, erro: null };
  const partes = partesData(cell.value, date1904);
  if (!partes || !dataCivilValida(...partes)) {
    return { valor: null, erro: "Data inválida; use DD/MM/AAAA ou AAAA-MM-DD" };
  }
  const [ano, mes, dia] = partes;
  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  return {
    valor: formato === "br" ? `${dd}/${mm}/${ano}` : `${ano}-${mm}-${dd}`,
    erro: null,
  };
}

function validarTexto(
  valor: string,
  campo: string,
  maximo: number,
  erros: string[],
  minimo = 0,
): string | null {
  const texto = valor.trim();
  if (!texto) return null;
  if (texto.length < minimo || texto.length > maximo) {
    erros.push(`${campo} deve ter entre ${minimo} e ${maximo} caracteres`);
  }
  return texto;
}

function lerIdentificador(row: ExcelJS.Row, erros: string[]): IdentificadorEmpresaImportacao {
  const cnpjTexto = textoCelula(row.getCell(1));
  const razaoTexto = textoCelula(row.getCell(2));
  const cnpj = validarTexto(cnpjTexto, "CNPJ", 32, erros);
  const razaoSocial = validarTexto(razaoTexto, "Razão social", 200, erros);
  if (!cnpj && !razaoSocial) erros.push("Informe CNPJ ou razão social");
  if (cnpj && normalizarCnpj(cnpj).length !== 14) erros.push("CNPJ deve conter 14 dígitos");
  return { cnpj, razaoSocial };
}

function lerDadosSocio(row: ExcelJS.Row, date1904: boolean, erros: string[]): DadosSocioImportacao {
  const nome = validarTexto(textoCelula(row.getCell(3)), "Nome", 200, erros);
  if (!nome) erros.push("Nome do sócio é obrigatório");
  const telefone = validarTexto(textoCelula(row.getCell(4)), "Telefone", 50, erros);
  const observacao = validarTexto(textoCelula(row.getCell(5)), "Observação", 1_000, erros);
  const data = lerData(row.getCell(6), date1904, "br");
  if (data.erro) erros.push(data.erro);
  const vinculo = validarTexto(textoCelula(row.getCell(7)), "Vínculo", 100, erros);
  return { nome: nome ?? "", telefone, observacao, dataNascimento: data.valor, vinculo };
}

function normalizarSentimento(valor: string): SentimentoImportacao | null {
  const normalizado = valor.trim().toLocaleLowerCase("pt-BR").replace(/[^a-z]/g, "");
  if (normalizado === "pos") return "pos";
  if (normalizado === "neg") return "neg";
  if (normalizado === "na") return "na";
  return null;
}

function lerDadosLog(row: ExcelJS.Row, date1904: boolean, erros: string[]): DadosLogImportacao {
  const colaborador = validarTexto(textoCelula(row.getCell(3)), "Colaborador", 150, erros);
  if (!colaborador) erros.push("Colaborador é obrigatório");
  const sentimento = normalizarSentimento(textoCelula(row.getCell(4)));
  if (!sentimento) erros.push("Sentimento deve ser pos, neg ou na");
  const observacaoTexto = textoCelula(row.getCell(5));
  const observacao = validarTexto(observacaoTexto, "Observação", 140, erros, 10);
  const data = lerData(row.getCell(6), date1904, "iso");
  if (data.erro) erros.push(data.erro);
  return {
    colaborador: colaborador ?? "",
    sentimento: sentimento ?? "na",
    observacao,
    dataRegistro: data.valor,
  };
}

function validarEstruturaAba(worksheet: ExcelJS.Worksheet, tipo: TipoImportacao): void {
  const esperados = CABECALHOS[tipo];
  const header = worksheet.getRow(1);
  esperados.forEach((esperado, indice) => {
    const atual = textoCelula(header.getCell(indice + 1));
    if (atual !== esperado) {
      throw new ErroImportacao(
        `Cabeçalho inválido na aba ${worksheet.name}: esperado "${esperado}" na coluna ${indice + 1}`,
        "INVALID_HEADER",
        422,
      );
    }
  });
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell, coluna) => {
      if (valorTemFormula(cell.value)) {
        throw new ErroImportacao(
          `Fórmulas não são permitidas (${worksheet.name}!${cell.address})`,
          "FORMULA_NOT_ALLOWED",
          422,
        );
      }
      if (coluna > esperados.length && cell.value !== null && cell.value !== "") {
        throw new ErroImportacao(
          `Coluna inesperada na aba ${worksheet.name}`,
          "UNEXPECTED_COLUMN",
          422,
        );
      }
    });
  });
}

async function carregarClientesParaMatch(): Promise<ClienteMatch[]> {
  const clientes = await db.clientes.findMany({
    take: LIMITE_CLIENTES_PARA_MATCH + 1,
    select: { id: true, cnpj: true, razaoSocial: true, servicos: true, status: true },
    orderBy: { id: "asc" },
  });
  if (clientes.length > LIMITE_CLIENTES_PARA_MATCH) {
    throw new ErroImportacao(
      "A base excede o limite operacional para conferência; contate o suporte",
      "CLIENT_MATCH_CAPACITY",
      422,
    );
  }
  return clientes;
}

function candidatosDaLinha(
  identificador: IdentificadorEmpresaImportacao,
  indice: IndiceClientes,
): { candidatos: ClienteMatch[]; mensagem: string | null } {
  const cnpj = normalizarCnpj(identificador.cnpj);
  const razao = normalizarRazaoSocial(identificador.razaoSocial);
  const porCnpj = cnpj ? (indice.porCnpj.get(cnpj) ?? []) : [];
  const porRazao = razao ? (indice.porRazao.get(razao) ?? []) : [];

  if (cnpj && razao) {
    const idsRazao = new Set(porRazao.map((cliente) => cliente.id));
    const intersecao = porCnpj.filter((cliente) => idsRazao.has(cliente.id));
    if (intersecao.length === 0) {
      return {
        candidatos: [],
        mensagem:
          porCnpj.length > 0 || porRazao.length > 0
            ? "CNPJ e razão social não apontam para o mesmo cadastro"
            : "Empresa não encontrada",
      };
    }
    return { candidatos: intersecao, mensagem: null };
  }

  const candidatos = cnpj ? porCnpj : porRazao;
  return {
    candidatos,
    mensagem: candidatos.length === 0 ? "Empresa não encontrada" : null,
  };
}

function candidatoPublico(cliente: ClienteMatch): CandidatoEmpresaImportacao {
  return {
    clienteId: cliente.id,
    cnpj: cliente.cnpj,
    razaoSocial: cliente.razaoSocial,
    servico: cliente.servicos,
    status: cliente.status,
  };
}

function calcularTotais(linhas: LinhaImportacaoPreview[]): TotaisImportacao {
  const porTipo: Record<TipoImportacao, number> = { socios: 0, cs: 0, feedbacks: 0 };
  linhas.forEach((linha) => {
    porTipo[linha.tipo] += 1;
  });
  return {
    total: linhas.length,
    validas: linhas.filter((linha) => linha.status === "valida").length,
    ambiguas: linhas.filter((linha) => linha.status === "ambigua").length,
    invalidas: linhas.filter((linha) => linha.status === "invalida").length,
    porTipo,
  };
}

interface MetadadosCompactacaoZip {
  compressedSize: number;
  uncompressedSize: number;
}

function lerMetadadosCompactacao(valor: unknown): MetadadosCompactacaoZip | null {
  if (typeof valor !== "object" || valor === null) return null;
  const compressedSize = Reflect.get(valor, "compressedSize");
  const uncompressedSize = Reflect.get(valor, "uncompressedSize");
  if (
    typeof compressedSize !== "number" ||
    !Number.isSafeInteger(compressedSize) ||
    compressedSize < 0 ||
    typeof uncompressedSize !== "number" ||
    !Number.isSafeInteger(uncompressedSize) ||
    uncompressedSize < 0
  ) {
    return null;
  }
  return { compressedSize, uncompressedSize };
}

function validarDiretorioCentralZip(buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const inicioBusca = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let indice = bytes.length - 22; indice >= inicioBusca; indice -= 1) {
    if (view.getUint32(indice, true) === 0x06054b50) {
      eocd = indice;
      break;
    }
  }
  if (eocd < 0) throw new ErroImportacao("Diretório central ZIP inválido", "INVALID_ZIP", 422);

  const totalEntradas = view.getUint16(eocd + 10, true);
  const tamanhoDiretorio = view.getUint32(eocd + 12, true);
  const inicioDiretorio = view.getUint32(eocd + 16, true);
  const possuiLocatorZip64 = eocd >= 20 && view.getUint32(eocd - 20, true) === 0x07064b50;
  if (
    totalEntradas === 0xffff ||
    tamanhoDiretorio === 0xffffffff ||
    inicioDiretorio === 0xffffffff ||
    possuiLocatorZip64
  ) {
    throw new ErroImportacao("Arquivos ZIP64 não são aceitos", "ZIP64_NOT_ALLOWED", 422);
  }
  if (totalEntradas > 256) {
    throw new ErroImportacao("A planilha possui arquivos internos demais", "TOO_MANY_ZIP_ENTRIES", 422);
  }
  if (inicioDiretorio + tamanhoDiretorio > buffer.byteLength) {
    throw new ErroImportacao("Diretório central ZIP inválido", "INVALID_ZIP", 422);
  }

  let cursor = inicioDiretorio;
  for (let entrada = 0; entrada < totalEntradas; entrada += 1) {
    if (cursor + 46 > buffer.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new ErroImportacao("Diretório central ZIP inválido", "INVALID_ZIP", 422);
    }
    const flags = view.getUint16(cursor + 8, true);
    if ((flags & 0x0001) !== 0) {
      throw new ErroImportacao("Arquivos ZIP criptografados não são aceitos", "ENCRYPTED_ZIP", 422);
    }
    const nome = view.getUint16(cursor + 28, true);
    const extra = view.getUint16(cursor + 30, true);
    const comentario = view.getUint16(cursor + 32, true);
    cursor += 46 + nome + extra + comentario;
  }
  if (cursor > inicioDiretorio + tamanhoDiretorio) {
    throw new ErroImportacao("Diretório central ZIP inválido", "INVALID_ZIP", 422);
  }
}

async function validarEstruturaZipXlsx(buffer: ArrayBuffer): Promise<void> {
  validarDiretorioCentralZip(buffer);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: false, createFolders: false });
  } catch {
    throw new ErroImportacao("Estrutura ZIP da planilha é inválida", "INVALID_ZIP", 422);
  }

  const entradas = Object.values(zip.files);
  if (entradas.length > 256) {
    throw new ErroImportacao("A planilha possui arquivos internos demais", "TOO_MANY_ZIP_ENTRIES", 422);
  }
  for (const obrigatoria of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"]) {
    if (!zip.file(obrigatoria)) {
      throw new ErroImportacao("A estrutura interna do .xlsx está incompleta", "INVALID_XLSX_STRUCTURE", 422);
    }
  }
  if (entradas.some((entrada) => entrada.name.toLocaleLowerCase("en-US") === "xl/vbaproject.bin")) {
    throw new ErroImportacao("Planilhas com macros não são aceitas", "MACRO_NOT_ALLOWED", 422);
  }

  let totalComprimido = 0;
  let totalDescomprimido = 0;
  for (const entrada of entradas) {
    if (entrada.dir) continue;
    if (entrada.unsafeOriginalName && entrada.unsafeOriginalName !== entrada.name) {
      throw new ErroImportacao("Caminho interno inseguro no arquivo", "UNSAFE_ZIP_PATH", 422);
    }
    const metadados = lerMetadadosCompactacao(Reflect.get(entrada, "_data"));
    if (!metadados) {
      throw new ErroImportacao("Metadados ZIP não verificáveis", "INVALID_ZIP_METADATA", 422);
    }
    if (metadados.uncompressedSize > 20 * 1024 * 1024) {
      throw new ErroImportacao("Um arquivo interno excede 20 MB", "ZIP_ENTRY_TOO_LARGE", 413);
    }
    if (metadados.compressedSize === 0 && metadados.uncompressedSize > 0) {
      throw new ErroImportacao("Taxa de compressão ZIP inválida", "ZIP_BOMB", 413);
    }
    if (
      metadados.compressedSize > 0 &&
      metadados.uncompressedSize / metadados.compressedSize > 100
    ) {
      throw new ErroImportacao("Taxa de compressão ZIP excede o limite", "ZIP_BOMB", 413);
    }
    totalComprimido += metadados.compressedSize;
    totalDescomprimido += metadados.uncompressedSize;
  }
  if (totalDescomprimido > 50 * 1024 * 1024) {
    throw new ErroImportacao("Conteúdo descompactado excede 50 MB", "ZIP_TOO_LARGE", 413);
  }
  if (
    (totalComprimido === 0 && totalDescomprimido > 0) ||
    (totalComprimido > 0 && totalDescomprimido / totalComprimido > 100)
  ) {
    throw new ErroImportacao("Taxa total de compressão ZIP excede o limite", "ZIP_BOMB", 413);
  }
}

export async function previsualizarImportacao(
  buffer: ArrayBuffer,
  nomeArquivo: string,
  tipos: TipoImportacao[],
): Promise<PrevisualizacaoImportacao> {
  if (buffer.byteLength > LIMITE_ARQUIVO_IMPORTACAO_BYTES) {
    throw new ErroImportacao("O arquivo excede o limite de 10 MB", "FILE_TOO_LARGE", 413);
  }
  const assinatura = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 2));
  if (assinatura[0] !== 0x50 || assinatura[1] !== 0x4b) {
    throw new ErroImportacao("O arquivo .xlsx é inválido", "INVALID_XLSX");
  }
  await validarEstruturaZipXlsx(buffer);
  try {
    await validarXlsxStreaming(buffer);
  } catch (error) {
    if (error instanceof ErroPreflightXlsx) {
      throw new ErroImportacao(error.message, error.code, error.status);
    }
    throw new ErroImportacao("Falha no preflight streaming do .xlsx", "INVALID_ZIP_STREAM", 422);
  }

  const tiposValidos = validarTiposImportacao(tipos);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ErroImportacao("Não foi possível ler o arquivo .xlsx", "INVALID_XLSX");
  }

  const abasPermitidas = new Set(["Instrucoes", ...tiposValidos.map((tipo) => NOMES_ABAS[tipo])]);
  const abaInesperada = workbook.worksheets.find((sheet) => !abasPermitidas.has(sheet.name));
  if (abaInesperada) {
    throw new ErroImportacao(
      `Aba inesperada: ${abaInesperada.name}`,
      "UNEXPECTED_SHEET",
      422,
    );
  }

  const linhasLidas: LinhaLida[] = [];
  const date1904 = workbook.properties.date1904 === true;
  for (const tipo of tiposValidos) {
    const nomeAba = NOMES_ABAS[tipo];
    const worksheet = workbook.getWorksheet(nomeAba);
    if (!worksheet) {
      throw new ErroImportacao(`Aba selecionada ausente: ${nomeAba}`, "MISSING_SHEET", 422);
    }
    validarEstruturaAba(worksheet, tipo);

    worksheet.eachRow({ includeEmpty: false }, (row, numeroLinha) => {
      if (numeroLinha === 1 || !linhaPossuiConteudo(row)) return;
      if (linhasLidas.length >= LIMITE_LINHAS_IMPORTACAO) {
        throw new ErroImportacao(
          "A planilha excede o limite de 2.000 linhas",
          "TOO_MANY_ROWS",
          413,
        );
      }
      const erros: string[] = [];
      const identificador = lerIdentificador(row, erros);
      const dados =
        tipo === "socios"
          ? lerDadosSocio(row, date1904, erros)
          : lerDadosLog(row, date1904, erros);
      linhasLidas.push({
        id: `${tipo}:${numeroLinha}`,
        tipo,
        aba: nomeAba,
        numeroLinha,
        identificador,
        dados,
        erros: [...new Set(erros)],
      });
    });
  }

  if (linhasLidas.length === 0) {
    throw new ErroImportacao("A planilha não possui linhas para importar", "EMPTY_WORKBOOK", 422);
  }

  const clientes = await carregarClientesParaMatch();
  const indiceClientes = criarIndiceClientes(clientes);
  const assinaturas = new Map<string, number>();
  const linhas = linhasLidas.map<LinhaImportacaoPreview>((linha) => {
    const mensagens = [...linha.erros];
    const resultado = linha.erros.length
      ? { candidatos: [] as ClienteMatch[], mensagem: null }
      : candidatosDaLinha(linha.identificador, indiceClientes);
    if (resultado.mensagem) mensagens.push(resultado.mensagem);
    const candidatos = resultado.candidatos.map(candidatoPublico);
    const assinatura = JSON.stringify({
      tipo: linha.tipo,
      identificador: linha.identificador,
      dados: linha.dados,
    });
    const ocorrencias = (assinaturas.get(assinatura) ?? 0) + 1;
    assinaturas.set(assinatura, ocorrencias);
    if (ocorrencias > 1) mensagens.push("Possível linha duplicada no arquivo");

    const invalida = linha.erros.length > 0 || candidatos.length === 0;
    return {
      id: linha.id,
      tipo: linha.tipo,
      aba: linha.aba,
      numeroLinha: linha.numeroLinha,
      identificador: linha.identificador,
      dados: linha.dados,
      status: invalida ? "invalida" : candidatos.length === 1 ? "valida" : "ambigua",
      clienteIdSugerido: candidatos.length === 1 ? candidatos[0].clienteId : null,
      candidatos,
      mensagens,
    };
  });

  return {
    arquivo: nomeArquivo.slice(0, 255),
    tipos: tiposValidos,
    totais: calcularTotais(linhas),
    linhas,
  };
}

function dataRegistroParaDate(valor: string | null): Date {
  if (!valor) return new Date();
  const data = new Date(`${valor}T12:00:00.000Z`);
  if (Number.isNaN(data.getTime())) {
    throw new ErroImportacao("Data de registro inválida", "INVALID_DATE", 422);
  }
  return data;
}

function criarResumoEmpresa(cliente: ClienteMatch): ResumoEmpresaImportacao {
  return {
    clienteId: cliente.id,
    cnpj: cliente.cnpj,
    razaoSocial: cliente.razaoSocial,
    servico: cliente.servicos,
    status: cliente.status,
    total: 0,
    socios: 0,
    cs: 0,
    feedbacks: 0,
    linhasOrigem: [],
  };
}

export async function salvarImportacao(
  linhas: LinhaSalvarImportacao[],
  userId: number,
): Promise<ResumoImportacaoSalva> {
  const validacao = payloadSalvarImportacaoSchema.safeParse({ linhas });
  if (!validacao.success) {
    throw new ErroImportacao("Existem linhas inválidas para salvar", "INVALID_SAVE_PAYLOAD", 422);
  }

  const linhasSocios = validacao.data.linhas.filter(
    (linha): linha is z.infer<typeof linhaSocioSalvarSchema> => linha.tipo === "socios",
  );
  const linhasCs = validacao.data.linhas.filter(
    (linha): linha is z.infer<typeof linhaCsSalvarSchema> => linha.tipo === "cs",
  );
  const linhasFeedbacks = validacao.data.linhas.filter(
    (linha): linha is z.infer<typeof linhaFeedbackSalvarSchema> => linha.tipo === "feedbacks",
  );

  return db.$transaction(async (tx) => {
    const ator = await tx.usuarios.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    const role = ator?.role.trim().toLocaleLowerCase("pt-BR");
    if (ator?.status !== "ATIVO" || (role !== "admin" && role !== "ceo")) {
      throw new ErroImportacao(
        "A autorização mudou antes da confirmação",
        "AUTHORIZATION_CHANGED",
        403,
      );
    }

    const clientes = await tx.clientes.findMany({
      take: LIMITE_CLIENTES_PARA_MATCH + 1,
      select: { id: true, cnpj: true, razaoSocial: true, servicos: true, status: true },
      orderBy: { id: "asc" },
    });
    if (clientes.length > LIMITE_CLIENTES_PARA_MATCH) {
      throw new ErroImportacao(
        "A base excede o limite operacional para conferência; contate o suporte",
        "CLIENT_MATCH_CAPACITY",
        422,
      );
    }
    const indiceClientes = criarIndiceClientes(clientes);
    const clientesPorId = new Map(clientes.map((cliente) => [cliente.id, cliente]));
    for (const linha of validacao.data.linhas) {
      const resultado = candidatosDaLinha(linha.identificador, indiceClientes);
      if (!resultado.candidatos.some((candidato) => candidato.id === linha.clienteId)) {
        throw new ErroImportacao(
          `O destino da linha ${linha.aba} ${linha.numeroLinha} não é mais válido`,
          "INVALID_CLIENT_TARGET",
          422,
        );
      }
    }

    if (linhasSocios.length > 0) {
      await tx.socios.createMany({
        data: linhasSocios.map((linha) => ({
          clienteId: linha.clienteId,
          nome: linha.dados.nome,
          telefone: linha.dados.telefone,
          obs: linha.dados.observacao,
          dataNascimento: linha.dados.dataNascimento,
          vinculo: linha.dados.vinculo,
        })),
      });
    }
    if (linhasCs.length > 0) {
      await tx.log_cs.createMany({
        data: linhasCs.map((linha) => ({
          clienteId: linha.clienteId,
          colaborador: linha.dados.colaborador,
          sentimento: linha.dados.sentimento,
          observacao: linha.dados.observacao,
          dataRegistro: dataRegistroParaDate(linha.dados.dataRegistro),
        })),
      });
    }
    if (linhasFeedbacks.length > 0) {
      await tx.logFeedback.createMany({
        data: linhasFeedbacks.map((linha) => ({
          clienteId: linha.clienteId,
          colaborador: linha.dados.colaborador,
          sentimento: linha.dados.sentimento,
          observacao: linha.dados.observacao,
          dataRegistro: dataRegistroParaDate(linha.dados.dataRegistro),
        })),
      });
    }

    const resumoPorEmpresa = new Map<number, ResumoEmpresaImportacao>();
    validacao.data.linhas.forEach((linha) => {
      const cliente = clientesPorId.get(linha.clienteId);
      if (!cliente) return;
      const resumo = resumoPorEmpresa.get(cliente.id) ?? criarResumoEmpresa(cliente);
      resumo.total += 1;
      resumo[linha.tipo] += 1;
      resumo.linhasOrigem.push({
        id: linha.id,
        tipo: linha.tipo,
        aba: linha.aba,
        numeroLinha: linha.numeroLinha,
      });
      resumoPorEmpresa.set(cliente.id, resumo);
    });

    const resumo: ResumoImportacaoSalva = {
      total: validacao.data.linhas.length,
      socios: linhasSocios.length,
      cs: linhasCs.length,
      feedbacks: linhasFeedbacks.length,
      empresasAfetadas: resumoPorEmpresa.size,
      empresas: [...resumoPorEmpresa.values()].sort((a, b) =>
        a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR"),
      ),
    };
    await tx.auditoria.create({
      data: {
        userId,
        acao: "IMPORTAR_CS_NPS_SALVO",
        detalhes: `Importação confirmada; tipos=socios:${resumo.socios},cs:${resumo.cs},feedbacks:${resumo.feedbacks}; total=${resumo.total}; empresas=${resumo.empresasAfetadas}; sucesso=true`,
      },
      select: { id: true },
    });
    return resumo;
  });
}
