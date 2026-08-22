/**
 * Ödeme sağlayıcı PORT'u (hexagonal).
 *
 * NEDEN VAR: 2026-08-22 denetiminde kök neden şuydu — sistemde hiçbir ödeme
 * sağlayıcısı entegre değilken `PaymentLog.status` varsayılanı `SUCCESS` idi ve
 * `BookingService.markAsPaid` hiç defter satırı yazmadan rezervasyonu `PAID`
 * işaretliyordu. Sonuç: prod'da parası alınmamış 7 "ödenmiş" rezervasyon ve
 * karşılığı olmayan 3.480 TRY'lik 12 `SUCCESS` kaydı.
 *
 * Bu arayüz o hatayı yapısal olarak imkânsız kılar: para durumu yalnızca bir
 * sağlayıcı üzerinden değişir, her değişim deftere yazılır ve sağlayıcı adı
 * kaydın içinde durur. Iyzico/PayTR/Stripe entegrasyonu geldiğinde yeni bir
 * adaptör dosyası eklenir — çağıran hiçbir kod değişmez.
 */

/** Kuruş cinsinden tamsayı. Float para hatası yapmamak için tek birim budur. */
export type Minor = number;

export type PaymentIntentInput = {
  bookingId: string;
  /** Kuruş. 120,50 TRY -> 12050 */
  amountMinor: Minor;
  currency: string;
  /**
   * Aynı niyetin iki kez açılmasını engeller. Sağlayıcıya da iletilir; defterde
   * `@unique` olduğu için tekrar denemesi ikinci bir satır yaratmaz.
   */
  idempotencyKey: string;
};

export type PaymentIntentResult = {
  /** Sağlayıcının kendi referansı (varsa). Manuel tahsilatta null. */
  providerRef: string | null;
  /**
   * Misafirin yönlendirileceği 3D Secure / ödeme sayfası. Manuel tahsilatta null
   * — tahsilat dükkanda yapılır.
   */
  redirectUrl: string | null;
  /** Sağlayıcı anında tahsil ettiyse true (manuel tahsilatta her zaman false). */
  capturedImmediately: boolean;
};

export type PaymentRefundInput = {
  bookingId: string;
  providerRef: string | null;
  amountMinor: Minor;
  currency: string;
  reason: string;
};

export type PaymentRefundResult = {
  providerRef: string | null;
  /** Sağlayıcı iadeyi anında tamamladıysa true; kuyruğa aldıysa false. */
  settled: boolean;
};

/**
 * Sağlayıcının yeteneklerini çağırana bildirir. UI ve kamuya açık metinler bunu
 * okur — "kartınıza 5-10 iş gününde iade" gibi bir vaadin ekranda görünmesi
 * `supportsCardRefund` true olmasına bağlıdır, geliştiricinin hatırlamasına değil.
 */
export type PaymentCapabilities = {
  /** Sağlayıcı adı; `PaymentLog.provider` alanına aynen yazılır. */
  readonly id: string;
  /** Kart online çekiliyor mu? false ise tahsilat dükkanda yapılır. */
  readonly capturesOnline: boolean;
  /** Karta otomatik iade yapılabiliyor mu? */
  readonly supportsCardRefund: boolean;
  /** Platform komisyonu sağlayıcı tarafında mı ayrılıyor (marketplace split)? */
  readonly supportsSplit: boolean;
};

export interface PaymentProvider {
  readonly capabilities: PaymentCapabilities;

  /** Ödeme niyeti açar. Defter satırını çağıran (PaymentService) yazar, bu değil. */
  createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;

  /**
   * Parayı tahsil eder. Manuel tahsilatta bu, dükkanın "aldım" beyanıdır —
   * bu yüzden `actor` zorunlu ve denetim izine yazılır.
   */
  capture(input: {
    bookingId: string;
    providerRef: string | null;
    amountMinor: Minor;
    currency: string;
  }): Promise<{ providerRef: string | null; transactionId: string | null }>;

  refund(input: PaymentRefundInput): Promise<PaymentRefundResult>;
}
