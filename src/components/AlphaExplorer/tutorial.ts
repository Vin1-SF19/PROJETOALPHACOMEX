import type { ConfigTutorialModulo } from "@/lib/guias/tutorial-modulo";

export const ALPHA_EXPLORER_TUTORIAL: ConfigTutorialModulo = {
  modulo: "alpha-explorer",
  versao: 1,
  titulo: "Como usar o Explorador de Arquivos",
  passos: [
    { id: "navigation", seletor: '[data-guia-explorer="navigation"]', titulo: "Navegue com segurança", descricao: "Use as pastas e o breadcrumb. Diretórios sem permissão não aparecem." },
    { id: "folder", seletor: '[data-guia-explorer="folder"]', titulo: "Crie pastas", descricao: "Nova pasta cria uma organização lógica no escopo autorizado." },
    { id: "upload", seletor: '[data-guia-explorer="upload"]', titulo: "Envie até 2 GiB", descricao: "O arquivo segue diretamente ao NAS em partes, com progresso real. Você pode cancelar e reiniciar." },
    { id: "search", seletor: '[data-guia-explorer="search"]', titulo: "Pesquise e ordene", descricao: "A busca fica limitada à pasta e às permissões atuais." },
    { id: "files", seletor: '[data-guia-explorer="files"]', titulo: "Opere seus arquivos", descricao: "Baixe, renomeie, mova ou envie à lixeira pelo menu de cada item." },
    { id: "trash", seletor: '[data-guia-explorer="trash"]', titulo: "Lixeira reversível", descricao: "Excluir não apaga o objeto fisicamente. Itens podem ser restaurados quando não houver conflito." },
    { id: "provider", seletor: '[data-guia-explorer="provider"]', titulo: "NAS e fallback", descricao: "O NAS é primário. Se estiver indisponível antes do início, um administrador pode habilitar reinício controlado no Blob; isso não é backup." },
    { id: "permissions", seletor: '[data-guia-explorer="permissions"]', titulo: "Permissões", descricao: "Administradores definem acessos; cada operação é revalidada no servidor." },
  ],
};
