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

/**
 * Var olmayan kullanicida da bcrypt maliyetini odemek icin sabit bir hash.
 * Hicbir sifre bunu dogrulamaz (rastgele uretildi, karsiligi saklanmadi);
 * tek isi `verifyPassword`in ayni sureyi harcamasini saglamak.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.qEqOVYBQ7ANlDkiUEJVWEBSCa/8LtWK";

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
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { emailOrPhone, password } = parsed.data;

        /*
          IKI KOVA (ikincisi 2026-08-31'de eklendi).

          Kimlik basina kova (`login:<kimlik>`) tek bir hesabi zorlamayi
          engelliyor. SIFRE SERPMESINI (password spraying) engellemiyordu:
          saldirgan binlerce farkli e-postayi ayni "Password1!" ile deneyince
          her istek AYRI kovaya dusuyor ve toplam bir sinir bulunmuyordu. Kurum
          hesaplarinda calisan saldiri tam olarak budur; hedef tek hesap degil,
          "zayif sifre kullanan HERHANGI biri".

          Depo acik kaynak: uc adresi, govde alan adlari ve kova pencereleri
          zaten okunabiliyor. Sinirlamayi kodun gizliligi tasiyamaz, kovanin
          kendisi tasimali.

          IP kovasi cömert (15 dakikada 30): ayni ofisten / mobil operator
          NAT'i arkasindan gelen gercek kullanicilari dusurmemeli, ama binlerce
          hesabi tarayan bir istemciyi durdurmali.
        */
        const forwarded = request?.headers?.get?.("x-forwarded-for");
        const ip =
          forwarded?.split(",")[0]?.trim() ||
          request?.headers?.get?.("x-real-ip") ||
          "unknown";
        if (!(await rateLimit(`login:ip:${ip}`, 30, 15 * 60 * 1000))) {
          throw new TooManyAttemptsSignin();
        }
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

        const { verifyPassword } = await import("@/lib/auth-password");

        /*
          KULLANICI SAYIMI (2026-08-31). Onceki hali kullanici yoksa bcrypt'i
          HIC calistirmadan donuyordu; bcrypt 12 turda onlarca milisaniye
          suruyor. Aradaki fark olculebilir: saldirgan yanit suresine bakarak
          "bu e-posta kayitli mi" sorusunu ucretsiz yanitliyordu. Kayitli
          e-posta listesi, sonraki asamanin (serpme, oltalama) girdisidir.

          Sabit maliyet icin gercek bir hash'e karsi bos karsilastirma yapilir.
          Sonuc her zaman `false`; amaci yalnizca ayni sureyi harcamak.
        */
        if (!user?.passwordHash) {
          await verifyPassword(password, DUMMY_PASSWORD_HASH);
          return null;
        }

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
