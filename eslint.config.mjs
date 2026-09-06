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
  {
    // The mirror image of the rule above, and the one that guards a secret:
    // src/server holds SESSION_SECRET, APP_PASSWORD_HASH and ESV_API_KEY,
    // and everything under src/client and src/components is compiled into
    // the browser bundle. Nothing crosses that line today; this is what
    // keeps it that way. Route handlers under src/app/api are server code
    // and are deliberately not covered.
    files: ["src/client/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/server/*", "@/server/*"], message: "Browser code never imports src/server: the secrets live there." },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
