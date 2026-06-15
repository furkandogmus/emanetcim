import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import withPWA from "@ducanh2912/next-pwa";

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
      "script-src 'self' 'unsafe-inline' https://plausible.io https://static.cloudflareinsights.com https://client.crisp.chat",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://client.crisp.chat",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://client.crisp.chat",
      "connect-src 'self' https: wss:",
      // MapLibre GL blob: üzerinden web worker üretir; yoksa /search haritası CSP'ye takılır.
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /\/_next\/static\/(?:chunks|css|media)\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 64, maxAgeSeconds: 86400 * 30 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "next-other-static",
        expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /\/icons\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "app-icons",
        expiration: { maxEntries: 16, maxAgeSeconds: 86400 * 60 },
      },
    },
    {
      urlPattern: /\/api\/mobile\/.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "mobile-api",
        expiration: { maxEntries: 64, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /\/api\/.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /(?:\.(?:html?|json))$|^\/(?:(?:tr|en)\/)?(?:search|bookings|shop\/)/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "others",
        expiration: { maxEntries: 32, maxAgeSeconds: 3600 },
      },
    },
  ],
})({
  output: "standalone",
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  serverExternalPackages: ["@prisma/client", "pg"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
});

export default withNextIntl(nextConfig);
