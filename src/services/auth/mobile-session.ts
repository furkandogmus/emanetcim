import prisma from "@/lib/db";

/**
 * Bir kullanicinin BUTUN mobil oturumlarini gecersiz kilar.
 *
 * Mobil kimlik durumsuz JWT (`src/lib/mobile-auth.ts`): sunucuda iptal
 * edilebilecek bir oturum satiri yok. Tek kaldirac `User.tokenVersion` —
 * `requireMobileUser` ve `/api/mobile/auth/refresh` her istekte token'daki `tv`
 * ile buradaki degeri karsilastiriyor. Artirmak, o kullaniciya ait butun access
 * (15dk) ve refresh (30 GUN) token'larini aninda dusurur.
 *
 * NEDEN SERVISTE: bunu cagirmasi gereken en az uc yer var — cikis, sifre
 * sifirlama, hesap askiya alma. Ucu de kendi `user.update`'ini yazarsa biri
 * `tokenVersion`i unutur ve o yol sessizce hicbir seyi iptal etmez. Cikis
 * ucunun 2026-08-31'e kadarki hali tam olarak buydu: yalnizca web `Session`
 * satirlarini siliyor, mobil token'lara dokunmuyordu.
 *
 * `Session` satirlari da silinir: ayni hesap web'de acilmis olabilir ve
 * "cikis yap" ikisini de kapatmali.
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
}
