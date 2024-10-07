import json from "@rollup/plugin-json"
import typescript from "@rollup/plugin-typescript"
import { dts } from "rollup-plugin-dts"
import postcss from "rollup-plugin-postcss"

import packageJson from "./package.json" assert { type: "json" }

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
      json(),
      postcss({
        extensions: [".css"],
      }),
    ],
    external: [
      ...Object.keys(packageJson.dependencies),
      // Subfolders are not excluded by default
      "zustand/vanilla",
      "react/jsx-runtime", // Implicitly required by React JSX transform
    ],
  },
  {
    input: "src/index.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
  },
]

export default config
