import crypto from "crypto";
import prisma from "@/lib/db";

/**
 * Belirtilen e-posta için yeni bir doğrulama tokenı üretir ve veritabanına kaydeder.
 * Eski tokenlar varsa silinir.
 * @param email Alıcı e-posta adresi
 * @returns Oluşturulan token objesi
 */
export const generateVerificationToken = async (email: string) => {
  const token = crypto.randomUUID();
  const expires = new Date(new Date().getTime() + 3600 * 1000); // 1 saat geçerli

  // Tek aktif token: findFirst+delete yarista ikinci satiri birakabiliyordu.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  const verificationToken = await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  return verificationToken;
};
