import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    // scripts/copy-maplibre-worker.mjs (predev/prebuild) node_modules'tan
    // kopyaladigi maplibre-gl worker paketleri -- minified, gitignored, ama
    // yerelde uretilince ESLint onlari da tarayip binlerce sahte uyari
    // basiyordu (coverage/** icin ayni gerekce, bkz. git geçmişi).
    "public/maplibre/**",
    /*
      `coverage/` de ayni sinif: `vitest --coverage` uretiyor, gitignored, ve
      istanbul'un kendi rapor sablonlari ESLint'e "kullanilmayan
      eslint-disable" uyarisi verdiriyordu. Yukaridaki yorum coverage'i zaten
      ayni gerekceyle anıyordu ama liste hic eklenmemisti (2026-09-12).
    */
    "coverage/**",
    /*
      FLUTTER DERLEME CIKTISI (2026-09-12'de bulundu).

      `mobile/` bir Flutter uygulamasi; `flutter build` calistiginda
      `mobile/build/` altina paketlerin kendi web varliklarini kopyaliyor ve
      iclerinde derlenmis `.js` dosyalari oluyor. ESLint bunlari TARIYORDU:
      `npm run lint` ciktisinin 10 uyarisindan 8'i tek bir upstream paketin
      (`flutter_local_notifications_web`) service worker'inda, ayni satirda,
      bes kez tekrarlanan ayni uyariydi.

      Bizim yazmadigimiz, gitignore edilmis, derlenmis kod uzerinde uyari
      biriktirmek lint ciktisini okunmaz yapar -- gercek bir uyari o
      gurultunun icinde kaybolur. Dart tarafinin kendi analizcisi var
      (`dart analyze`, bkz. mobile/CLAUDE.md); ESLint'in orada isi yok.
    */
    "mobile/**",
  ]),
  {
    /**
     * HTML özniteliklerinde KIVRIK TIRNAK yasak.
     *
     * `ShopService.approveShop`'un onay e-postası `style=”...”` yazıyordu (düz " yerine
     * kıvrık "). Sonuç: hiçbir `style`/`href` özniteliği geçerli değildi — e-posta
     * stilsiz gidiyor ve "Partner Panelime Git" butonu hiçbir yere bağlanmıyordu.
     * Kod derleniyor, test geçiyor, tip kontrolü temiz; hata yalnızca gelen kutusunda
     * görünüyor. O yüzden lint'e taşındı (2026-08-22, P1-3).
     *
     * Türkçe METİN içindeki tırnaklar serbest — kural yalnızca `=` ile başlayan
     * öznitelik yazımını hedefler.
     */
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      /*
       * `_` önekli argüman = BİLEREK okunmuyor.
       *
       * Kuralın kendisi açık kalmalı (ölü değişken gerçek bir sinyaldir), ama
       * "bu parametre imza gereği duruyor" demenin bir yolu olmalıydı; yoksa
       * tek çare her seferinde satır bazında `eslint-disable` yazmak oluyor ve
       * o yorum gerçek uyarıları da susturur. Örnek: `sendNetgsmRestSms`
       * SMS entegrasyonu kapalıyken imzasını koruyor.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "TemplateElement[value.raw=/=[\u201C\u201D\u2018\u2019]/]",
          message:
            "HTML özniteliğinde kıvrık tırnak var (=\u201D). Düz tırnak (\") kullanın; aksi halde öznitelik geçersiz olur.",
        },
        {
          selector: "Literal[value=/=[\u201C\u201D\u2018\u2019]/]",
          message:
            "HTML özniteliğinde kıvrık tırnak var (=\u201D). Düz tırnak (\") kullanın; aksi halde öznitelik geçersiz olur.",
        },
      ],
    },
  },
]);

export default eslintConfig;
