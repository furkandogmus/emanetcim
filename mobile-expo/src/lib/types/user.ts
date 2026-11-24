export type Role = "GUEST" | "PARTNER" | "ADMIN";

export type MobileUser = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  emailVerified: boolean;
  /** Hesapta sifre var mi (hash degil). Profilde "sifre belirle" / "degistir" ayrimi. */
  hasPassword: boolean;
  /**
   * Yalniz `auth/me`: personel oldugu dukkan sayisi. Personel `PARTNER` degildir (rolu cogu
   * `GUEST`); eski sunucuda alan yok, yoksa 0 say.
   */
  staffShopCount?: number;
};

export type SessionResponse = {
  accessToken: string;
  refreshToken: string;
  user: MobileUser;
};

/** `auth/password-reset/confirm-code` POST; `user` eski/yeni sunucuda gelmeyebilir. */
export type ResetCodeSessionResponse = {
  success: true;
  accessToken: string;
  refreshToken: string;
  user?: MobileUser;
};

/** `referrals/code` GET. `discountPct` davet edilenin ilk rezervasyon indirimi (0-50). */
export type ReferralCode = { code: string; discountPct: number };
