import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@rhl/shared"],
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
