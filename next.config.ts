import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from "@sentry/nextjs";

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
    value: "camera=(self), microphone=(), geolocation=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // NOTE: Next.js runtime injects inline bootstrap scripts/styles.
      // Keep unsafe-inline in production until nonce/hash CSP is implemented app-wide.
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://plausible.io https://static.cloudflareinsights.com https://client.crisp.chat",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://client.crisp.chat",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://client.crisp.chat",
      "connect-src 'self' https: wss: https://o4511211308122112.ingest.de.sentry.io",
      // MapLibre GL blob: üzerinden web worker üretir; yoksa /search haritası CSP'ye takılır.
      "worker-src 'self' blob:",
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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
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

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG || "bagajpark",
  project: process.env.SENTRY_PROJECT || "bagajpark-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});

