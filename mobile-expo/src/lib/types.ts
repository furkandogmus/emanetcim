/**
 * Mobil API govdeleri. Kaynak: `../../src/lib/mobile-dto.ts` (web reposu) ve
 * uclarin kendisi. Orada bir alan degisirse burasi da degismeli.
 */
import type { CancelReason } from "./booking-state";

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

export type BookingStatus =
  | "PENDING"
  | "PAID"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED";

export type Shop = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  pricePerDay: number;
  capacity: number;
  rating: number | null;
  openingTime: string | null;
  closingTime: string | null;
  open247: boolean;
  hasRestroom: boolean;
  isActive: boolean;
  isVerified: boolean;
  /** Talep testi noktasi: haritada gorunur ama rezervasyon ALINMAZ. */
  isPrelaunch: boolean;
};

export type NearbyShop = Shop & {
  distanceKm: number;
  /** Yalnizca tarih filtresiyle aranirsa gelir. */
  bagsAvailable?: number;
  /** Kucuk-buyuk valiz gunluk fiyati. Eski sunucu gondermez: o zaman `pricePerDay`. */
  /** `medium`: orta boy valizin gunlugu; liste ve pinde gosterilen tek fiyat (eski sunucuda yok). */
  priceRange?: { min: number; max: number; medium?: number };
  /**
   * Aranan kalis ve valiz karisiminin sunucu toplami (`checkout/quote`un kodsuz toplamiyla ayni).
   * Yalnizca boy adetleriyle aranan, rezervasyon alabilen dukkanda gelir; eski sunucuda yok.
   */
  stayQuote?: { total: number; days: number; bags: number };
  /** Secilen saat dukkanin saatine oturtulduysa (ornegin alis kapanisa cekildi). */
  hoursNotice?: HoursNotice | null;
  /**
   * `false`: secilen saatte rezervasyon acilamaz (kapali gun, kapanistan sonra). Alan
   * yoksa (eski sunucu) rezervasyon alinabilir demektir. Yalnizca `includeClosed=1` ile gelir.
   */
  bookable?: boolean;
  /** Kapali dukkanin sonraki gercek acilisi (Istanbul gunu `YYYY-MM-DD` + `HH:mm`); bulunamazsa null. */
  nextOpen?: { date: string; at: string } | null;
};

export type HoursAdjustment = { at: string; reason: "opens" | "closes" };
export type HoursNotice = { drop: HoursAdjustment | null; pickup: HoursAdjustment | null };

export type ShopDetail = Shop & {
  /** Kapak (`image`) disindaki fotograflar, sirali. */
  gallery?: string[];
  weeklyHours?: { weekday: number; isClosed: boolean; openingTime: string; closingTime: string }[];
  closures?: { startDate: string; endDate: string }[];
  /** Boyut basina gunluk fiyat, sunucu yuvarlamasiyla. Eski sunucuda yok. */
  priceBySize?: { s: number; m: number; xl: number };
  pricing: {
    bagMultiplierS: number;
    bagMultiplierM: number;
    bagMultiplierXl: number;
    insuranceFeeTry: number;
  };
};

/** `toMobileReview` (mobile-dto.ts). */
export type ShopReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorLabel: string;
};

/** `GET /shops/:id/reviews?paged=1`. */
export type ShopReviewsPage = { items: ShopReview[]; total: number; nextCursor: string | null };

export type BookingSummary = {
  id: string;
  shopId: string;
  shopName: string;
  checkInTime: string;
  checkOutTime: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  totalPrice: number;
  status: BookingStatus;
  /** Suresi dolmus (gelinmemis) rezervasyon; sunucu karar verir. Eski sunucu gondermez. */
  expired?: boolean;
  /**
   * Iptal edilmis rezervasyonun nedeni. Eski sunucu gondermez: `undefined` `null` gibi
   * okunur (`cancelReasonOf`). Bilinmeyen yeni deger de neden yazmadan dusulur.
   */
  cancelReason?: CancelReason | (string & {}) | null;
};

export type { CancelReason } from "./booking-state";

export type BookingDetail = BookingSummary & {
  qrCodeToken: string | null;
  guestName: string;
  /** Yalnizca esnaf/yonetici ve aktif rezervasyonda dolu; aksi halde bos. */
  guestPhone?: string;
  latitude: number | null;
  longitude: number | null;
  shopPhone: string;
  /** "Adres, semt, sehir". Eski sunucu gondermez. */
  shopAddress?: string;
  seals: { sealNumber: number; bagIndex: number; bagSize: string }[];
  /** Eski sunucu gondermez; o zaman tekrar gonderim 409 ile yakalanir. */
  hasReview?: boolean;
  hasDispute?: boolean;
  /** Bildirimin durumu (`toMobileDisputeStatus`); bildirim yoksa ya da eski sunucuda yok. */
  disputeStatus?: DisputeStatus | null;
  /** Esnafin onerdigi, misafir onayi bekleyen valiz duzeltmesi. */
  pendingBagRevision?: PendingBagRevision | null;
  /** Yalnizca esnaf/admin ve CHECKED_IN: su an teslim edilirse gecikme ucreti ve erken iade. */
  checkoutPreview?: { lateFeeTry: number; earlyRefund: number } | null;
  /**
   * Yalnizca esnaf/admin: "Misafir gelmedi" bu andan (ISO) sonra kullanilabilir; `null`
   * bu rezervasyonda hic yok demek. Eski sunucu gondermez, `undefined` `null` sayilir.
   */
  noShowAvailableAt?: string | null;
};

/** `partner/bookings/[id]/cancel` neden secenekleri. */
export type PartnerCancelReason = "guest_request" | "shop_closed" | "capacity" | "other";

export type PartnerCancelRequest = { reason: PartnerCancelReason; note?: string };

/** Yonetim islem uclarinin (iptal, zorla teslim, gelmedi) ortak yaniti. */
export type BookingActionResponse = { success: true };

export type PendingBagRevision = {
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  extraAmount: number;
  newTotal: number;
};

export type PartnerBooking = BookingSummary & { guestName: string };

/** `partner/bookings/[id]/bag-revision` POST govdesi; uc eksik boyutu mevcut degerden tamamlar. */
export type BagRevisionRequest = { bagCountS: number; bagCountM: number; bagCountXl: number };

export type BagRevisionResponse = { success: true; newTotal: number };

/** `partner/shop` GET; yalnizca kullanilan alanlar. */
export type PartnerShop = {
  id: string;
  name: string;
  image: string | null;
  /** Kapak disindaki fotograflar; `/partner/shop/images` ile eklenir/silinir. */
  gallery?: { id: string; url: string }[];
  /** Kurulum ozeti: eksikse panoda "dukkanini tamamla". Eski sunucu gondermez. */
  setup?: { hasPhoto: boolean; hoursConfigured: boolean };
  /** Yonetici ayari: check-in'de muhur numarasi zorunlu. Eski sunucu gondermez. */
  requireSealsOnCheckIn?: boolean;
};

/** `toMobileSealRequest` (mobile-dto.ts). Durum sunucuda serbest metin; bilinen degerler bunlar. */
export type SealRequestStatus = "PENDING" | "SHIPPED" | "DELIVERED";

export type SealRequest = {
  id: string;
  quantity: number;
  status: SealRequestStatus | (string & {});
  trackingNumber: string | null;
  serialFrom: number | null;
  serialTo: number | null;
  adminNote: string | null;
  autoGenerated: boolean;
  createdAt: string;
};

/** `partner/seals` GET. */
export type PartnerSealsResponse = {
  /** Stogun ait oldugu dukkan; eski sunucu gondermez. */
  shop?: { id: string; name: string };
  assignedCount: number;
  inUseCount: number;
  returnedCount: number;
  sealReorderPoint: number;
  requests: SealRequest[];
};

export type SealRequestResponse = { success: true; id: string; count: number };

export type SealDeliveryResponse = { success: true; assignedCount: number };

export type PartnerBookingsResponse = {
  items: PartnerBooking[];
  total: number;
  page: number;
  limit: number;
  /** Gecmiste daha eski kayit varsa `?cursor=` ile istenir. Eski sunucu gondermez. */
  nextCursor?: string | null;
};

export type CheckoutRequest = {
  shopId: string;
  checkInTime: string;
  checkOutTime: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  couponCode?: string;
  referralCode?: string;
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
  discount: { kind: "coupon" | "referral"; code: string; amount: number } | null;
  codeStatus: "applied" | "invalid" | "min_price" | "own_code" | "not_first_booking" | null;
  minPrice: number | null;
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

/** `POST reviews`. Puan 1-5 tam sayi; yorum en cok 2000 karakter (ReviewService). */
export type CreateReviewRequest = { bookingId: string; rating: number; comment?: string };

export type CreateReviewResponse = { success: true; review: { id: string; rating: number } };

export type DisputeReason = "DAMAGE" | "THEFT" | "OTHER";
/** `../src/lib/dispute-status.ts` ile ayni liste. */
export type DisputeStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

/** `POST disputes`. Aciklama 10-2000 karakter (uc semasi). */
export type CreateDisputeRequest = { bookingId: string; reason: DisputeReason; description: string };

export type CreateDisputeResponse = { success: true; id: string };

/** `admin/stats`. */
export type AdminStats = {
  totalBookings: number;
  totalRevenue: number;
  totalPartners: number;
  pendingApplications: number;
  unreadMessages: number;
};

/** `toMobileAdminApplication` (mobile-dto.ts). */
export type AdminApplication = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  hasCoordinates: boolean;
  pricePerDay: number;
  capacity: number;
  createdAt: string;
  owner: { name: string | null; phone: string | null; email: string | null; whatsapp?: string | null };
};

/** `toMobileGeocodeResult` (mobile-dto.ts) — `GET /geocode?q=`. */
export type GeocodeResult = {
  label: string;
  /** Satir basligi (otel/cadde adi) ve alt basligi (ilce, sehir). Eski sunucuda yok. */
  title?: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
  /** En fazla bes sonuc (Turkiye). Eski sunucu gondermez: o zaman ust duzey tek sonuc. */
  items?: { label: string; title?: string; subtitle?: string; latitude: number; longitude: number }[];
};

/** `admin/messages` (sunucu `toMobileAdminMessage`). */
export type ContactMessage = {
  id: string;
  from: string;
  subject: string | null;
  text: string | null;
  isRead: boolean;
  category?: string;
  createdAt: string;
  /** Son cevabin zamani; cevaplanmamissa null. Eski sunucuda yok. */
  repliedAt?: string | null;
};

/**
 * `partner/shop` GET'in ayarlar ekraninin okudugu alanlari (`toMobilePartnerShop`).
 * `priceRange` sunucunun fiyat bandi: istemci hesaplamaz, yalnizca gosterir.
 */
export type PartnerShopSettings = PartnerShop & {
  capacity: number;
  pricePerDay: number;
  address: string | null;
  city: string | null;
  district: string | null;
  priceRange?: { min: number; max: number };
};


/** `partner/shop/schedule` GET. Gun ISO (1 = pazartesi), saatler "HH:mm", tarihler dukkan gunu "YYYY-MM-DD". */
export type ScheduleDay = { weekday: number; isClosed: boolean; openingTime: string; closingTime: string };
export type ShopClosure = { id: string; startDate: string; endDate: string; reason: string | null };
export type PartnerSchedule = { open247: boolean; days: ScheduleDay[]; closures: ShopClosure[] };

/** 409 `schedule_conflict` govdesindeki `conflicts` (`ShopScheduleService.ScheduleConflict`). */
export type ScheduleConflict = {
  bookingId: string;
  guestName: string | null;
  date: string;
  kind: "dropoff" | "pickup" | "bags_on_shelf";
};

/** `referrals/code` GET. `discountPct` davet edilenin ilk rezervasyon indirimi (0-50). */
export type ReferralCode = { code: string; discountPct: number };

/** `partner/earnings/stats` GET. Tutarlar esnaf payi (komisyon dusulmus). */
export type PartnerEarnings = {
  totalBalance: number;
  todayEarnings: number;
  pendingPayout: number;
  /**
   * `toMobilePartnerEarningRow`. Tarih TESLIM anidir (`collectedAt`; `createdAt` ayni degerin eski adi).
   * `bookingId`/`guestName`/`collectedAt` yeni sunucuda gelir; eski sunucuda yok.
   */
  history: {
    date: string;
    createdAt?: string;
    collectedAt?: string;
    bookingId?: string;
    guestName?: string;
    amount: number;
    shopId: string;
    status: "PAID";
  }[];
  currency: string;
  /** Yururlukteki oran, 0..1. Dukkanda tahsilatta 0. */
  commissionRate: number;
  merchantShareRatio: number;
};

/** `toMobilePartnerDashboard` (../src/lib/mobile-dto.ts). */
export type PartnerDashboard = {
  shop: { id: string; name: string };
  /** `isActive` eski sunucuda yok: yoksa aktif say. */
  shops: { id: string; name: string; isActive?: boolean }[];
  todayArrivals: number;
  todayPickups: number;
  bagsInStorage: number;
  monthNet: number;
  prevMonthNet: number;
  /** Gecen ay 0 ise `null`; "%∞" yazilmaz. */
  monthChangePct: number | null;
};

/** `admin/overview` (`toMobileAdminOverview`). */
export type AdminOverview = {
  series: { date: string; revenue: number; bookings: number }[];
  today: { arrivals: number; pickups: number; bagsInStorage: number; newBookings: number; revenue: number };
  attention: { pendingApplications: number; unreadMessages: number; openDisputes: number; overdueBookings: number };
  totals: { revenue: number; bookings: number; activeShops: number };
  /** Uygulamayi acan tekil cihaz; eski sunucuda yok. */
  appUsers?: { day: number; week: number; month: number; total: number; signedInMonth: number };
  recent: (BookingSummary & { guestName: string; createdAt: string })[];
};

export type AdminBookingFilter = "arrivals" | "pickups" | "inStorage" | "overdue" | "noShow" | "upcoming" | "all";

/** `admin/bookings` (`toMobileAdminBookingRow`). */
export type AdminBookingRow = BookingSummary & { guestName: string; createdAt: string };

export type AdminBookingsResponse = { bookings: AdminBookingRow[]; nextCursor?: string | null };

export type AdminBookingCounts = Record<AdminBookingFilter, number>;

/** `admin/bookings/[id]` (`toMobileAdminBookingDetail`). QR token'i yok. */
export type AdminBookingDetail = AdminBookingRow & {
  guest: { id?: string | null; name: string; email: string; phone: string; whatsapp?: string | null; canViewAs?: boolean };
  shop: {
    id?: string;
    ownerId?: string;
    name: string;
    address: string;
    phone: string;
    whatsapp?: string | null;
    ownerName: string;
    canViewAsOwner?: boolean;
    latitude: number | null;
    longitude: number | null;
  };
  seals: { sealNumber: number; bagIndex: number; bagSize: string }[];
  checkedInAt: string | null;
  checkedOutAt: string | null;
  couponCode: string | null;
  disputeStatus: string | null;
  paymentStatus: string | null;
  events: { event: string; actorRole: string | null; createdAt: string }[];
  /** Esnaf detayindaki alanla ayni anlam; eski sunucu gondermez. */
  noShowAvailableAt?: string | null;
};

/** `admin/shops` (`toMobileAdminShop`). */
export type AdminShop = {
  id: string;
  name: string;
  place: string;
  capacity: number;
  rating: number | null;
  isPrelaunch: boolean;
  isActive: boolean;
  isTest: boolean;
  isVerified: boolean;
  /** Misafirden saklayan durumlar (sunucu `shopVisibilityIssues`); talep testi ve test kaydinda bos. */
  issues: ShopVisibilityIssue[];
  phone: string;
  whatsapp?: string | null;
  bagsInStorage: number;
  arrivalsToday: number;
  pickupsToday: number;
};

export type ShopVisibilityIssue = "inactive" | "noLocation" | "noCityPage" | "noPhoto";

/** `/admin/shops/:id` (sunucu `toMobileAdminShopDetail`). */
export type AdminShopDetail = {
  id: string;
  name: string;
  address: string;
  place: string;
  capacity: number;
  rating: number;
  pricePerDay: number;
  isActive: boolean;
  isTest: boolean;
  isVerified: boolean;
  isPrelaunch: boolean;
  hasPhoto: boolean;
  latitude: number | null;
  longitude: number | null;
  /** null = 7/24 acik. */
  hours: { open: string; close: string } | null;
  createdAt: string;
  owner: { id: string; name: string; email: string; phone: string; whatsapp?: string | null; canViewAs?: boolean };
  bookingCount: number;
  reviewCount: number;
  bagsInStorage: number;
  arrivalsToday: number;
  pickupsToday: number;
  /** Dukkani listeleyen sehir sayfalarinin slug'lari. */
  cityPages: string[];
  issues: ShopVisibilityIssue[];
  recent: AdminBookingRow[];
};

export type AdminShopPatch = Partial<
  Pick<
    AdminShopDetail,
    "name" | "address" | "capacity" | "pricePerDay" | "isActive" | "isTest" | "isVerified" | "latitude" | "longitude"
  >
>;

/** `/admin/users` satiri (sunucu `toMobileAdminUser`). */
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp?: string | null;
  role: Role;
  isBanned: boolean;
  isTest: boolean;
  bookingCount: number;
  shopCount: number;
  createdAt: string;
};

/** `/cities`: dukkani olan sehirler (sunucu `toMobileCity`). */
export type CityCoverage = {
  name: string;
  /** Yazimdan bagimsiz anahtar ("istanbul"); eski sunucuda yok, istemci adindan turetir. */
  slug?: string;
  shopCount: number;
  latitude: number;
  longitude: number;
  /** Merkezden sehrin en uzak dukkanina (m). Eski sunucu gondermez. */
  radiusM?: number;
  coverImage: string | null;
};

/** `PUT partner/shop` yaniti: kaydin etkisi (acik rezervasyon / raf kapasitesi). */
export type PartnerShopUpdateResult = {
  impact?: { bookingsOutsideHours: number; bagsOverCapacity: number };
};

/** `GET /config` (kimliksiz). `paymentMode`: eski sunucu gondermez, o zaman "onsite" varsayilir. */
export type AppConfig = {
  minAppVersion: string | null;
  latestAppVersion: string | null;
  requireSealsOnCheckIn?: boolean;
  paymentMode?: "online" | "onsite";
};

/** Duyuru hedef kitlesi (sunucu `BroadcastAudience`). */
export type BroadcastAudience = "PARTNERS" | "GUESTS" | "ALL";
export type BroadcastStatus = "QUEUED" | "SENDING" | "DONE" | "FAILED";

/** `POST /admin/broadcasts/preview`. */
export type BroadcastPreview = { users: number; devices: number };

/** `GET /admin/broadcasts` satiri (sunucu `toMobileAdminBroadcast`). */
export type AdminBroadcast = {
  id: string;
  audience: BroadcastAudience;
  titleTr: string;
  bodyTr: string;
  status: BroadcastStatus;
  targetedDevices: number;
  sent: number;
  failed: number;
  createdAt: string;
  finishedAt: string | null;
  createdByName: string;
};

// --- Arama: sehrin ilceleri ---

/** `/cities/[slug]/districts`: dukkani olan ilceler (sunucu `toMobileDistrict`). */
export type DistrictCoverage = {
  name: string;
  slug: string;
  shopCount: number;
  /** Ilcedeki dukkanlarin ortalamasi. */
  latitude: number;
  longitude: number;
};

// --- /Arama: ilceler ---
