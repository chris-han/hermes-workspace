//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

const inertRule = {
  meta: {
    type: 'problem',
    schema: [],
  },
  create: () => ({}),
}

const baselineRuleOverrides = {
  '@typescript-eslint/array-type': 'warn',
  '@typescript-eslint/consistent-type-imports': 'warn',
  '@typescript-eslint/method-signature-style': 'warn',
  '@typescript-eslint/no-unnecessary-condition': 'warn',
  '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
  'import/consistent-type-specifier-style': 'warn',
  'import/first': 'warn',
  'import/no-duplicates': 'warn',
  'import/order': 'warn',
  'no-constant-condition': 'warn',
  'no-control-regex': 'warn',
  'no-extra-boolean-cast': 'warn',
  'no-useless-escape': 'warn',
  'sort-imports': 'warn',
}

const hermesConfig = tanstackConfig.map((config) => {
  if (!config.plugins) {
    return config
  }

  return {
    ...config,
    plugins: {
      ...config.plugins,
      'react-hooks': {
        rules: {
          'exhaustive-deps': inertRule,
        },
      },
      react: {
        rules: {
          'no-danger': inertRule,
        },
      },
    },
    rules: {
      ...config.rules,
      ...baselineRuleOverrides,
    },
  }
})

export default [
  {
    ignores: [
      '.eslintignore',
      'build_check.txt',
      'build_out.txt',
      'build_output.txt',
      'dist/**',
      'eslint.config.js',
      'node_modules/**',
      'prettier.config.js',
      'public/**',
      'scripts/**/*.js',
      'server-entry.js',
      'test_out.txt',
      'test_output.txt',
      'tsc_output_hermes.txt',
      'vite.config.ts',
    ],
  },
  ...hermesConfig,
]
