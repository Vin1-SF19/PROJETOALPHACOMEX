import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");
const workspace = ler("src/components/bpm/conhecimento/ConhecimentoWorkspace.tsx");
const editor = ler("src/components/bpm/conhecimento/ScriptEtapaEditor.tsx");
const primitives = ler("src/components/Notas/NoteEditor/NoteEditorPrimitives.tsx");
const noteEditor = ler("src/components/Notas/NoteEditor/NoteEditor.tsx");
const registrar = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx");
const pagina = ler("src/app/PainelAlpha/AlphaCRM/admin/conhecimento/page.tsx");

describe("Base de Conhecimento como gerenciador de scripts", () => {
  it("oferece somente pipeline, etapa e o editor do script", () => {
    expect(workspace).toContain("Gerenciador de scripts");
    expect(workspace).toContain('aria-label="Pipeline"');
    expect(workspace).toContain('aria-label="Etapa"');
    expect(workspace).toContain("<ScriptEtapaEditor");
    expect(workspace).not.toContain("URL (https://...)");
    expect(workspace).not.toContain("Adicionar novo link");
  });

  it("carrega somente etapas ativas com o script existente", () => {
    expect(pagina).toContain("etapas: {");
    expect(pagina).toContain("where: { ativo: true }");
    expect(pagina).toContain("script: true");
  });

  it("reutiliza as mesmas primitivas e extensões do editor Note", () => {
    expect(noteEditor).toContain("criarExtensoesEditorNote(");
    expect(noteEditor).toContain("<NoteEditorToolbar");
    expect(noteEditor).toContain("<NoteEditorContent");
    expect(editor).toContain("criarExtensoesEditorNote(");
    expect(editor).toContain("<NoteEditorToolbar");
    expect(editor).toContain("<NoteEditorContent");
    expect(primitives).toContain('import "./note-editor.css"');
  });

  it("salva automaticamente e bloqueia troca durante alterações pendentes", () => {
    expect(editor).toContain("AUTOSAVE_DEBOUNCE_MS");
    expect(editor).toContain("SalvarScriptEtapaBpm");
    expect(workspace).toContain("disabled={selecaoBloqueada}");
  });

  it("renderiza a aba Scripts somente para leitura e mantém o estado vazio", () => {
    expect(registrar).toContain("> Scripts");
    expect(registrar).toContain("<ConteudoScriptEtapa");
    expect(registrar).toContain("Nenhum script configurado para esta etapa ainda.");
  });
});
