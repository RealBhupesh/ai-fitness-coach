import nextVitals from 'eslint-config-next/core-web-vitals'
 
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'reports/**',
      'backups/**',
      'datasets/**',
      'public/mediapipe/wasm/**',
      'public/mediapipe/pose-worker.js',
    ],
  },
  ...nextVitals,
  {
    // TypeScript and the production build validate dependency exports.
    settings: { 'import/ignore': ['node_modules'] },
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/no-absolute-path': 'error',
      'import/no-dynamic-require': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': ['error', { ignoreExternal: true }],
      'import/no-useless-path-segments': 'error',
    },
  },
]
 
export default eslintConfig
