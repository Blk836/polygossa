import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: { BRAND_NAME: process.env.BRAND_NAME ?? "" },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }],
  },
};

export default nextConfig;
