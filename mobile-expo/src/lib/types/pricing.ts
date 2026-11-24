import type { BookingStatus } from "./booking";
import type { HoursNotice } from "./shop";

export type CheckoutRequest = {
  shopId: string;
  checkInTime: string;
  checkOutTime: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  couponCode?: string;
  referralCode?: string;
  /** Araci "Referans kodu" (`?aff=` derin baglantisi ya da elle). Atfi sunucu dogrular. */
  affiliateCode?: string;
  /** Ekranda gosterilen toplam: sunucu farkli hesaplarsa 409 `price_changed` doner. */
  expectedTotal?: number;
};

/** `POST checkout/quote`: indirim kodu onizlemesi. Baglayici degil. */
export type CheckoutQuote = {
  /** Sunucunun hesapladigi satirlar: ekran fiyati KENDISI hesaplamaz. Eski sunucu gondermez. */
  days?: number;
  lines?: { size: "s" | "m" | "xl"; count: number; days: number; amount: number }[];
  insuranceFee?: number;
  subtotal: number;
  total: number;
  /** Uygulama indirimi: `subtotal`dan once dusulur, `total` zaten indirimli. Eski sunucu gondermez. */
  appDiscount?: { pct: number; amount: number } | null;
  /** Tek indirim: kupon, davet ya da araci (buyuk olan; `CheckoutDiscountService`). */
  discount: { kind: "coupon" | "referral" | "affiliate"; code: string; amount: number } | null;
  /** `not_combinable`: kod gecerli ama daha buyuk referans indirimi uygulaniyor. */
  codeStatus: "applied" | "invalid" | "min_price" | "own_code" | "not_first_booking" | "not_combinable" | null;
  minPrice: number | null;
  /** Araci kodu durumu; `attributed` = atif var, indirim yok ya da kaybetti. Eski sunucu gondermez. */
  affiliate?: { code: string; status: "applied" | "attributed" | "invalid" | "own_code"; ratePct: number; amount: number } | null;
  /** Dukkanin saatine oturtulmus anlar; rezervasyon bunlarla olusur. */
  checkInTime?: string;
  checkOutTime?: string;
  hoursNotice?: HoursNotice | null;
};

export type CheckoutResponse = {
  bookingId: string;
  status: BookingStatus;
  totalPrice: number;
};

/**
 * `PUT bookings/[id]/modify`. Iki saat ZORUNLU; valiz sayisi verilmezse sunucu
 * mevcut sayiyi korur. Basarida yalnizca `{ success: true }` doner.
 */
/** `PUT bookings/[id]/modify?preview=1`: sunucunun hesapladigi yeni tutar, yazmadan. */
export type ModifyBookingPreview = {
  days: number;
  lines: { size: "s" | "m" | "xl"; count: number; days: number; amount: number }[];
  insuranceFee: number;
  newTotal: number;
  oldTotal: number;
  priceChangeBlocked: boolean;
};

export type ModifyBookingRequest = {
  checkInTime: string;
  checkOutTime: string;
  bagCountS?: number;
  bagCountM?: number;
  bagCountXl?: number;
};

export type ModifyBookingResponse = { success: true };
