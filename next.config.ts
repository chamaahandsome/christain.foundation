import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // YouTube thumbnails for the embedded library
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Public channel identity is /@handle (folder names can't start
        // with @ — that's the parallel-routes convention).
        { source: "/@:handle", destination: "/channel/:handle" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
