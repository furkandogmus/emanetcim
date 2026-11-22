import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth-password";
import { writeAuditLog } from "@/lib/audit-log";

/**
 * Admin'in misafir/esnaf için yeni şifre belirlemesi.
 *
 * Esnafların bir kısmı e-postasız (yalnızca telefon + isim) kayıtlı; "şifremi
 * unuttum" e-posta istediği için kendileri sıfırlayamıyor, SMS de kapalı. Admin
 * şifreyi belirleyip esnafa elden iletir. Şifreler bcrypt'li olduğu için mevcut
 * şifreyi GÖSTERMEK mümkün değil; tek yol yenisini koymak.
 *
 * ADMIN hesaplarına uygulanmaz: bir admin'in başka admin'in şifresini
 * değiştirmesi, rol değişikliğindeki ikinci onay kapısını delmek olur.
 * `tokenVersion` artar: eski oturumlar düşer, kullanıcı yeni şifreyle girer.
 *
 * Denetim kaydı burada (web action'ı ve mobil admin ucu aynı gövdeyi çağırır).
 * Şifre kayda YAZILMAZ; yalnızca "kim, kime, ne zaman".
 */
export type AdminSetPasswordResult =
  | { ok: true; phone: string | null; name: string | null }
  | { ok: false; reason: "invalid_password" | "not_found" | "forbidden_target" };

export async function adminSetUserPassword(
  targetUserId: string,
  rawPassword: string,
  actor: { userId: string; role: string; ip: string | null },
): Promise<AdminSetPasswordResult> {
  const password = typeof rawPassword === "string" ? rawPassword : "";
  if (password.trim().length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: "invalid_password" };
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, phone: true, name: true },
  });
  if (!user) return { ok: false, reason: "not_found" };
  if (user.role === Role.ADMIN) return { ok: false, reason: "forbidden_target" };

  const passwordHash = await hashPassword(password);
  // Rol koşulu yazımın içinde: kontrolle yazım arasında admin'e yükseltilen hesap korunur.
  const updated = await prisma.user.updateMany({
    where: { id: user.id, role: { not: Role.ADMIN } },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
  if (updated.count === 0) return { ok: false, reason: "forbidden_target" };
  writeAuditLog({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: "user.password_set_by_admin",
    entityType: "User",
    entityId: user.id,
    metadata: {},
    ip: actor.ip,
  });
  return { ok: true, phone: user.phone, name: user.name };
}
