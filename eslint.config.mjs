import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "react/*", "react-dom/*", "next", "next/*"], message: "src/core is pure TS: no React, no Next." },
            { group: ["node:*", "fs", "fs/*", "path", "os", "child_process", "http", "https", "crypto", "util", "url", "stream", "stream/*", "events", "buffer", "process"], message: "src/core does no IO." },
            { group: ["**/server/*", "**/client/*", "**/components/*", "**/app/*", "@/server/*", "@/client/*", "@/components/*", "@/app/*"], message: "src/core does not import outward." },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
