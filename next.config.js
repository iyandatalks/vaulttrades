/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/analyze", destination: "/api/analyze-v3" },
      { source: "/api/analyze-v2", destination: "/api/analyze-v3" },
    ];
  },
};

module.exports = nextConfig;
