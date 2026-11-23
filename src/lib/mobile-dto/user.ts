type MobileUserSource = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: string;
  image: string | null;
  emailVerified: Date | null;
  /** Yalnızca "var mı" bilgisi dışarı çıkar; hash asla. Select'te `passwordHash: true` şart. */
  passwordHash: string | null;
};

/**
 * Mobil istemciye giden KULLANICI gövdesi.
 *
 * NEDEN ORTAK (2026-08-25'te ölçüldü): beş uç bunu ayrı ayrı yazıyordu
 * (`apple`, `google`, `register`, `session`, `me`) ve **zaten ayrışmıştı**:
 * `emailVerified` yalnızca `session` ve `me` yanıtlarında vardı. Yani Apple veya
 * Google ile giren bir kullanıcı için uygulama e-postanın doğrulanıp
 * doğrulanmadığını BİLMİYORDU — "e-postanı doğrula" uyarısı hangi yoldan
 * girdiğine göre çıkıyor ya da çıkmıyordu.
 *
 * `emailVerified` tarih DEĞİL boolean olarak çıkar: istemcinin ihtiyacı olan tek
 * bilgi bu ve tarihin kendisi hesap sahibinin işine yaramıyor.
 */
export function toMobileUser(u: MobileUserSource) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    avatarUrl: u.image,
    emailVerified: u.emailVerified !== null,
    hasPassword: u.passwordHash !== null,
  };
}
