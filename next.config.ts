import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + raw file assets, so it must be required, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  images: {
    // Admin-uploaded shop photos live on Vercel Blob; nothing else is allowed.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
