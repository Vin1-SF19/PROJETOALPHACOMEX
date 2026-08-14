import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

const seletor = ler("src/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard.tsx");
const modal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");
const board = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");

describe("CRM - pessoas vinculadas ao card na interface", () => {
  it("oferece seleção múltipla no cabeçalho usando os usuários elegíveis", () => {
    expect(seletor).toContain('import {\n  AtualizarMembrosCardBpm,\n  ListarUsuariosVinculaveisCardBpm,\n} from "@/actions/bpm/Membros"');
    expect(seletor).toContain("ListarUsuariosVinculaveisCardBpm({ cardId })");
    expect(seletor).toContain("AtualizarMembrosCardBpm({ cardId, userIds })");
    expect(seletor).toContain('role="listbox" aria-multiselectable="true"');
    expect(seletor).toContain("Buscar pessoa...");
  });

  it("mantém o responsável vinculado e não habilita sua remoção no seletor", () => {
    expect(seletor).toContain('membroAtual?.role === "RESPONSAVEL"');
    expect(seletor).toContain("disabled={responsavel || salvandoId !== null}");
    expect(seletor).toContain("Responsável do card");
  });

  it("exibe fotos com fallback de iniciais e informa os nomes para tecnologia assistiva", () => {
    expect(seletor).toContain("AvatarImage");
    expect(seletor).toContain("Foto de ${membro.usuario.nome}");
    expect(seletor).toContain("iniciais(membro.usuario.nome)");
    expect(seletor).toContain("Pessoas vinculadas: ${nomes}");
  });

  it("monta o seletor no cabeçalho do card aberto com edição condicionada à permissão", () => {
    expect(modal).toContain('import { SeletorMembrosCard } from "./SeletorMembrosCard"');
    expect(modal).toContain("const podeGerenciarMembros = isAdminRole(currentUserRole)");
    expect(modal).toContain("<SeletorMembrosCard");
    expect(modal).toContain("podeGerenciar={podeGerenciarMembros}");
    expect(modal).toContain("onAtualizado={() => { void recarregar(); onAtualizado(); }}");
  });

  it("permite que participante vinculado trabalhe no card, mantendo a gestão de membros restrita", () => {
    expect(modal).toContain("const podeTrabalharNoCard = isAdminRole(currentUserRole) || Boolean(meuVinculo)");
    expect(modal).toContain("const podeMoverEtapa = podeTrabalharNoCard");
    expect(modal).toContain("const podeEditar = podeTrabalharNoCard");
    expect(modal).toContain("const podeTrabalharTarefas = podeTrabalharNoCard");
    expect(modal).toContain("podeTrabalharTarefas={podeTrabalharTarefas}");
    expect(modal).toContain("meuVinculo?.role === \"RESPONSAVEL\"");
    expect(modal).toContain("meuVinculo?.role === \"ADMINISTRADOR\"");
  });

  it("mostra o grupo compacto de avatares no card fechado sem interromper o realtime do board", () => {
    expect(board).toContain('import { GrupoAvataresMembrosCard, type MembroCard } from "../../CardModal/SeletorMembrosCard"');
    expect(board).toContain("membros: MembroCard[]");
    expect(board).toContain("const membrosVisiveis = card.membros.length > 0");
    expect(board).toContain("<GrupoAvataresMembrosCard");
    expect(board).toContain("BPM_PIPELINE_EVENT");
    expect(board).not.toContain('aria-label={`Responsável: ${card.responsavel.nome}`}');
  });
});
