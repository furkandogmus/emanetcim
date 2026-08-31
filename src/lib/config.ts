import { getSiteBaseUrl } from '@/lib/site-base-url';

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
    // Tek kaynak: `getSiteBaseUrl` -- burasi `NEXT_PUBLIC_APP_URL`i yok
    // sayiyordu, yani yalnizca o tanimliyken `localhost`a dusuyordu.
    baseUrl: getSiteBaseUrl(),
    timeout: 10000,
  },
  
  auth: {
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  },
  
  database: {
    url: process.env.DATABASE_URL,
  },
  
  contact: {
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "+90-542-241-55-97",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "destek@bagajpark.com",
    whatsapp: "https://wa.me/905422415597",
  },

  branding: {
    name: "BagajPark",
    alternateNames: ["Emanetçi", "emanetcim"],
    logo: "/icons/icon-512x512.png",
  }
};

export default config;
