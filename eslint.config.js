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
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/components/ui/dropdown-select.tsx'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'JSXOpeningElement[name.name="select"]',
          message:
            'Use DropdownSelect from @/components/ui/dropdown-select instead of raw <select>.',
        },
      ],
    },
  },
  {
    files: ['src/screens/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name="select"]',
          message:
            'Use DropdownSelect from @/components/ui/dropdown-select instead of raw <select>.',
        },
      ],
    },
  },
  // Semantica showcase subtree (W0–W6) MUST stay a read-only data path.
  // Direct or transitive imports of the live graph client, governed
  // projection stores/selectors, runtime graph hooks, or proxy clients
  // are forbidden by ESLint in addition to the runtime Vitest guard.
  {
    files: [
      'src/screens/knowledge-base/graph/showcase/**/*.ts',
      'src/screens/knowledge-base/graph/showcase/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../graph-api-client',
              message:
                'Showcase subtree must not import the live graph-api-client. Use showcase adapters/fixtures only.',
            },
            {
              name: '../graph-types',
              message:
                'Showcase subtree must not import the live GovernedGraphProjection types. Use showcase/semantica-showcase-types.',
            },
            {
              name: '../../graph-api-client',
              message:
                'Showcase subtree must not import the live graph-api-client.',
            },
          ],
          patterns: [
            {
              group: ['@/routes/api/*', '@/api/*'],
              message:
                'Showcase subtree must not import live API clients. Stay offline.',
            },
          ],
        },
      ],
    },
  },
  ...hermesConfig,
]
