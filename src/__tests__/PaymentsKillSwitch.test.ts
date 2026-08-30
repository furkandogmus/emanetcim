import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Ödeme alımı acil durum anahtarı.
 *
 * NEDEN BU DOSYA VAR (2026-08-30): admin panelindeki özellik bayrakları ekranı
 * ALTI DİLDE "ortamda `PAYMENTS_ENABLED=false` ile bu ekrandan bağımsız anında
 * ödeme kapatması yapabilirsiniz" diyordu — ama `PAYMENTS_ENABLED` `src/` altında
 * HİÇ OKUNMUYORDU. Ne env şemasında vardı, ne bir kod yolunda. Yani bir olay
 * anında operatör değişkeni yazar, servisi yeniden başlatır ve ödeme akışı aynen
 * devam ederdi; üstelik "kapattım" sanarak. Var olmayan bir acil durum düğmesi,
 * hiç olmayandan tehlikelidir.
 *
 * Testler üç şeyi birden kilitliyor: anahtarın ÇALIŞTIĞINI, varsayılanların
 * güvenli tarafta olduğunu, ve kapsamın DAR kaldığını (check-in ile iade
 * kapanmaz — bunlar kapatılırsa misafir kapıda, para limbo'da kalır).
 */

const { mockIsEnabled } = vi.hoisted(() => ({ mockIsEnabled: vi.fn() }));

vi.mock("@/services/FeatureFlagService", () => ({
  featureFlagService: { isEnabled: mockIsEnabled },
}));
vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { paymentService, PAYMENTS_FLAG_KEY } from "@/services/PaymentService";

const ORIGINAL = process.env.PAYMENTS_ENABLED;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PAYMENTS_ENABLED;
  // Bayrak satiri yoksa `isEnabled` cagirana `defaultWhenMissing`i doner.
  mockIsEnabled.mockImplementation(
    async (_k: string, _c: unknown, opts?: { defaultWhenMissing?: boolean }) =>
      opts?.defaultWhenMissing ?? false,
  );
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PAYMENTS_ENABLED;
  else process.env.PAYMENTS_ENABLED = ORIGINAL;
});

describe("PAYMENTS_ENABLED — ortam anahtarı", () => {
  it('"false" ödemeyi kapatır', async () => {
    process.env.PAYMENTS_ENABLED = "false";
    await expect(paymentService.isAcceptingNewPayments()).resolves.toBe(false);
  });

  it("veritabanına HİÇ bakmadan kapatır", async () => {
    // Kapatma ihtiyaci doguran olay, tam da veritabanini yavaslatan olay
    // olabilir. Acil durum dugmesinin calismasi DB saglikligina bagli olmamali.
    process.env.PAYMENTS_ENABLED = "false";
    await paymentService.isAcceptingNewPayments();
    expect(mockIsEnabled).not.toHaveBeenCalled();
  });

  it("veritabanı bayrağı AÇIK olsa bile ortam KAZANIR", async () => {
    // Admin ekraninin alti dilde verdigi soz: "bu ekrandan bagimsiz".
    mockIsEnabled.mockResolvedValue(true);
    process.env.PAYMENTS_ENABLED = "false";
    await expect(paymentService.isAcceptingNewPayments()).resolves.toBe(false);
  });

  it("tanımsızken ödeme AÇIKTIR", async () => {
    await expect(paymentService.isAcceptingNewPayments()).resolves.toBe(true);
  });

  it('yalnızca tam olarak "false" kapatır — yazım hatası ödemeyi durdurmaz', async () => {
    // "0", "no", "İngilizce olmayan bir sey" ya da bosluk: hicbiri kapatmaz.
    // Kapatmak BILINCLI bir eylem olmali; bir yazim hatasinin sessizce ciro
    // durdurmasi, duzeltmeye calistigimiz belirsizligin ta kendisi olurdu.
    for (const v of ["FALSE", "0", "no", "off", "", "true"]) {
      process.env.PAYMENTS_ENABLED = v;
      await expect(paymentService.isAcceptingNewPayments()).resolves.toBe(true);
    }
  });

  it("boşluklu \" false \" da kapatır — env dosyaları boşluk taşır", async () => {
    process.env.PAYMENTS_ENABLED = "  false  ";
    await expect(paymentService.isAcceptingNewPayments()).resolves.toBe(false);
  });
});

describe("`payments` bayrağı — veritabanı anahtarı", () => {
  it("bayrak kapalıysa ödeme kapanır", async () => {
    mockIsEnabled.mockResolvedValue(false);
    await expect(paymentService.isAcceptingNewPayments()).resolves.toBe(false);
  });

  it("bayrak SATIRI YOKSA ödeme AÇIK sayılır", async () => {
    // `isEnabled`in kendi varsayilani `false` (yeni bir ozelligi acmak icin
    // dogru varsayilan). Burada TERSI gerekir: bugun `payments` satiri olmayan
    // bir kurulumda odeme alinabiliyor. Yokluk "kapat" demek olsaydi, BU
    // DEGISIKLIGIN KENDISI canlida odemeyi durdururdu.
    await expect(paymentService.isAcceptingNewPayments()).resolves.toBe(true);
    expect(mockIsEnabled).toHaveBeenCalledWith(
      PAYMENTS_FLAG_KEY,
      {},
      { defaultWhenMissing: true },
    );
  });

  it("rollout yüzdesi uygulanmaz — kullanıcı bağlamı boş geçilir", async () => {
    // Odeme kapatmasi ya HERKES icindir ya hic. Kullanicilarin %30'una odeme
    // acik birakmak, bir olay aninda anlasilmasi imkansiz bir durum uretirdi.
    await paymentService.isAcceptingNewPayments();
    expect(mockIsEnabled).toHaveBeenCalledWith(
      PAYMENTS_FLAG_KEY,
      {},
      expect.anything(),
    );
  });
});

describe("kapsam DAR kalır", () => {
  it("anahtar yalnızca yeni yükümlülük açmayı yönetir", async () => {
    // Bu test bir DAVRANISI degil, bir SOZLESMEYI koruyor: `PaymentService`
    // uzerinde odeme kapaliyken de calismasi gereken yollar duruyor mu?
    //
    // - `refund`: bir odeme olayinda iadeleri bloke etmek TAM TERS yondur.
    // - `markCaptured` / `openIntent`: `manual` saglayicida para dukkanda o an
    //   aliniyor ve check-in bunlari cagiriyor. Kapatilirsa elinde valizle
    //   bekleyen misafir kapida kalir.
    //
    // Biri gun gelip anahtari bu metotlarin icine tasirsa, bu test niyeti
    // hatirlatir.
    process.env.PAYMENTS_ENABLED = "false";

    expect(typeof paymentService.refund).toBe("function");
    expect(typeof paymentService.markCaptured).toBe("function");
    expect(typeof paymentService.openIntent).toBe("function");

    // Anahtarin kendisi yalnizca tek bir metotta okunuyor.
    const src = paymentService.isAcceptingNewPayments.toString();
    expect(src).toContain("PAYMENTS_ENABLED");
  });
});
