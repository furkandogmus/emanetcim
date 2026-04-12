import { Prisma } from "@prisma/client";

type AdapterCause = { originalCode?: string };

function adapterFkFromMeta(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as {
    driverAdapterError?: { cause?: AdapterCause };
  };
  return m.driverAdapterError?.cause?.originalCode === "23503";
}

/**
 * Prisma 7 + pg driver adapter: silme/güncelleme FK ihlali bazen `P2003` değil,
 * `DriverAdapterError` veya `meta.driverAdapterError.cause.originalCode === "23503"` olarak gelir.
 */
export function isPrismaForeignKeyViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003") return true;
    if (adapterFkFromMeta(err.meta)) return true;
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "DriverAdapterError"
  ) {
    const cause = (err as { cause?: AdapterCause }).cause;
    return cause?.originalCode === "23503";
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/foreign key constraint|23503/i.test(msg)) return true;
  return false;
}

/** Unique constraint (ör. @unique ihlali); driver adapter bazen farklı sarmalar. */
export function isPrismaUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return true;
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "DriverAdapterError"
  ) {
    const cause = (err as { cause?: { originalCode?: string } }).cause;
    if (cause?.originalCode === "23505") return true;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = err.meta as { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined;
    if (meta?.driverAdapterError?.cause?.originalCode === "23505") return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/unique constraint|23505|duplicate key/i.test(msg)) return true;
  return false;
}
