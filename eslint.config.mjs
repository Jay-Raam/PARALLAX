import tseslint from "typescript-eslint";
import { globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/out/**",
    "**/coverage/**",
    "**/graphql/generated.ts",
    "**/next-env.d.ts",
    "**/playwright-report/**",
    "**/test-results/**",
  ]),
  ...tseslint.configs.recommended,
  // eslint-config-next is eslintrc-style; FlatCompat converts it for the flat config.
  // Scope it to the web app so API/package code isn't linted with Next rules.
  ...compat.extends("next/core-web-vitals").map((cfg) => ({
    ...cfg,
    files: ["apps/web/**/*.{ts,tsx}"],
  })),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
    },
  },
);
