import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // File tracing pulls e2e and deploy material into .next/standalone that
  // the running server never touches. Same reasoning as madori's
  // next.config.ts: these are cwd-relative noise, not imports.
  outputFileTracingExcludes: {
    "*": ["e2e/**", "deploy/**"],
  },
};

export default nextConfig;
