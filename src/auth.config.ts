import { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Role, User as PrismaUser } from "@prisma/client";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { isAppleOAuthConfigured } from "@/lib/auth-providers";

/**
 * `authorize` içinde düz `Error` fırlatmak Auth.js'te **CallbackRouteError**
 * olur ve kullanıcı `/auth/error?error=Configuration` sayfasına düşer —
 * "yapılandırma hatası" diye. Oysa sebep "çok fazla deneme" ya da "hesap
 * askıda". `CredentialsSignin` alt sınıfı `code` taşır; giriş formu bunu
 * okuyup doğru mesajı gösterir (2026-08-22 e2e koşusunda yakalandı).
 */
class TooManyAttemptsSignin extends CredentialsSignin {
  code = "tooManyRequests";
}
class UserBannedSignin extends CredentialsSignin {
  code = "UserBanned";
}

const loginSchema = z.object({
  emailOrPhone: z.string().min(1, "Errors.invalidData"),
  password: z.string().min(1, "Errors.authRequired"),
});

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    ...(isAppleOAuthConfigured()
      ? [
          Apple({
            clientId: process.env.APPLE_ID!,
            clientSecret: process.env.APPLE_SECRET!,
          }),
        ]
      : []),
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
          throw new TooManyAttemptsSignin();
        }

        const { default: prisma } = await import("@/lib/db");
        const phoneNorm = emailOrPhone.replace(/\D/g, "").replace(/^90|^0/, "");
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: emailOrPhone, mode: "insensitive" } },
              { phone: emailOrPhone },
              ...(phoneNorm.length === 10 && phoneNorm.startsWith("5")
                ? [{ phone: phoneNorm }]
                : []),
            ]
          },
        });

        if (!user || !user.passwordHash) return null;

        const { verifyPassword } = await import("@/lib/auth-password");
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) return null;

        // Ban kontrolü
        if ((user as PrismaUser).isBanned) {
          throw new UserBannedSignin();
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "credentials") {
        const { default: prisma } = await import("@/lib/db");
        
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (existingUser && (existingUser as PrismaUser).isBanned) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as PrismaUser).role;
        token.emailVerified = (user as PrismaUser).emailVerified;
      }
      if (trigger === "update" && session) {
        token.name = session.user.name;
      }
      // Clear huge base64 images from picture field to prevent cookie overflow
      if (token.picture && typeof token.picture === "string" && (token.picture.startsWith("data:") || token.picture.length > 1000)) {
        token.picture = null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.emailVerified = token.emailVerified as Date | null;
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
