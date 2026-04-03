import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Prisma 7 Modern Driver Adapter Singleton
 * Next.js ve Prisma 7 (Rust-free) mimarisi için optimize edilmiştir.
 * Sürücü adaptörü kullanımı sayesinde Edge/Serverless uyumluluğu ve 
 * performans artışı sağlanır.
 */

const connectionString = process.env.DATABASE_URL;

const prismaClientSingleton = () => {
  // 1. PostgreSQL Pool oluştur (Native PG sürücüsü)
  const pool = new Pool({ connectionString });
  
  // 2. Prisma Driver Adapter'ı başlat
  const adapter = new PrismaPg(pool);
  
  // 3. Prisma Client'ı adaptör ile başlat
  return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
