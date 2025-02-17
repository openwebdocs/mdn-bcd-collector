import path from "node:path";
import { fileURLToPath } from "node:url";
import globals from "globals";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  ...compat.extends("eslint:recommended", "plugin:jsdoc/recommended"),
  {
    languageOptions: {
      ecmaVersion: 3,
      sourceType: "script",
      globals: {
        ...globals.browser,
        JSON: "readonly",
        Promise: "readonly"
      }
    },

    rules: {
      "comma-dangle": ["error", "never"],
      curly: ["error", "all"],
      "guard-for-in": "off",
      indent: "off",
      "max-len": "off",
      "no-invalid-this": "off",

      "no-unused-vars": [
        "error",
        {
          caughtErrors: "none"
        }
      ],

      "no-var": "off",
      "prefer-arrow/prefer-arrow-functions": "off",
      quotes: "off",
      "require-jsdoc": "off",
      "space-before-function-paren": "off",
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
            MethodDefinition: true
          }
        }
      ],

      "jsdoc/require-param-type": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-type": "off",
      "jsdoc/no-undefined-types": "error",
      "jsdoc/require-yields": "error"
    }
  },
  {
    files: ["**/unittest/**.js"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.mocha
      }
    }
  },
  {
    files: ["**/eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    }
  },
  {
    files: [
      "**/resources/custom-tests/api/AudioWorkletNode/WhiteNoiseProcessor.js"
    ],
    languageOptions: {
      ecmaVersion: 6
    }
  }
];
