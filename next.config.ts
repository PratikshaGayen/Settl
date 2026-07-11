import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated to a custom path (src/generated/prisma).
  // Next.js's serverless output tracing doesn't automatically include the
  // native query-engine binary from there, so on Vercel the function 500s at
  // runtime ("query engine not found"). Force it into every route's bundle.
  outputFileTracingIncludes: {
    "/**/*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
