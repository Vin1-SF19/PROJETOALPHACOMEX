/**
 * Ponto de entrada único do sistema Alpha Motion. Importar deste arquivo (em vez de
 * `./registry` diretamente) garante que o catálogo completo (Fase 02, `./catalogo.ts`) já
 * populou o registry antes de qualquer `obterAnimacao`/`listarAnimacoes` ser chamado —
 * evita bugs de "animação não encontrada" por falta de importar o catálogo em algum ponto.
 */
import "./catalogo";

export * from "./tipos";
export * from "./motor";
export * from "./registry";
export * from "./migracao";
export * from "./resolver";
export * from "./curvas";
export * from "./variantsNovoModelo";
export * from "./gatilhos";
export * from "./stagger";
export * from "./presets-stagger";
