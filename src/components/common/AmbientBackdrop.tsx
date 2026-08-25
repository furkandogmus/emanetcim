/**
 * Sayfa zeminindeki dekoratif ışık halkaları ve nokta dokusu.
 *
 * NEDEN BİLEŞEN (2026-08-25'te ölçüldü): aynı beş satır **8 dosyada 10 kez**
 * kelimesi kelimesine tekrarlanıyordu (giriş, kayıt, şifre sıfırlama, e-posta
 * doğrulama, rezervasyon sorgulama, ana sayfa). Markanın turuncusunu değiştirmek
 * ya da dokuyu kaldırmak on ayrı yerde aynı düzenlemeyi yapmak demekti; kopyalar
 * arasında bir tanesi geride kalırsa fark yalnızca o sayfada görünürdü.
 *
 * `pointer-events-none`: dekoratif katman tıklamayı yutmamalı. Kopyalarda bu
 * sınıfın unutulması, altındaki formu tıklanamaz yapardı — bileşen bunu garanti eder.
 */
export default function AmbientBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(21_95%_60%/.22),transparent)] blur-2xl" />
      <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,hsl(38_92%_55%/.18),transparent)] blur-2xl" />
      <div className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:20px_20px]" />
    </div>
  );
}
