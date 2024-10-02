import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import { dts } from "rollup-plugin-dts"
import { babel } from "@rollup/plugin-babel"
import commonjs from "@rollup/plugin-commonjs"
import json from "@rollup/plugin-json"
import inject from "@rollup/plugin-inject"

const config = [
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.esm.js",
        format: "es",
      },
    ],
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
        outputToFilesystem: true,
      }),
      nodeResolve({
        browser: true,
        preferBuiltins: true,
      }),
      commonjs(),
      babel({
        presets: ["@babel/preset-react"],
        plugins: ["@babel/plugin-transform-react-jsx"],
        babelHelpers: "bundled",
      }),
      json(),
      inject({
        this: "window",
      }),
    ],
    external: ["react", "react-dom", "react/jsx-runtime"],
  },
  {
    input: "src/index.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
  },
]

export default config
