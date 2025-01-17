import path from "node:path"
import alias from "@rollup/plugin-alias"
import json from "@rollup/plugin-json"
import typescript from "@rollup/plugin-typescript"
import autoprefixer from "autoprefixer"
import atImport from "postcss-import"
import { dts } from "rollup-plugin-dts"
import postcss from "rollup-plugin-postcss"
import tailwindcss from "tailwindcss"
import packageJson from "./package.json" assert { type: "json" }
import radixSelectPackageJson from "./src/lib/@radix-ui/react-select/package.json" assert {
  type: "json",
}

const config = [
  {
    input: ["src/index.ts", "src/logger.ts"],
    output: [
      {
        dir: "dist",
        format: "es",
        sourcemap: true,
        entryFileNames: "[name].esm.js",
      },
    ],
    plugins: [
      alias({
        entries: [
          {
            find: "@radix-ui/react-select",
            replacement: path.resolve(
              import.meta.dirname,
              "src/lib/@radix-ui/react-select"
            ),
          },
        ],
      }),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
        outputToFilesystem: true,
      }),
      json(),
      postcss({
        extensions: [".css"],
        inject: false,
        extract: false,
        modules: false,
        minimize: false,
        plugins: [atImport, tailwindcss, autoprefixer],
      }),
    ],
    external: [
      ...Object.keys(packageJson.dependencies).filter(
        // "@radix-ui/react-select" is monkey-patched, so we need to include it in the bundle
        (pkg) => pkg !== "@radix-ui/react-select"
      ),
      ...Object.keys(radixSelectPackageJson.dependencies),

      // Subfolders are not excluded by default
      "zustand/vanilla",
      "react/jsx-runtime", // Implicitly required by React JSX transform
      "@noble/curves/secp256k1",
    ],
  },
  {
    input: "src/index.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
  },
  {
    input: "src/logger.ts",
    output: [{ file: "dist/logger.d.ts", format: "es" }],
    plugins: [dts()],
  },
]

export default config
