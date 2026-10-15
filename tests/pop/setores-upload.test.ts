import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  usuario: vi.fn(),
  acessos: vi.fn(),
  setores: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: mocks.usuario },
  popAcesso: { findMany: mocks.acessos },
  setor: { findMany: mocks.setores },
} }));

import { getAcessosDoUsuario, getSetoresParaUploadPop } from "@/actions/PopAcessos";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "1", role: "Admin" } });
  mocks.usuario.mockResolvedValue({ role: "Admin", permissoes: "" });
  mocks.acessos.mockResolvedValue([]);
  mocks.setores.mockResolvedValue([{ nome: "TI" }, { nome: "Sucesso do Cliente" }]);
});

describe("catálogo de destinos do Upload POP", () => {
  it("consulta somente setores ativos e inclui nomes novos e Diretrizes", async () => {
    expect(await getSetoresParaUploadPop()).toEqual({
      success: true, setores: ["Diretrizes", "TI", "Sucesso do Cliente"],
    });
    expect(mocks.setores).toHaveBeenCalledWith({
      where: { ativo: true },
      orderBy: [{ protegido: "desc" }, { nome: "asc" }],
      select: { nome: true },
    });
  });

  it("atualiza destinos após alteração do cadastro e não duplica Diretrizes", async () => {
    await getSetoresParaUploadPop();
    mocks.setores.mockResolvedValue([{ nome: "DIRETRIZES" }, { nome: "Marketing" }]);
    expect((await getSetoresParaUploadPop()).setores).toEqual(["Diretrizes", "Marketing"]);
  });

  it("mantém destinos globais para quem tem upload sem ampliar a leitura", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "2", role: "COMERCIAL" } });
    mocks.usuario.mockResolvedValue({ role: "COMERCIAL", permissoes: "UpDocumentos" });
    expect((await getSetoresParaUploadPop()).setores).toContain("Sucesso do Cliente");
    const acessos = await getAcessosDoUsuario();
    expect(acessos.setoresAcessiveis).toEqual(["Diretrizes", "COMERCIAL"]);
    expect(acessos.setoresDisponiveis).not.toContain("Sucesso do Cliente");
  });

  it("nega catálogo de upload sem sessão", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await getSetoresParaUploadPop()).toMatchObject({ success: false, setores: [] });
    expect(mocks.setores).not.toHaveBeenCalled();
  });

  it("nega catálogo de upload sem permissão de envio", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "2", role: "COMERCIAL" } });
    mocks.usuario.mockResolvedValue({ role: "COMERCIAL", permissoes: "" });
    expect(await getSetoresParaUploadPop()).toMatchObject({ success: false, setores: [] });
  });
});
