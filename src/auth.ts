import "@/lib/auth-public-url";
import NextAuth from "next-auth";
import type { Session, User, Account } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { authConfig } from "./auth.config";
import { notificationService } from "@/services/NotificationService";
import logger from "@/lib/logger";

/**
 * Auth.js (v5) - Merkezi Kimlik Doğrulama Konfigürasyonu
 * Google ve Apple sosyal girişlerini ve RBAC (Role-Based Access Control) yönetimini sağlar.
 */
/** ADMIN_EMAILS: virgülle ayrılmış e-posta listesi; Google ile ilk girişte bu adresler otomatik ADMIN olur. */
const adminEmailSet = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  debug: true,
  events: {
    async linkAccount({ user, account }) {
      if (account.type === "oauth") {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
    // Yalnızca adapter GERÇEKTEN yeni bir User satırı yarattığında tetiklenir
    // (web Google girişi) — credentials kaydı registerGuestAction'da ayrıca ele alınıyor.
    async createUser({ user }) {
      void notificationService
        .notifyAdminsForNewUser({
          name: user.name ?? null,
          email: user.email ?? null,
          phone: null,
          role: "GUEST",
          source: "web_google",
        })
        .catch((err) => logger.error({ err, userId: user.id }, "notify_admins_new_guest_failed"));
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.role = token.role || Role.GUEST;
        session.user.id = token.sub || "";
        // JWT serileştirmesinde Tarih stringleşebilir, istemci tarafı için Date nesnesi olduğundan emin oluyoruz.
        session.user.emailVerified = token.emailVerified ? new Date(token.emailVerified as unknown as string) : null;
      }
      return session;
    },
    async jwt({ token, user, account, trigger, session }: { token: JWT; user?: User; account?: Account | null; trigger?: string; session?: { user?: { emailVerified?: Date | string | null } } }) {
      if (user) {
        // İlk giriş anı veya oturum yenilenmesi
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        if (!dbUser) return token;

        const emailLower = (user.email ?? "").toLowerCase();
        if (adminEmailSet.has(emailLower) && dbUser.role !== Role.ADMIN) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: Role.ADMIN },
          });
          token.role = Role.ADMIN;
        } else {
          token.role = dbUser.role || Role.GUEST;
        }

        // Sosyal girişlerde (Google/Apple) e-postayı otomatik doğrula (DB + Token)
        if (account && account.provider !== "credentials") {
          if (!dbUser.emailVerified) {
            await prisma.user.update({
              where: { id: user.id },
              data: { emailVerified: new Date() },
            });
          }
          token.emailVerified = new Date();
        } else {
          token.emailVerified = dbUser.emailVerified || null;
        }
      }
      
      // Handle manual updates (e.g. from useSession().update())
      if (trigger === "update" && session?.user) {
        if (session.user.emailVerified) token.emailVerified = new Date(session.user.emailVerified as string);
      }

      // Clear huge base64 images from picture field to prevent cookie overflow
      if (token.picture && typeof token.picture === "string" && (token.picture.startsWith("data:") || token.picture.length > 1000)) {
        token.picture = null;
      }

      // DEBUG: Log the token keys and their sizes
      const sizes = Object.keys(token).map((k) => `${k}: ${JSON.stringify(token[k])?.length || 0}`);
      console.log("[auth][debug] Token keys sizes:", sizes.join(", "));
      if (JSON.stringify(token).length > 4000) {
        console.log("[auth][debug] Huge token detected, cleaning up unnecessary fields.");
        // Clean up everything except the essential fields
        const safeToken = {
          name: token.name,
          email: token.email,
          picture: token.picture,
          sub: token.sub,
          id: token.id || token.sub,
          role: token.role,
          emailVerified: token.emailVerified,
        };
        return safeToken as JWT;
      }

      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  /** Yerel geliştirmede .env’de AUTH_SECRET yoksa giriş `Configuration` hatası verir; prod’da AUTH_SECRET zorunlu. */
  secret:
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "development"
      ? "dev-only-auth-secret-not-for-production"
      : undefined),
  // Son sırada: ...authConfig ve setEnvDefaults ile ezilmesin. Docker/nginx/ngrok arkasında Host güvenilir.
  // AUTH_TRUST_HOST=false ile kapatılabilir.
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
});

