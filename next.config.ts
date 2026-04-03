import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';


const withNextIntl = createNextIntlPlugin();


const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  // Prisma 7 ve Next.js 16 (Turbopack) uyumluluğu için gereklidir.
  serverExternalPackages: ['@prisma/client', 'pg', 'iyzipay'],
};

export default withNextIntl(nextConfig);

