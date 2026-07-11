import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated to a custom path (src/generated/prisma).
  // Next.js's serverless output tracing doesn't automatically include the
  // native query-engine binary from there, so on Vercel the function 500s at
  // runtime ("query engine not found"). Pin the tracing root to the project
  // dir (so the include globs resolve correctly on Vercel) and force the
  // engine into every route's serverless bundle.
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/**/*": [
      "./src/generated/prisma/**/*",
      "./src/generated/prisma/*.node",
    ],
  },
};

export default nextConfig;
