// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDIr: import.meta.dirname,
      },
    },
  },
  {
    ignores: ['eslint.config.mjs', 'tailwind.config.js', 'postcss.config.cjs', 'vite.config.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
);
