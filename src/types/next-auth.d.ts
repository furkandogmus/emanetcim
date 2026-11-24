import { DefaultSession } from "next-auth";
import { Role } from "@prisma/client";

/**
 * Auth.js Type Extension
 * Session ve User nesnelerine 'role' alanını ekleyerek TypeScript hatalarını giderir.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      emailVerified: Date | null;
    } & DefaultSession["user"];
    /** Yalniz yonetici "olarak goruntule" oturumunda; `user` o an hedef kullanicidir. */
    impersonation?: { adminId: string; expiresAt: string };
  }

  interface User {
    role?: Role;
    emailVerified?: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    emailVerified?: Date | null;
    tv?: number;
  }
}
