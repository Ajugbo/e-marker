const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../.."),
    outputFileTracingIncludes: {
      "/*": ["../../packages/database/node_modules/.prisma/client/**/*"],
    },
    serverComponentsExternalPackages: [
      "@exam-marker/database",
      "@prisma/client",
      ".prisma/client",
    ],
  },
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals.push(({ request }, callback) => {
        if (
          request === "@exam-marker/database" ||
          request?.startsWith("@exam-marker/database/") ||
          request === "@prisma/client" ||
          request?.startsWith("@prisma/client/") ||
          request === ".prisma/client" ||
          request?.startsWith(".prisma/client/")
        ) {
          callback(null, `commonjs ${request}`);
          return;
        }
        callback();
      });
    }
    return config;
  },
};

module.exports = nextConfig;