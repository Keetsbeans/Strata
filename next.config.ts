import type { NextConfig } from "next";

// Strata is a fully client-side app: it is exported as static files, so it can be
// hosted on GitHub Pages. All data goes straight from the browser to Supabase,
// protected by row level security (see supabase/schema.sql).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
