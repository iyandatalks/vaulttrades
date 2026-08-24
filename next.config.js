/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/analyze", destination: "/api/analyze-live" },
      { source: "/api/analyze-v2", destination: "/api/analyze-live" },
    ];
  },
};

module.exports = nextConfig;
