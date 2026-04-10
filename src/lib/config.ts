/**
 * App Configuration - Ortam Duyarlı Yapılandırma
 * "Senior" Checklist: Environment Isolation.
 * Dev/Prod ayrımına göre farklı davranışlar sergiler.
 */
export const config = {
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  
  api: {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    timeout: 10000,
  },
  
  iyzico: {
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    uri: process.env.IYZICO_URI || 'https://sandbox-api.iyzipay.com',
  },
  
  auth: {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  },
  
  database: {
    url: process.env.DATABASE_URL,
  }
};

export default config;
