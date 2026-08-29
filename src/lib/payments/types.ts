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
  /** Alt üye iş yeri başvurusu API ile yapılabiliyor mu? */
  readonly supportsOnboarding: boolean;
  /** Sağlayıcı webhook gönderiyor mu? */
  readonly supportsWebhooks: boolean;
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

  /* --- Pazaryeri yetenekleri --------------------------------------------- *
   * Bunlar İSTEĞE BAĞLI: dükkanda tahsilat yapan bir sağlayıcının onboarding'i
   * ya da webhook'u yoktur. Ama bir yeteneği `capabilities` içinde TRUE ilan
   * edip metodu yazmamak sessiz bir tuzak olurdu — `payment-provider-contract`
   * testi bu ikisinin birlikte gitmesini zorunlu kılıyor.
   * ----------------------------------------------------------------------- */

  /** `supportsOnboarding` true ise ZORUNLU. */
  onboardMerchant?(input: MerchantOnboardingInput): Promise<MerchantOnboardingResult>;

  /** `supportsOnboarding` true ise ZORUNLU. Başvurunun güncel durumunu sorar. */
  getMerchantStatus?(providerAccountId: string): Promise<MerchantOnboardingResult>;

  /** `supportsSplit` true ise ZORUNLU. */
  createSplit?(input: SplitInput): Promise<SplitResult>;

  /** `supportsWebhooks` true ise ZORUNLU. İmzayı doğrular ve olayı normalleştirir. */
  verifyWebhook?(request: WebhookRequest): Promise<WebhookVerification>;
}

/* ------------------------------------------------------------------------- *
 * Pazaryeri (marketplace) katmanı
 *
 * Buradaki tipler hiçbir sağlayıcıya ait değil. Amaç, PSP seçilmeden önce
 * çağıran tarafın (PaymentService, onboarding akışı, webhook ucu) tamamının
 * yazılabilmesi. Sağlayıcı seçildiğinde yalnızca adaptör dosyası eklenir.
 * ------------------------------------------------------------------------- */

/** Türkiye'deki tüzel kişilik tipi — alan zorunlulukları buna göre değişir. */
export type ProviderMerchantLegalType =
  | "INDIVIDUAL"
  | "SOLE_PROPRIETORSHIP"
  | "COMPANY";

/**
 * Alt üye iş yeri başvurusu. Alanlar `src/lib/tr/merchant.ts` tarafından
 * doğrulanmış ve normalize edilmiş halde gelir — adaptör tekrar doğrulamaz,
 * yalnızca sağlayıcının beklediği biçime çevirir.
 */
export type MerchantOnboardingInput = {
  shopId: string;
  legalType: ProviderMerchantLegalType;
  legalName: string;
  /** INDIVIDUAL'da dolu, diğerlerinde null. */
  tckn: string | null;
  /** INDIVIDUAL'da null, diğerlerinde dolu. */
  vkn: string | null;
  taxOffice: string | null;
  /** Boşluksuz, büyük harf. */
  iban: string;
  ibanHolder: string;
  addressLine: string;
  city: string;
  district: string | null;
  phone: string;
  email: string;
};

export type MerchantOnboardingStatus =
  | "PENDING"
  | "ACTIVE"
  | "REJECTED";

export type MerchantOnboardingResult = {
  /** Sağlayıcının verdiği alt üye iş yeri kimliği. */
  providerAccountId: string | null;
  status: MerchantOnboardingStatus;
  /** REJECTED ise esnafa gösterilecek sebep. */
  rejectionReason: string | null;
};

/**
 * Bir ödemenin sağlayıcı tarafında bölünmesi.
 *
 * Tutarlar KURUŞ ve zaten hesaplanmış gelir (`src/lib/platform-split.ts`).
 * Adaptör yeniden hesaplamaz — iki yerde hesaplanan bir komisyon, er geç iki
 * farklı sonuç verir.
 */
export type SplitInput = {
  bookingId: string;
  /** Bölünecek ödemenin sağlayıcı referansı. */
  providerRef: string | null;
  shopId: string;
  /** Esnafın bu sağlayıcıdaki hesabı. Yoksa split yapılamaz. */
  providerAccountId: string | null;
  grossMinor: Minor;
  merchantMinor: Minor;
  platformMinor: Minor;
  currency: string;
};

export type SplitResult = {
  providerRef: string | null;
  /** Sağlayıcı esnaf payını hemen aktardıysa true; hakediş takvimine aldıysa false. */
  settled: boolean;
};

/**
 * Sağlayıcı webhook'unun NORMALLEŞTİRİLMİŞ hali.
 *
 * Her PSP'nin gövdesi ve imza şeması farklı. Dışarıya tek bir olay kümesi
 * çıkıyor; `ReservationService` ve defter bu kümeyi bilir, sağlayıcıyı bilmez.
 */
export type NormalizedPaymentEvent =
  | { type: "PAYMENT_SUCCEEDED"; bookingId: string; providerRef: string | null; amountMinor: Minor; currency: string; transactionId: string | null }
  | { type: "PAYMENT_FAILED"; bookingId: string; providerRef: string | null; reason: string }
  | { type: "REFUND_COMPLETED"; bookingId: string; providerRef: string | null; amountMinor: Minor; currency: string }
  | { type: "PAYOUT_COMPLETED"; shopId: string; providerRef: string | null; amountMinor: Minor; currency: string }
  | { type: "MERCHANT_STATUS_CHANGED"; shopId: string; providerAccountId: string; status: MerchantOnboardingStatus; reason: string | null };

export type WebhookRequest = {
  /** Ham gövde — imza doğrulaması JSON.parse'tan ÖNCE ham metin üzerinde yapılır. */
  rawBody: string;
  headers: Record<string, string | undefined>;
};

/**
 * Doğrulama sonucu.
 *
 * `verified: false` dönen bir isteğe ASLA defter işlemi uygulanmaz. Ayrı bir
 * alan olması bilinçli: `null` dönmek "imza geçersiz" ile "tanımadığım olay"ı
 * aynı kefeye koyardı ve ikincisi sessizce yutulurdu.
 */
export type WebhookVerification =
  | { verified: false; reason: string }
  | { verified: true; event: NormalizedPaymentEvent | null };
