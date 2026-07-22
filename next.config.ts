import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // content/*.md is read with fs at request time (legal pages) — make sure the
  // files are traced into the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/terms": ["./content/**/*"],
    "/privacy": ["./content/**/*"],
  },
  turbopack: {
    // path.resolve(__dirname) is required because this project lives in an iCloud
    // Drive directory whose synthetic path confuses Turbopack's lockfile-based root
    // detection. Remove only if the project is moved out of iCloud Drive.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
