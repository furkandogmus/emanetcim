/** `GET /config` (kimliksiz). `paymentMode`: eski sunucu gondermez, o zaman "onsite" varsayilir. */
export type AppConfig = {
  minAppVersion: string | null;
  latestAppVersion: string | null;
  requireSealsOnCheckIn?: boolean;
  paymentMode?: "online" | "onsite";
  /** Wallet kartlari acik mi. Eski sunucu gondermez: o zaman dugme cizilmez. */
  walletApple?: boolean;
  walletGoogle?: boolean;
};
