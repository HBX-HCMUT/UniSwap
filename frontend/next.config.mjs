const origin = process.env.API_ORIGIN || "http://127.0.0.1:3001";
export default {
  devIndicators: false,
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: origin + "/api/v1/:path*" },
    ];
  },
};
