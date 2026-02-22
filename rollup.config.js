import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import copy from 'rollup-plugin-copy'

export default [
	{
		input: 'src/background/background.ts',
		output: {
			file: 'dist/background.js',
			format: 'esm'
		},
		plugins: [
			resolve({ browser: true }),
			commonjs(),
			typescript({ tsconfig: './tsconfig.json' })
		]
	},
	{
		input: 'src/content/content.ts',
		output: {
			file: 'dist/content.js',
			format: 'iife'
		},
		plugins: [
			resolve({ browser: true }),
			commonjs(),
			typescript({ tsconfig: './tsconfig.json' })
		]
	},
	{
		input: 'src/popup/popup.ts',
		output: {
			file: 'dist/popup.js',
			format: 'iife'
		},
		plugins: [
			resolve({ browser: true }),
			commonjs(),
			typescript({ tsconfig: './tsconfig.json' }),
			copy({
				targets: [
					{ src: 'src/popup/popup.html', dest: 'dist' },
					{ src: 'manifest.json', dest: 'dist' },
					{ src: 'icons', dest: 'dist' }
				]
			})
		]
	}
]
