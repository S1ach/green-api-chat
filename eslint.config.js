import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/** Слои Feature-Sliced Design сверху вниз: импортировать можно только нижележащие. */
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
/** Слои, поделённые на слайсы; у каждого слайса есть публичный API — index.ts. */
const SLICED_LAYERS = ['pages', 'widgets', 'features', 'entities'];

/** Правила границ FSD для файлов одного слоя. Внутри слайса импорты относительные. */
function layerBoundaries(layer) {
  const upperLayers = LAYERS.slice(0, LAYERS.indexOf(layer));
  const patterns = [
    {
      regex: `^@/(${SLICED_LAYERS.join('|')})/[^/]+/(?!@x/).+`,
      message: 'Импортируйте слайс через его публичный API (index.ts).',
    },
  ];
  if (upperLayers.length > 0) {
    patterns.push({
      regex: `^@/(${upperLayers.join('|')})(/|$)`,
      message: `Слой ${layer} не может импортировать вышележащие слои.`,
    });
  }
  if (layer === 'entities') {
    patterns.push({
      regex: '^@/entities/[^/]+$',
      message:
        'Сущности связываются только через явный кросс-импорт: @/entities/<slice>/@x/<consumer>.',
    });
  } else if (SLICED_LAYERS.includes(layer)) {
    patterns.push({
      regex: `^@/${layer}(/|$)`,
      message: `Слайсы слоя ${layer} не импортируют друг друга.`,
    });
  }

  return {
    files: [`src/${layer}/**/*.{ts,tsx}`],
    // Тестам нужен настоящий store приложения и тестовые утилиты.
    ignores: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns }] },
  };
}

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Пропсы описаны типами TypeScript.
      'react/prop-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  ...LAYERS.map(layerBoundaries),
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
