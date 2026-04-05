import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';


const withNextIntl = createNextIntlPlugin();


const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    // Nginx / ngrok gibi ters vekil arkasında: Next.js istek URL'ini Host header'ından üretir.
    // false iken bind adresi (0.0.0.0:3000) kullanılır → Auth.js callbackUrl bozulur.
    trustHostHeader: true,
  },
  // Prisma 7 ve Next.js 16 (Turbopack) uyumluluğu için gereklidir.
  serverExternalPackages: ["@prisma/client", "pg", "iyzipay", "@netgsm/sms"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig as NextConfig);

