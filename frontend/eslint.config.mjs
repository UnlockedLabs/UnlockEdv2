// @ts-check
import { readdirSync } from 'node:fs';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// EN-201: one folder per frontend feature, each isolated from the others.
// Shared code belongs in components/ or lib/, not in another feature's folder.
// Read from the filesystem so adding a feature folder doesn't also require
// remembering to list it here.
const FEATURES = readdirSync(new URL('./src/features', import.meta.url), {
    withFileTypes: true
})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

export default tseslint.config(
    {
        ignores: [
            'eslint.config.mjs',
            'vite.config.ts',
            'postcss.config.cjs',
            'tailwind.config.cjs',
            'dist/**',
            'public/**'
        ]
    },
    {
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        }
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true }
            ],
            'no-console': 'error'
        }
    },
    {
        files: ['src/components/ui/**/*.{ts,tsx}'],
        rules: {
            'react-refresh/only-export-components': 'off'
        }
    },
    ...FEATURES.map((feature) => ({
        files: [`src/features/${feature}/**/*.{ts,tsx}`],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: FEATURES.filter((other) => other !== feature).map(
                        (other) => ({
                            // Matches both the @/ alias and any relative escape
                            // (../, ../../features/, etc.) into another feature,
                            // so leaving the alias path doesn't bypass the rule.
                            regex: `^(@/features/|(\\.\\./)+(features/)?)${other}(/|$)`,
                            message:
                                'Features may not import from other features directly. Share code through components/ or lib/ instead.'
                        })
                    )
                }
            ]
        }
    }))
);
