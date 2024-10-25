// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactCompiler from 'eslint-plugin-react-compiler';

export default tseslint.config(
    {
        ignores: [
            'eslint.config.mjs',
            'tailwind.config.js',
            'postcss.config.cjs',
            'vite.config.ts',
            'dist/**'
        ]
    },
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        }
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    // These @ts-ignores should go away when https://github.com/jsx-eslint/eslint-plugin-react/issues/3838 is solved
    // @ts-ignore
    {
        // @ts-ignore
        ...react.configs.flat.recommended,
        plugins: {
            // @ts-ignore
            react,
            // React compiler brings rules for react that are going to be solved when the compiler is launched, but is the React recommended way of good practices.
            // See: https://react.dev/learn/react-compiler
            'react-compiler': reactCompiler
        },
        settings: {
            react: {
                version: 'detect'
            }
        },
        // @ts-ignore - React ESLint seems to have issues with typescript-eslint
        rules: {
            ...react.configs.flat.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            // @ts-ignore
            'react/jsx-filename-extension': [1, { extensions: ['.tsx'] }],
            'react-compiler/react-compiler': 'warn'
        }
    }
);
