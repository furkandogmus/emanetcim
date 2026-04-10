import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolConfig } from "pg";

/**
 * Prisma 7 + pg Pool. Üretimde PG_POOL_MAX, DATABASE_SSL vb. ile ayarlayın.
 */
function buildPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const max = Math.min(
    100,
    Math.max(2, Number(process.env.PG_POOL_MAX) || 10),
  );
  const idleTimeoutMillis = Number(process.env.PG_POOL_IDLE_MS) || 30_000;
  const connectionTimeoutMillis =
    Number(process.env.PG_POOL_CONNECT_TIMEOUT_MS) || 10_000;

  const useSsl =
    process.env.DATABASE_SSL === "true" ||
    process.env.DATABASE_SSL === "require";

  const ssl: PoolConfig["ssl"] = useSsl
    ? {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
      }
    : undefined;

  return {
    connectionString,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ssl,
  };
}

const prismaClientSingleton = () => {
  const pool = new Pool(buildPoolConfig());
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
