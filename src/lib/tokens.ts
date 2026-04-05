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

  const existingToken = await prisma.verificationToken.findFirst({
    where: { identifier: email },
  });

  if (existingToken) {
    await prisma.verificationToken.delete({
      where: { token: existingToken.token },
    });
  }

  const verificationToken = await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  return verificationToken;
};
