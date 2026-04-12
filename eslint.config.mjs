import eslintConfig from '@skellla/lint-config/eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import { parser as tsParser } from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/logs/',
      '**/coverage/',
      '**/node_modules/',
      '**/.vscode/',
      '**/*.xxx.*',
      '**/dist/',
      '**/build/',
      '**/.svelte-kit/',
      'src/lib/paraglide/**/*',
      'examples/**/*',
      'vite.config.ts',
    ],
  },
  ...eslintConfig,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsParser,
        project: 'tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    rules: {
      'import-x/no-unresolved': [
        'error',
        { ignore: ['^\\$app/', '^\\$env/', '^\\$lib/', '^\\$service-worker'] },
      ],
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  ...svelte.configs['flat/prettier'],
];
