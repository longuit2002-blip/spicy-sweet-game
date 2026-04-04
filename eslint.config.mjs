import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const NODE_TS_FILES = ["apps/api/src/**/*.ts", "packages/**/*.ts"];
const WEB_FILES = ["apps/web/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}"];

function prefixWebFiles(patterns) {
  return patterns.map((pattern) => `apps/web/${pattern}`);
}

function scopeWebConfigs(configs) {
  return configs.map((config) => ({
    ...config,
    files: config.files ? prefixWebFiles(config.files) : WEB_FILES,
  }));
}

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
      "apps/web/next-env.d.ts",
      "apps/web/postcss.config.mjs",
      "apps/web/.next/types/**/*.ts",
      "apps/web/.next/dev/types/**/*.ts",
    ],
  },
  {
    ...js.configs.recommended,
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: NODE_TS_FILES,
    languageOptions: {
      ...config.languageOptions,
      globals: {
        ...globals.node,
        ...config.languageOptions?.globals,
      },
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  })),
  {
    files: WEB_FILES,
    settings: {
      next: {
        rootDir: [".", "apps/web/"],
      },
    },
  },
  ...scopeWebConfigs(nextTypescript),
  ...scopeWebConfigs(nextCoreWebVitals),
  {
    files: WEB_FILES,
    settings: {
      react: {
        // eslint-plugin-react 7.37.x + ESLint 10: `version: "detect"` calls removed RuleContext APIs.
        // Pin to apps/web `react` — override `eslint-config-next` default once upstream supports ESLint 10.
        version: "19.2.0",
      },
    },
  },
  {
    files: WEB_FILES,
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
