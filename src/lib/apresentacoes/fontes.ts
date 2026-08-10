export interface FonteAlphaMotion {
  nome: string;
  categoria: "Sans serif" | "Serif" | "Display" | "Monoespaçada";
}

/** Catálogo carregado por arquivos WOFF2 locais no editor e embutido no player exportado. */
export const FONTES_ALPHA_MOTION: FonteAlphaMotion[] = [
  { nome: "Inter", categoria: "Sans serif" },
  { nome: "DM Sans", categoria: "Sans serif" },
  { nome: "Montserrat", categoria: "Sans serif" },
  { nome: "Poppins", categoria: "Sans serif" },
  { nome: "Roboto", categoria: "Sans serif" },
  { nome: "Open Sans", categoria: "Sans serif" },
  { nome: "Lato", categoria: "Sans serif" },
  { nome: "Nunito", categoria: "Sans serif" },
  { nome: "Raleway", categoria: "Sans serif" },
  { nome: "Source Sans 3", categoria: "Sans serif" },
  { nome: "Merriweather", categoria: "Serif" },
  { nome: "Playfair Display", categoria: "Serif" },
  { nome: "Bebas Neue", categoria: "Display" },
  { nome: "Oswald", categoria: "Display" },
  { nome: "Roboto Mono", categoria: "Monoespaçada" },
];
