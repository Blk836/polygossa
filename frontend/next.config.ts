import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app's display name (lib/brand.ts), shared with the backend's BRAND_NAME; inlined at build time.
  env: { BRAND_NAME: process.env.BRAND_NAME ?? "" },
  // YouTube video thumbnails on library cards.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }],
  },
};

export default nextConfig;
