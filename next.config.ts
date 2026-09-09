const nextConfig = {
  // Dev e builds de stage/produção podem coexistir 24/7 sem escrever no
  // mesmo diretório. O serviço dev define NEXT_DIST_DIR=.next-alpha-dev.
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  allowedDevOrigins: ["dev-painel.alpha-comex.com", "192.168.35.149"],
  // Garante a substituição estática no bundle do cliente também no
  // Turbopack/Next 16. O cliente ainda possui fallback seguro se faltar env.
  env: {
    NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
    NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  },
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
      // Logos de bancos no catálogo do módulo de Extratos (src/components/Extratos/lib/bancos-catalogo.ts)
      { protocol: "https", hostname: "assets.hgbrasil.com" },
      { protocol: "https", hostname: "encrypted-tbn0.gstatic.com" },
      { protocol: "https", hostname: "media.licdn.com" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "play-lh.googleusercontent.com" },
      { protocol: "https", hostname: "s3.amazonaws.com" },
      { protocol: "https", hostname: "*.fna.fbcdn.net" },
      { protocol: "https", hostname: "www.bancopan.com.br" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
    ],
  },


};

export default nextConfig;
