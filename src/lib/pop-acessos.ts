// Constantes compartilhadas entre a Server Action (src/actions/PopAcessos.ts) e
// o client (ModalGerenciamentoAcessos.tsx). Não pode viver no arquivo "use server"
// porque módulos com essa diretiva só podem exportar async functions.

// Chave reservada de PopAcesso.setor — guarda podeUpload/podeGerenciar GERAIS do
// usuário (acesso aos botões "Upload" e "Gerenciar" do header), independente de
// setor de conteúdo. Nunca aparece nas listas de setores visíveis na UI.
export const SETOR_GERAL = "_ACESSO_GERAL_";
