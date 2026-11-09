import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  URL: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  Buffer: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      'public/mockServiceWorker.js',
      'dist/**',
      '.angular/**',
      '.agents/**',
      '.claude/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'drills/**',
      'tokens/tokens.ts',
      'node_modules/**',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.strict,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: ['element', 'attribute'], prefix: ['app', 'ui'], style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/no-negated-async': 'error',
      // <button ui-icon-button label="..."> gets its text from the label input.
      '@angular-eslint/template/elements-content': ['error', { allowList: ['label'] }],
    },
  },
  {
    files: ['**/*.spec.ts/*.html'],
    rules: { '@angular-eslint/template/elements-content': 'off' },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    files: ['scripts/**/*.{mjs,js}', 'cli/**/*.{mjs,js}', '*.mjs'],
    languageOptions: { globals: nodeGlobals, ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      'no-console': 'off',
      'no-undef': 'error',
      'no-unused-vars': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
);
