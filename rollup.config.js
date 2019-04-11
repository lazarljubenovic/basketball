import typescript from 'rollup-plugin-typescript2'
import copy from 'rollup-plugin-copy'
import node from 'rollup-plugin-node-resolve'
import {terser} from 'rollup-plugin-terser'

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
  },
  plugins: [
    copy({
      targets: [
        'src/index.html',
      ],
      outputFolder: 'dist',
    }),
    node(),
    typescript({
      typescript: require('typescript'),
      objectHashIgnoreUnknownHack: true,
    }),
    terser({
      output: {
        ecma: 8,
      },
      compress: {},
      mangle: {
        module: true,
        toplevel: true,
        properties: true,
      },
      module: true,
      toplevel: true,
    }),
  ]
}
