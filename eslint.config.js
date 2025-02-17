import typescriptEslint from "@typescript-eslint/eslint-plugin";
import preferArrow from "eslint-plugin-prefer-arrow";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import {fileURLToPath} from "node:url";
import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "**/coverage/",
      "**/generated/",
      "**/browser-compat-data/",
      "**/es-scraper/",
      "**/static/",
    ],
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/strict",
    "plugin:@typescript-eslint/stylistic",
    "plugin:jsdoc/recommended-typescript",
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "prefer-arrow": preferArrow,
      // jsdoc,
      unicorn,
    },

    languageOptions: {
      globals: {
        ...globals.mocha,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },

    rules: {
      curly: ["error", "all"],
      "max-len": "off",
      indent: "off",
      "jsdoc/check-param-names": "error",
      "jsdoc/require-description": "warn",

      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            ClassExpression: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true,
          },
        },
      ],

      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-type": "off",
      "jsdoc/no-undefined-types": "error",
      "jsdoc/require-yields": "error",
      "no-else-return": "error",
      "no-unused-vars": "off",
      "prefer-arrow/prefer-arrow-functions": "error",
      quotes: "off",
      "quote-props": ["error", "as-needed"],
      "require-jsdoc": "off",
      "space-before-function-paren": "off",
      "unicorn/prefer-node-protocol": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          caughtErrors: "none",
        },
      ],

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
];
