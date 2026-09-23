import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // O framework e os scripts Node do projeto usam CommonJS por contrato.
    files: ["**/*.cjs", ".aiox-core/**/*.js", "bibblesquad/install.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Source templates contain literal {{placeholders}} and are not valid JS/TS
    // until rendered by the AIOX generators.
    ".aiox-core/development/templates/squad/tool-template.js",
    ".aiox-core/product/templates/component-react-tmpl.tsx",
    ".aiox-core/product/templates/token-exports-tailwind-tmpl.js",
  ]),
]);

export default eslintConfig;
