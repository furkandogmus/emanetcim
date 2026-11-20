import prisma from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

export type MobileInstallOpen = {
  installId: string;
  platform: "ios" | "android";
  appVersion?: string;
  userId?: string;
};

/** Mobil uygulama acilislari: tekil kullanici sayaci (`MobileInstall`). */
export const mobileInstallService = {
  async recordOpen({ installId, platform, appVersion, userId }: MobileInstallOpen) {
    const now = new Date();
    await prisma.mobileInstall.upsert({
      where: { installId },
      create: { installId, platform, appVersion, userId, firstSeenAt: now, lastSeenAt: now },
      // Cikis yapilinca son kullanici silinmez: "giris yapmis" sayaci cihazin
      // bir kez giris gormesine bakar.
      update: { platform, appVersion, lastSeenAt: now, ...(userId ? { userId } : {}) },
    });
  },

  /**
   * Son 1 / 7 / 30 gunde uygulamayi acan tekil KISI; kayan pencere. Giris yapmis
   * kullanici hesap basina bir kez sayilir (silip yeniden kuran ya da iki cihazi
   * olan iki kez sayilmasin); girissiz cihaz kurulum basina bir kez.
   */
  async activeCounts(now = new Date()) {
    const since = (days: number) => new Date(now.getTime() - days * DAY);
    const people = async (from: Date | null) => {
      const rows = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(DISTINCT COALESCE("userId", "installId")) AS n
        FROM "MobileInstall"
        WHERE ${from}::timestamp IS NULL OR "lastSeenAt" >= ${from}::timestamp`;
      return Number(rows[0]?.n ?? 0);
    };
    const [day, week, month, total, signedInMonth] = await Promise.all([
      people(since(1)),
      people(since(7)),
      people(since(30)),
      people(null),
      prisma.mobileInstall
        .findMany({
          where: { lastSeenAt: { gte: since(30) }, userId: { not: null } },
          distinct: ["userId"],
          select: { userId: true },
        })
        .then((r) => r.length),
    ]);
    return { day, week, month, total, signedInMonth };
  },
};
