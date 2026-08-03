import ExcelJS from "exceljs";

import db from "@/lib/prisma";

const clienteSelect = {
  id: true,
  status: true,
  cnpj: true,
  razaoSocial: true,
  nomeFantasia: true,
  dataConstituicao: true,
  uf: true,
  municipio: true,
  regimeTributario: true,
  servicos: true,
  analistaResponsavel: true,
  dataContratacao: true,
  dataExito: true,
  formaPagamento: true,
  valorContrato: true,
  closerNome: true,
  ultimoCs: true,
  nps: true,
  feedbackGoogle: true,
  createdAt: true,
  updatedAt: true,
  nomeGoogle: true,
  embasamento: true,
  origemLead: true,
  canalAquisicao: true,
  canalOutro: true,
  socios: {
    select: {
      id: true,
      nome: true,
      telefone: true,
      obs: true,
      dataNascimento: true,
      vinculo: true,
      clienteId: true,
    },
  },
  log_cs: {
    select: {
      id: true,
      dataRegistro: true,
      colaborador: true,
      sentimento: true,
      observacao: true,
      clienteId: true,
    },
  },
  logFeedback: {
    select: {
      id: true,
      dataRegistro: true,
      colaborador: true,
      sentimento: true,
      observacao: true,
      clienteId: true,
    },
  },
  logAlteracao: {
    select: {
      id: true,
      dataAlteracao: true,
      colaborador: true,
      acao: true,
      dadosAnteriores: true,
      clienteId: true,
    },
  },
  historicoAlteracoes: {
    select: {
      id: true,
      loteId: true,
      clienteId: true,
      campo: true,
      valorAnterior: true,
      valorNovo: true,
      userId: true,
      nomeUsuarioNaEpoca: true,
      acao: true,
      criadoEm: true,
    },
  },
  indicacao: {
    select: {
      id: true,
      parceiroId: true,
      clienteId: true,
      dataIndicacao: true,
      status: true,
      criadoPorId: true,
      comprovanteUrl: true,
      comprovanteNome: true,
      comprovanteTipo: true,
      comprovanteEnviadoEm: true,
      comprovanteEnviadoPor: true,
      createdAt: true,
    },
  },
} as const;

type ExportValue = string | number | boolean | Date | null;
type ExportRow = Record<string, ExportValue>;

interface ExportSheet {
  name: string;
  headers: string[];
  rows: ExportRow[];
  dateColumns?: Record<string, "date-only" | "date-time">;
}

const CORES = {
  cabecalho: "FF0F172A",
  cabecalhoTexto: "FFFFFFFF",
  borda: "FFD7DEE8",
  zebra: "FFF1F5F9",
  texto: "FF1E293B",
  verdeFundo: "FFDCFCE7",
  verdeTexto: "FF166534",
  vermelhoFundo: "FFFEE2E2",
  vermelhoTexto: "FF991B1B",
  amareloFundo: "FFFEF3C7",
  amareloTexto: "FF92400E",
  azulFundo: "FFDBEAFE",
  azulTexto: "FF1E40AF",
  cinzaFundo: "FFE2E8F0",
  cinzaTexto: "FF475569",
} as const;

const ROTULOS_SOCIO = {
  id: "ID",
  nome: "Nome",
  telefone: "Telefone",
  obs: "Observações",
  dataNascimento: "Data de nascimento",
  vinculo: "Vínculo",
  clienteId: "Cliente ID",
} as const;

const FORMATADOR_DATA_HORA_SAO_PAULO = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function neutralizarFormula(value: ExportValue): ExportValue {
  if (typeof value === "string" && /^[ \t\r\n]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function textoResumo(value: ExportValue): string {
  if (value === null || value === "") return "Não informado";
  if (value instanceof Date) return formatarDataResumo(value);
  if (typeof value === "boolean") return value ? "SIM" : "NÃO";
  return String(value);
}

interface ComponentesData {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
  milissegundo: number;
}

function criarDataUtcValida(ano: number, mes: number, dia: number, hora = 0, minuto = 0, segundo = 0, milissegundo = 0): Date | null {
  const data = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo, milissegundo));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia || data.getUTCHours() !== hora || data.getUTCMinutes() !== minuto || data.getUTCSeconds() !== segundo || data.getUTCMilliseconds() !== milissegundo) return null;
  return data;
}

function componentesEmSaoPaulo(data: Date): ComponentesData | null {
  if (Number.isNaN(data.getTime())) return null;
  const partes = FORMATADOR_DATA_HORA_SAO_PAULO.formatToParts(data);
  const obter = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find((parte) => parte.type === tipo)?.value);
  const componentes = { ano: obter("year"), mes: obter("month"), dia: obter("day"), hora: obter("hour"), minuto: obter("minute"), segundo: obter("second"), milissegundo: data.getUTCMilliseconds() };
  return Object.values(componentes).every(Number.isFinite) ? componentes : null;
}

function dataExcelSaoPaulo(data: Date): Date | null {
  const c = componentesEmSaoPaulo(data);
  return c ? criarDataUtcValida(c.ano, c.mes, c.dia, c.hora, c.minuto, c.segundo, c.milissegundo) : null;
}

function interpretarDataEstrita(value: string): { data: Date; temFuso: boolean } | null {
  const brasileiro = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (brasileiro) {
    const data = criarDataUtcValida(Number(brasileiro[3]), Number(brasileiro[2]), Number(brasileiro[1]), Number(brasileiro[4] ?? 0), Number(brasileiro[5] ?? 0), Number(brasileiro[6] ?? 0));
    return data ? { data, temFuso: false } : null;
  }
  const dataIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dataIso) {
    const data = criarDataUtcValida(Number(dataIso[1]), Number(dataIso[2]), Number(dataIso[3]));
    return data ? { data, temFuso: false } : null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(Z|[+\-]\d{2}:\d{2})?$/.exec(value);
  if (!iso) return null;
  const componentesValidos = criarDataUtcValida(Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4]), Number(iso[5]), Number(iso[6] ?? 0), Number(iso[7] ?? 0));
  if (!componentesValidos) return null;
  const fuso = iso[8];
  if (!fuso) return { data: componentesValidos, temFuso: false };
  if (fuso !== "Z") {
    const [horaFuso, minutoFuso] = fuso.slice(1).split(":").map(Number);
    if (horaFuso > 23 || minutoFuso > 59) return null;
  }
  const instante = new Date(value);
  return Number.isNaN(instante.getTime()) ? null : { data: instante, temFuso: true };
}

function converterDataApenas(value: ExportValue): ExportValue {
  if (value === null || value === "") return value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return String(value);
    return criarDataUtcValida(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()) ?? String(value);
  }
  if (typeof value !== "string") return value;
  const texto = value.trim();
  const interpretada = interpretarDataEstrita(texto);
  if (!interpretada) return value;
  const brasileiro = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
  if (brasileiro) {
    return criarDataUtcValida(Number(brasileiro[3]), Number(brasileiro[2]), Number(brasileiro[1])) ?? value;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  return iso ? criarDataUtcValida(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? value : value;
}

function converterDataHora(value: ExportValue): ExportValue {
  if (value === null || value === "") return value;
  if (value instanceof Date) return dataExcelSaoPaulo(value) ?? String(value);
  if (typeof value !== "string") return value;
  const interpretada = interpretarDataEstrita(value.trim());
  if (!interpretada) return value;
  return interpretada.temFuso ? dataExcelSaoPaulo(interpretada.data) ?? value : interpretada.data;
}

function formatarDataResumo(value: ExportValue): string {
  if (value === null || value === "") return "Não informado";
  const data = converterDataApenas(value);
  if (!(data instanceof Date)) return String(data);
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

function resumirSocios(socios: Array<Record<keyof typeof ROTULOS_SOCIO, ExportValue>>): string {
  if (socios.length === 0) return "Nenhum sócio cadastrado";

  return socios
    .map((socio, index) => {
      const campos = Object.entries(ROTULOS_SOCIO).map(([campo, rotulo]) => {
        const valor = socio[campo as keyof typeof ROTULOS_SOCIO];
        const texto = campo === "dataNascimento" ? formatarDataResumo(valor) : textoResumo(valor);
        return `${rotulo}: ${texto}`;
      });
      return [`Sócio ${index + 1}`, ...campos].join("\n");
    })
    .join("\n\n");
}

function preencherCelula(cell: ExcelJS.Cell, corFundo: string, corTexto: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: corFundo } };
  cell.font = { ...cell.font, bold: true, color: { argb: corTexto } };
}

function estilizarStatus(cell: ExcelJS.Cell) {
  const status = String(cell.value ?? "").trim().toLocaleLowerCase("pt-BR");

  if (status === "deferido") {
    preencherCelula(cell, CORES.verdeFundo, CORES.verdeTexto);
  } else if (status.startsWith("cancelado")) {
    preencherCelula(cell, CORES.vermelhoFundo, CORES.vermelhoTexto);
  } else if (status === "stand by") {
    preencherCelula(cell, CORES.amareloFundo, CORES.amareloTexto);
  } else if (status === "em andamento") {
    preencherCelula(cell, CORES.azulFundo, CORES.azulTexto);
  } else if (status === "arquivado") {
    preencherCelula(cell, CORES.cinzaFundo, CORES.cinzaTexto);
  }
}

function estilizarFeedbackGoogle(cell: ExcelJS.Cell) {
  if (cell.value === "SIM") {
    preencherCelula(cell, CORES.verdeFundo, CORES.verdeTexto);
  } else if (cell.value === "NÃO") {
    preencherCelula(cell, CORES.vermelhoFundo, CORES.vermelhoTexto);
  }
}

function larguraColuna(header: string, rows: ExportRow[]): number {
  const nome = header.toLocaleLowerCase("pt-BR");
  let maiorConteudo = header.length;
  for (const row of rows) {
    const value = row[header];
    const comprimento = value instanceof Date
      ? 19
      : String(value ?? "")
          .split(/\r?\n/)
          .reduce((maior, linha) => Math.max(maior, linha.length), 0);
    maiorConteudo = Math.max(maiorConteudo, comprimento);
  }

  let minimo = 12;
  let maximo = 32;
  if (nome === "id" || nome.endsWith("id") || nome.includes("quantidade")) {
    minimo = 10;
    maximo = 16;
  } else if (nome.includes("data") || nome.endsWith("at")) {
    minimo = 18;
    maximo = 22;
  } else if (nome.includes("cnpj") || nome.includes("telefone")) {
    minimo = 18;
    maximo = 22;
  } else if (
    nome.includes("resumo") ||
    nome.includes("observ") ||
    nome.includes("descricao") ||
    nome.includes("embasamento") ||
    nome.includes("dados") ||
    nome.includes("url")
  ) {
    minimo = 24;
    maximo = nome.includes("resumo") ? 60 : 45;
  } else if (
    nome.includes("razaosocial") ||
    nome.includes("nomefantasia") ||
    nome.includes("servico") ||
    nome.includes("email")
  ) {
    minimo = 20;
    maximo = 40;
  }

  return Math.min(Math.max(maiorConteudo + 2, minimo), maximo);
}

function adicionarAba(workbook: ExcelJS.Workbook, sheet: ExportSheet) {
  const worksheet = workbook.addWorksheet(sheet.name);
  worksheet.columns = sheet.headers.map((header) => ({
    header,
    key: header,
    width: larguraColuna(header, sheet.rows),
  }));
  worksheet.properties.defaultRowHeight = 21;
  worksheet.properties.tabColor = { argb: CORES.cabecalho };

  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: CORES.cabecalhoTexto }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORES.cabecalho } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: CORES.cabecalho } },
      left: { style: "thin", color: { argb: CORES.borda } },
      bottom: { style: "thin", color: { argb: CORES.cabecalho } },
      right: { style: "thin", color: { argb: CORES.borda } },
    };
  });
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: "A1", to: `${worksheet.getColumn(sheet.headers.length).letter}1` };

  for (const row of sheet.rows) {
    const safeRow = Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const tipoData = sheet.dateColumns?.[key];
        const valorFormatado = tipoData === "date-only"
          ? converterDataApenas(value)
          : tipoData === "date-time"
            ? converterDataHora(value)
            : value;
        return [key, neutralizarFormula(valorFormatado)];
      }),
    );
    const excelRow = worksheet.addRow(safeRow);
    const maiorQuantidadeLinhas = Object.values(safeRow).reduce<number>((maior, value) => {
      if (typeof value !== "string") return maior;
      return Math.max(maior, value.split(/\r?\n/).length);
    }, 1);
    excelRow.height = Math.min(Math.max(21, maiorQuantidadeLinhas * 15), 409);
    excelRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { color: { argb: CORES.texto }, size: 10 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "hair", color: { argb: CORES.borda } },
        left: { style: "hair", color: { argb: CORES.borda } },
        bottom: { style: "hair", color: { argb: CORES.borda } },
        right: { style: "hair", color: { argb: CORES.borda } },
      };
      if (excelRow.number % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORES.zebra } };
      }
      const columnIndex = typeof cell.col === "number" ? cell.col : Number(cell.col);
      const header = sheet.headers[columnIndex - 1];
      const tipoData = sheet.dateColumns?.[header];
      if (cell.value instanceof Date && tipoData === "date-only") {
        cell.numFmt = "dd/mm/yyyy";
      } else if (cell.value instanceof Date && tipoData === "date-time") {
        cell.numFmt = "dd/mm/yyyy hh:mm";
      } else if (typeof cell.value === "string") {
        cell.numFmt = "@";
      }
    });

    if (sheet.name === "Empresas") {
      estilizarStatus(excelRow.getCell("status"));
      estilizarFeedbackGoogle(excelRow.getCell("feedbackGoogle"));
    }
  }
}

export async function gerarExportacaoCompletaCsNps(): Promise<{ buffer: Buffer; totalClientes: number } | null> {
  const clientes = await db.clientes.findMany({
    select: clienteSelect,
    orderBy: { id: "asc" },
  });

  if (clientes.length === 0) return null;

  const sheets: ExportSheet[] = [
    {
      name: "Empresas",
      headers: ["id", "status", "cnpj", "razaoSocial", "nomeFantasia", "dataConstituicao", "uf", "municipio", "regimeTributario", "servicos", "analistaResponsavel", "dataContratacao", "dataExito", "formaPagamento", "valorContrato", "closerNome", "ultimoCs", "nps", "feedbackGoogle", "quantidadeSocios", "sociosResumo", "createdAt", "updatedAt", "nomeGoogle", "embasamento", "origemLead", "canalAquisicao", "canalOutro"],
      rows: clientes.map((cliente) => ({
        id: cliente.id,
        status: cliente.status,
        cnpj: cliente.cnpj,
        razaoSocial: cliente.razaoSocial,
        nomeFantasia: cliente.nomeFantasia,
        dataConstituicao: cliente.dataConstituicao,
        uf: cliente.uf,
        municipio: cliente.municipio,
        regimeTributario: cliente.regimeTributario,
        servicos: cliente.servicos,
        analistaResponsavel: cliente.analistaResponsavel,
        dataContratacao: cliente.dataContratacao,
        dataExito: cliente.dataExito,
        formaPagamento: cliente.formaPagamento,
        valorContrato: cliente.valorContrato,
        closerNome: cliente.closerNome,
        ultimoCs: cliente.ultimoCs,
        nps: cliente.nps,
        feedbackGoogle: cliente.feedbackGoogle ? "SIM" : "NÃO",
        quantidadeSocios: cliente.socios.length,
        sociosResumo: resumirSocios(cliente.socios),
        createdAt: cliente.createdAt,
        updatedAt: cliente.updatedAt,
        nomeGoogle: cliente.nomeGoogle,
        embasamento: cliente.embasamento,
        origemLead: cliente.origemLead,
        canalAquisicao: cliente.canalAquisicao,
        canalOutro: cliente.canalOutro,
      })),
      dateColumns: {
        dataConstituicao: "date-only",
        dataContratacao: "date-only",
        dataExito: "date-only",
        createdAt: "date-time",
        updatedAt: "date-time",
      },
    },
    {
      name: "Socios",
      headers: [
        ...Object.keys(clienteSelect.socios.select),
        "clienteRazaoSocial",
        "clienteCnpj",
        "clienteServico",
      ],
      rows: clientes.flatMap((cliente) =>
        cliente.socios.map((socio) => ({
          ...socio,
          clienteRazaoSocial: cliente.razaoSocial,
          clienteCnpj: cliente.cnpj,
          clienteServico: cliente.servicos,
        })),
      ),
      dateColumns: { dataNascimento: "date-only" },
    },
    { name: "CS", headers: Object.keys(clienteSelect.log_cs.select), rows: clientes.flatMap((cliente) => cliente.log_cs), dateColumns: { dataRegistro: "date-time" } },
    { name: "Feedbacks", headers: Object.keys(clienteSelect.logFeedback.select), rows: clientes.flatMap((cliente) => cliente.logFeedback), dateColumns: { dataRegistro: "date-time" } },
    { name: "Log Alteracoes", headers: Object.keys(clienteSelect.logAlteracao.select), rows: clientes.flatMap((cliente) => cliente.logAlteracao), dateColumns: { dataAlteracao: "date-time" } },
    { name: "Historico Cliente", headers: Object.keys(clienteSelect.historicoAlteracoes.select), rows: clientes.flatMap((cliente) => cliente.historicoAlteracoes), dateColumns: { criadoEm: "date-time" } },
    { name: "Indicacoes", headers: Object.keys(clienteSelect.indicacao.select), rows: clientes.flatMap((cliente) => cliente.indicacao ? [cliente.indicacao] : []), dateColumns: { dataIndicacao: "date-time", comprovanteEnviadoEm: "date-time", createdAt: "date-time" } },
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Painel Alpha";
  workbook.created = new Date();
  workbook.modified = new Date();
  for (const sheet of sheets) adicionarAba(workbook, sheet);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(arrayBuffer), totalClientes: clientes.length };
}
