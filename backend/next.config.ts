import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), ".."),
};

export default nextConfig;
