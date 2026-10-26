import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userCount: vi.fn(), auth: vi.fn(), permissions: vi.fn(), user: vi.fn(), taskCreate: vi.fn(), taskFind: vi.fn(), taskUpdate: vi.fn(), taskDelete: vi.fn(), raw: vi.fn(), query: vi.fn(),
  reservationFind: vi.fn(), reservationCreate: vi.fn(), reservationUpdate: vi.fn(), reservationDelete: vi.fn(), direction: vi.fn(),
  itemUpdate: vi.fn(), operationalFind: vi.fn(), operationalUpdate: vi.fn(), transaction: vi.fn(),
  clientFind: vi.fn(), clientUpdate: vi.fn(), history: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/permissions/effective", () => ({ readEffectiveModulePermissions: m.permissions }));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: m.user, count: m.userCount }, tarefa: { create: m.taskCreate, findUnique: m.taskFind, updateMany: m.taskUpdate, deleteMany: m.taskDelete },
  $executeRaw: m.raw, $queryRaw: m.query, $transaction: m.transaction,
  reservas: { findFirst: m.reservationFind, create: m.reservationCreate, updateMany: m.reservationUpdate, deleteMany: m.reservationDelete },
  diretrizSala: { upsert: m.direction }, itemChecklist: { update: m.itemUpdate }, operacionalClientes: { findUnique: m.operationalFind, update: m.operationalUpdate },
  cliente: { findUnique: m.clientFind, update: m.clientUpdate }, historicoAlteracaoCliente: { createMany: m.history },
} }));
import db from "@/lib/prisma";
import { AlternarStatusTarefa, BuscarTarefasPorUsuario, CriarTarefa, DeletarTarefa, EditarTarefa } from "@/actions/Tarefas";
import { agendarSala, cancelarReserva, editarReserva, liberarSala, SalvarDiretrizSala } from "@/actions/Reservas";
import { salvarAlteracoesCliente } from "@/actions/Clientes";

const task = { texto: "Tarefa de teste", userId: 2, fixa: false, diaSemana: null, prioridade: "baixa" };
const booking = { sala: "Sala de testes", data: "2026-11-02", inicio: "10:00", fim: "11:00", tipo: "Reunião", paoDeQueijo: false, motivo: "Teste" };
beforeEach(() => {
  vi.resetAllMocks();
  m.userCount.mockResolvedValue(1);
  m.auth.mockResolvedValue({ user: { id: "1" } });
  m.user.mockImplementation(async ({ where, select }) => select.status && !select.nome ? { status: "ATIVO" } : { id: where.id ?? 1, nome: "Pessoa", role: "User", email: "pessoa@example.test", status: "ATIVO" });
  m.permissions.mockResolvedValue(["gerenciamentoTarefas", "Reservas", "tarefasComercial"]);
  m.transaction.mockImplementation(async (callback) => callback(db));
  m.raw.mockResolvedValue(1);m.taskCreate.mockResolvedValue({ id: "task-1" });m.taskFind.mockResolvedValue({userId:2});m.taskUpdate.mockResolvedValue({count:1});m.taskDelete.mockResolvedValue({count:1});
  m.reservationFind.mockResolvedValue(null);m.reservationCreate.mockResolvedValue({id:1});m.reservationUpdate.mockResolvedValue({count:1});m.reservationDelete.mockResolvedValue({count:1});
  m.itemUpdate.mockImplementation(async ({data}) => ({ id:"item",status:data.status??"PENDENTE",observacao:data.observacao??"Observação anterior",descricao:"Documento",checklist:{tipo:"RECEITA_BRUTA_DAS",empresaId:"op",itens:[{status:"OK",obrigatorio:true}],empresa:{clienteOperacional:null}} }));
  m.operationalFind.mockResolvedValue({tipo:"RECEITA_BRUTA_DAS"});m.operationalUpdate.mockResolvedValue({});
});

describe("autorização e resultado de tarefas",()=>{
  it("nega criação sem sessão antes de gravar",async()=>{
    m.auth.mockResolvedValue(null);expect((await CriarTarefa(task)).success).toBe(false);expect(m.taskCreate).not.toHaveBeenCalled();
  });
  it("não usa userId enviado como autorização",async()=>{
    m.permissions.mockResolvedValue(["tarefasComercial"]);expect((await CriarTarefa(task)).success).toBe(false);expect(m.taskCreate).not.toHaveBeenCalled();
  });
  it("nega usuário desativado ainda com sessão",async()=>{
    m.user.mockResolvedValue({id:1,nome:"Pessoa",role:"Admin",status:"INATIVO"});expect((await CriarTarefa(task)).success).toBe(false);expect(m.taskCreate).not.toHaveBeenCalled();
  });
  it("confirma apenas criação real e comunica falha no alerta separadamente",async()=>{
    m.raw.mockRejectedValue(new Error("coluna alerta ausente"));
    expect(await CriarTarefa({...task,alerta:"1H_ANTES"})).toMatchObject({success:true,id:"task-1",warning:expect.any(String)});
    m.taskCreate.mockRejectedValueOnce(Object.assign(new Error("Inconsistent column data"),{code:"P2023"}));
    expect((await CriarTarefa(task)).success).toBe(false);
  });
  it("edição preserva opcionais omitidos",async()=>{
    expect((await EditarTarefa("task-1",{texto:"Mudança",fixa:false,prioridade:"baixa"})).success).toBe(true);
    const data=m.taskUpdate.mock.calls[0][0].data;expect(data.dataInicio).toBeUndefined();expect(data.intervaloDias).toBeUndefined();expect(data).not.toHaveProperty("diaSemana");
  });
  it("zero linhas não confirma conclusão/edição/exclusão",async()=>{
    m.taskUpdate.mockResolvedValue({count:0});m.taskDelete.mockResolvedValue({count:0});
    expect((await AlternarStatusTarefa("task-1",true)).success).toBe(false);
    expect((await EditarTarefa("task-1",{texto:"Mudança",fixa:false,prioridade:"baixa"})).success).toBe(false);
    expect((await DeletarTarefa("task-1")).success).toBe(false);
  });
  it("consulta usa parâmetro para usuário e recusa identificador inválido",async()=>{
    m.query.mockResolvedValue([]);await BuscarTarefasPorUsuario("2","Admin");expect(m.query.mock.calls[0][1]).toBe(2);
    m.query.mockClear();await BuscarTarefasPorUsuario("2 OR 1=1","Admin");expect(m.query).not.toHaveBeenCalled();
  });
  it("papel da sessão não concede acesso de gestor",async()=>{
    m.auth.mockResolvedValue({user:{id:"1",role:"Admin"}});m.permissions.mockResolvedValue([]);
    expect((await CriarTarefa(task)).success).toBe(false);expect(m.taskCreate).not.toHaveBeenCalled();
  });
});

describe("reservas",()=>{
  it.each(["10:00","09:00"])("recusa fim %s sem escrita",async fim=>{
    expect((await agendarSala({...booking,fim})).success).toBe(false);expect(m.reservationCreate).not.toHaveBeenCalled();
  });
  it("inserção condicional sem linha afetada retorna conflito",async()=>{
    m.raw.mockResolvedValue(0);expect((await agendarSala(booking)).success).toBe(false);expect(m.reservationCreate).not.toHaveBeenCalled();
  });
  it("refaz consulta após snapshot SQLite ocupado",async()=>{
    m.raw.mockRejectedValueOnce(new Error("SQLITE_BUSY: snapshot")).mockResolvedValue(0);
    expect((await agendarSala(booking)).success).toBe(false);expect(m.raw).toHaveBeenCalledTimes(2);expect(m.reservationCreate).not.toHaveBeenCalled();
  });
  it.each([()=>editarReserva(1,booking),()=>liberarSala(1),()=>cancelarReserva(1),()=>SalvarDiretrizSala("Sala","Texto")])("nega escrita com sessão ausente",async action=>{
    m.auth.mockResolvedValue(null);expect((await action()).success).toBe(false);expect(m.reservationUpdate).not.toHaveBeenCalled();expect(m.reservationDelete).not.toHaveBeenCalled();expect(m.direction).not.toHaveBeenCalled();
  });
  it.each([0, 2])("nega mutações de não administrador com %s contas identificadas pelo nome", async count => {
    m.userCount.mockResolvedValue(count);
    for (const action of [() => editarReserva(1, booking), () => liberarSala(1), () => cancelarReserva(1)]) {
      expect(await action()).toMatchObject({ success: false, error: expect.stringContaining("administrador") });
    }
    expect(m.raw).not.toHaveBeenCalled();
    expect(m.reservationUpdate).not.toHaveBeenCalled();
    expect(m.reservationDelete).not.toHaveBeenCalled();
    expect(m.userCount).toHaveBeenCalledWith({ where: { nome: "Pessoa" } });
  });
  it("administrador pode resolver autoria ambígua e criação não consulta autoria antiga", async () => {
    m.userCount.mockResolvedValue(2);
    expect((await agendarSala(booking)).success).toBe(true);
    expect(m.userCount).not.toHaveBeenCalled();
    m.user.mockResolvedValue({ id: 1, nome: "Pessoa", role: "Admin", status: "ATIVO" });
    expect((await editarReserva(1, booking)).success).toBe(true);
    expect((await liberarSala(1)).success).toBe(true);
    expect((await cancelarReserva(1)).success).toBe(true);
    expect(m.userCount).not.toHaveBeenCalled();
  });
  it("repete no servidor a restrição de autor já aplicada na UI",async()=>{
    expect((await editarReserva(1,booking)).success).toBe(true);
    expect(m.raw.mock.calls[0]).toContain("Pessoa");
    m.raw.mockResolvedValue(0);expect((await editarReserva(2,booking)).success).toBe(false);
  });
});

it("cadastro e histórico usam o mesmo cliente transacional",async()=>{
  m.clientFind.mockResolvedValue({id:1,razaoSocial:"Antes"});m.clientUpdate.mockResolvedValue({id:1});m.history.mockRejectedValue(new Error("Histórico indisponível"));
  expect((await salvarAlteracoesCliente(1,{razaoSocial:"Depois",nomeFantasia:null,dataConstituicao:null,regimeTributario:null,uf:null,municipio:null})).success).toBe(false);
  expect(m.transaction).toHaveBeenCalledOnce();expect(m.clientUpdate).toHaveBeenCalledOnce();expect(m.history).toHaveBeenCalledOnce();
});
