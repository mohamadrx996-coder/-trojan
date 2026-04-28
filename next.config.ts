import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Netlify handles the build - no standalone output needed */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
