import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import copy from 'rollup-plugin-copy'

const plugins = [
  resolve({ browser: true }),
  commonjs(),
  typescript({ tsconfig: './tsconfig.json' })
]

export default [
  {
    input: 'src/background/background.ts',
    output: {
      file: 'dist/background.js',
      format: 'esm'
    },
    plugins: [
      ...plugins,
      copy({
        targets: [
          { src: 'src/popup/popup.html', dest: 'dist' },
          { src: 'manifest.json', dest: 'dist' },
          { src: 'icons', dest: 'dist' }
        ],
        hook: 'buildStart'
      })
    ]
  },
  {
    input: 'src/injected/injected.ts',
    output: {
      file: 'dist/injected.js',
      format: 'iife'
    },
    plugins
  },
  {
    input: 'src/content/content.ts',
    output: {
      file: 'dist/content.js',
      format: 'iife'
    },
    plugins
  },
  {
    input: 'src/popup/popup.ts',
    output: {
      file: 'dist/popup.js',
      format: 'iife'
    },
    plugins
  }
]