/** `toMobileWalkInResult` (../src/lib/mobile-dto/walk-in.ts): `POST partner/walk-in`. */
export type WalkInResult = {
  bookingId: string;
  shortCode: string;
  qrCodeToken: string | null;
  totalPrice: number;
  checkInTime: string;
  checkOutTime: string;
  checkedIn: boolean;
  /** Muhur zorunlu ya da teslim reddedildi: normal teslim ekrani acilir. */
  needsCheckIn: boolean;
  checkInErrorCode: string | null;
  emailQueued: boolean;
};

export type WalkInRequest = {
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  bagCount: number;
  pickupAt: string;
  termsConfirmed: true;
};

/** `toMobileShopSourceStats`: panodaki afis / kapidan gelen sayilari (yeni sunucu). */
export type ShopSourceStats = {
  thisMonth: { poster: number; walkIn: number };
  lastMonth: { poster: number; walkIn: number };
};

/** `toMobileBookingSourceBreakdown`: yonetici analitiginde kanal dagilimi (yeni sunucu). */
export type BookingSourceBreakdown = { web: number; app: number; walkIn: number; poster: number; unknown: number };
