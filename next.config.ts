import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@browserbasehq/stagehand", "playwright-core"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
