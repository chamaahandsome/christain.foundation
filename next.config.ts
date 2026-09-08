import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Two dev servers on this repo (the developer's and the assistant's)
  // corrupt each other when they share .next. Setting NEXT_DIST_DIR lets a
  // second server build into its own directory; the default is unchanged.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
        // with @ — that's the parallel-routes convention). Tabs are real
        // sub-routes: /@handle/videos, /@handle/books, later /shop etc.
        { source: "/@:handle", destination: "/channel/:handle" },
        // Catch-all so deeper pages resolve too — /@handle/book/:serviceId.
        { source: "/@:handle/:path*", destination: "/channel/:handle/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
