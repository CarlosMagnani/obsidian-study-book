import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.ts'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/consistent-type-imports': 'error',
		},
	},
	{
		files: ['src/**/*.ts'],
		plugins: { obsidianmd },
		rules: {
			...obsidianmd.configs.recommended.rules,
		},
	},
	{
		ignores: ['main.js', 'node_modules/**', 'site/**'],
	},
);
