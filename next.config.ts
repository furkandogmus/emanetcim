import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';


const withNextIntl = createNextIntlPlugin();


const hstsHeader =
  process.env.ENABLE_HSTS_HEADERS === "true"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : [];

const securityHeaders = [
  ...hstsHeader,
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
      // NOTE: Next.js runtime injects inline bootstrap scripts/styles.
      // Keep unsafe-inline in production until nonce/hash CSP is implemented app-wide.
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://plausible.io",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https: wss:",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
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

export default withNextIntl(nextConfig);

