import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  serverExternalPackages: [ 
    "nodejs-polars",
    "@google-cloud/bigquery",
    "@google-cloud/secret-manager",
  ],
};

export default nextConfig;
