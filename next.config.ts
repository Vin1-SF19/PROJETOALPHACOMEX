const nextConfig = {
  transpilePackages: ["pusher-js"],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
    ],
  },


};

export default nextConfig;
