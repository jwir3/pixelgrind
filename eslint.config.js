import stylistic from '@stylistic/eslint-plugin';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  {
    plugins: {
      '@stylistic': stylistic,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // --- Existing Stylistic Rules ---
      '@stylistic/indent': ['error', 2],
      '@stylistic/no-tabs': 'off',

      // --- New Import Sorting Rules ---
      // Sorts imports
      'simple-import-sort/imports': 'error',
      // Sorts exports
      'simple-import-sort/exports': 'error',

      // Enforce a line length of 120 characters
      "max-len": ["error", {
        "code": 120,
        "ignoreComments": true,
        "ignoreUrls": true,
        "ignoreStrings": true,
        "ignoreTemplateLiterals": true,
        "ignoreRegExpLiterals": true
      }],

      "operator-linebreak": ["error", "before"]
    },
  }
];
