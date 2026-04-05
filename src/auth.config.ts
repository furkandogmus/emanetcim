import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { Role, User as PrismaUser } from "@prisma/client";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  emailOrPhone: z.string().min(1, "E-posta veya Telefon gereklidir"),
  password: z.string().min(1, "Şifre gereklidir"),
});

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        emailOrPhone: { label: "Email or Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { emailOrPhone, password } = parsed.data;

        // Rate limit kontrolü
        if (!(await rateLimit(`login:${emailOrPhone.toLowerCase()}`, 10, 60 * 60 * 1000))) {
          throw new Error("TooManyRequests");
        }

        const { default: prisma } = await import("@/lib/db");
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: emailOrPhone, mode: "insensitive" } },
              { phone: emailOrPhone }
            ]
          },
        });

        if (!user || !user.passwordHash) return null;

        const { verifyPassword } = await import("@/lib/auth-password");
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) return null;

        // Ban kontrolü
        if ((user as PrismaUser).isBanned) {
          throw new Error("UserBanned");
        }

        // Email doğrulama kontrolü: Eğer email varsa doğrulanmış olmalı
        if (user.email && !user.emailVerified) {
          throw new Error("EmailVerificationRequired");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const { default: prisma } = await import("@/lib/db");
        const adminEmails = (process.env.ADMIN_EMAILS || "").split(",");
        const isDefaultAdmin = adminEmails.includes(user.email || "");

        // Mevcut kullanıcıyı bul
        let existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              role: isDefaultAdmin ? Role.ADMIN : Role.GUEST,
              emailVerified: new Date(),
            },
          });
        } else if (isDefaultAdmin && existingUser.role !== Role.ADMIN) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { role: Role.ADMIN },
          });
        }
        
        // Ban kontrolü
        if ((existingUser as PrismaUser).isBanned) {
          return false;
        }

        user.role = existingUser.role;
        user.id = existingUser.id;
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      if (trigger === "update" && session) {
        token.name = session.user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // Hata durumunda login sayfasına ve query param'a düşer (auth-error-message.ts ile yakalıyoruz)
  },
} satisfies NextAuthConfig;

export default authConfig;
