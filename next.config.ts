const nextConfig = {
  transpilePackages: ["pusher-js"],
  serverExternalPackages: ["@react-pdf/renderer", "pdf-parse"],
  // pdf-parse carrega o worker do pdfjs-dist (embutido, node_modules aninhado)
  // via import() dinâmico com caminho variável — o file tracing do Next.js não
  // segue esse caminho sozinho e deixa pdf.worker.mjs de fora do bundle da
  // Vercel, causando "Cannot find module .../pdf.worker.mjs" em runtime.
  // Força a inclusão explícita em todas as rotas server-side.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    ],
  },
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
