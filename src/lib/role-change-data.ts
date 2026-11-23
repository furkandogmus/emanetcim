import { Role, type Prisma } from "@prisma/client";

/**
 * Rol yazimi: token'lar duser (`tokenVersion`) ve ADMIN'e yukselen hesabin
 * inceleme bayragi kalkar (yonetici gorunumu test dukkanlariyla karismasin).
 * Iki yol (aninda ve ikinci admin onayi) ayni govdeyi yazar.
 */
export function roleChangeData(newRole: Role) {
  return {
    role: newRole,
    tokenVersion: { increment: 1 },
    ...(newRole === Role.ADMIN ? { reviewSandbox: false } : {}),
  } satisfies Prisma.UserUpdateInput;
}
