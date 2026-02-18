import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname
});
const eslintConfig = [
  ...compat.config({
    extends: [
      'next/core-web-vitals',
      'next/typescript',
      'plugin:@typescript-eslint/recommended',
      'plugin:react/jsx-runtime',
      'prettier'
    ],
    plugins: ['unused-imports', 'eslint-plugin-import-helpers'],
    ignorePatterns: ['.spec.*', '.storybook', 'build', 'node_modules'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': ['error'],
      '@typescript-eslint/camelcase': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/indent': ['off', 2],
      '@typescript-eslint/no-unused-expressions': 'error',
      'consistent-return': 'off',
      'no-confusing-arrow': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-expressions': 'off',
      'no-new': 'off',
      'new-cap': 'off',
      'max-len': ['warn', { code: 100 }],
      'max-params': 'off',
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'react/no-danger': 'off',
      'react/jsx-first-prop-new-line': [1, 'multiline'],
      'react/jsx-max-props-per-line': [1, { maximum: 1, when: 'multiline' }],
      'react/jsx-filename-extension': [1, { extensions: ['.ts', '.tsx', '.js', '.jsx'] }],
      'object-curly-spacing': ['warn', 'always', { objectsInObjects: true }],
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 2,
      'import-helpers/order-imports': [
        'warn',
        {
          groups: [
            '/^react/',
            'module',
            '/^core/',
            '/^store/',
            '/^utils/',
            '/^configs/',
            '/^@lanxess/ui/',
            '/^@lanxess/modules/',
            '/^@lanxess/core/',
            '/^@lanxess/shared/',
            '/^assets/',
            ['parent', 'sibling', 'index'],
            '/^.*styles$/'
          ],
          alphabetize: { order: 'asc', ignoreCase: true }
        }
      ],
      'import/no-anonymous-default-export': [
        'error',
        {
          allowArray: false,
          allowArrowFunction: false,
          allowAnonymousClass: false,
          allowAnonymousFunction: false,
          allowCallExpression: true, // The true value here is for backward compatibility
          allowNew: false,
          allowLiteral: false,
          allowObject: true
        }
      ],
      'jsx-a11y/aria-role': [2, { ignoreNonDOM: true }]
    },
    overrides: [
      {
        files: [
          './src/packages/ui/assets/icons/*.tsx',
          './src/packages/ui/assets/illustrations/*.tsx',
          './src/packages/ui/components/*/*/stories.tsx',
          './src/packages/ui/components/*/*/index.spec.tsx'
        ],
        rules: { 'max-len': ['off'] }
      },
      {
        files: ['**/*.tsx', '**/*.ts'],
        rules: { 'react-hooks/exhaustive-deps': 'off' }
      }
    ],
    settings: {
      react: {
        version: 'detect'
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx']
      },
      'import/resolver': {
        typescript: {}
      }
    }
  })
];
export default eslintConfig;
