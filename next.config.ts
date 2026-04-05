import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: repoRoot,
  },
  allowedDevOrigins: ['192.168.56.1', 'localhost', '127.0.0.1', '0.0.0.0'],
};

export default nextConfig;
