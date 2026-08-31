/**
 * Süreci anlatan animasyon — "video" yerine tek dosyalık SVG.
 *
 * NEDEN GERÇEK BİR VİDEO DEĞİL: çekilmiş bir video, barındırma (birkaç MB),
 * bir oynatıcı, altyazı ve altı dile ses/metin demek — ve hepsinden önce
 * çekilmiş görüntü demek; elimizde yok, uydurulmuş bir stok video da anlatmak
 * istediğimiz şeyi anlatmaz. Bu SVG aynı işi yapıyor: dört adımı sırayla
 * gösteriyor, ~9 KB, harici istek yok, çevrimdışı çalışıyor ve metni
 * yerelleştirilebilir (etiketler prop ile geliyor).
 *
 * ERİŞİLEBİLİRLİK: `prefers-reduced-motion` açıksa animasyon durur ve dört
 * adım aynı anda görünür — hareket rahatsızlık veren bir kullanıcı için
 * "bekle, sırası gelsin" bir engeldir. Ayrıca `role="img"` + `aria-label`:
 * ekran okuyucu için altındaki adım listesi zaten metin olarak var, bu görsel
 * ona ek bir şey söylemiyor.
 */
export default function HowItWorksAnimation({
  labels,
  ariaLabel,
}: {
  /** Dört adımın kısa etiketi, sırayla. */
  labels: [string, string, string, string];
  ariaLabel: string;
}) {
  const stations = [90, 290, 490, 690];

  return (
    <div className="w-full overflow-x-auto">
      <style
        // Anahtar kareler bileşenle birlikte yaşasın: globals.css'e yazmak,
        // yalnızca bu görselin kullandığı bir kuralı herkesin dosyasına koymak
        // olurdu ve orada kimse neden durduğunu bilemezdi.
        dangerouslySetInnerHTML={{
          __html: `
@keyframes hiwTravel {
  0%,   8%  { transform: translateX(0); }
  22%,  33% { transform: translateX(200px); }
  47%,  58% { transform: translateX(400px); }
  72%, 100% { transform: translateX(600px); }
}
@keyframes hiwTravelY {
  0%,   8%  { transform: translateY(0); }
  22%,  33% { transform: translateY(110px); }
  47%,  58% { transform: translateY(220px); }
  72%, 100% { transform: translateY(330px); }
}
@keyframes hiwSeal {
  0%,  44% { opacity: 0; transform: scale(0.4); }
  52%, 100% { opacity: 1; transform: scale(1); }
}
@keyframes hiwGlow {
  0%,   8%  { opacity: 1; }
  9%,  100% { opacity: 0; }
}
.hiw-bag  { animation: hiwTravel 9s ease-in-out infinite; }
.hiw-bag-y{ animation: hiwTravelY 9s ease-in-out infinite; }
.hiw-seal { animation: hiwSeal 9s ease-in-out infinite; transform-origin: center; }
.hiw-s0   { animation: hiwGlow 9s ease-in-out infinite; }
.hiw-s1   { animation: hiwGlow 9s ease-in-out infinite -2.1s; }
.hiw-s2   { animation: hiwGlow 9s ease-in-out infinite -4.3s; }
.hiw-s3   { animation: hiwGlow 9s ease-in-out infinite -6.5s; }
@media (prefers-reduced-motion: reduce) {
  .hiw-bag, .hiw-bag-y, .hiw-seal, .hiw-s0, .hiw-s1, .hiw-s2, .hiw-s3 { animation: none; }
  .hiw-bag  { transform: translateX(600px); }
  .hiw-bag-y{ transform: translateY(330px); }
  .hiw-seal { opacity: 1; transform: none; }
  .hiw-s0, .hiw-s1, .hiw-s2, .hiw-s3 { opacity: 1; }
}
`,
        }}
      />
      <svg
        viewBox="0 0 780 190"
        role="img"
        aria-label={ariaLabel}
        className="hidden md:block min-w-[680px] w-full"
      >
        {/* Yol */}
        <line
          x1="90"
          y1="70"
          x2="690"
          y2="70"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="2"
          strokeDasharray="6 8"
        />

        {stations.map((x, i) => (
          <g key={x}>
            <circle
              className={`hiw-s${i}`}
              cx={x}
              cy="70"
              r="26"
              fill="var(--id-accent, #e2620f)"
              fillOpacity="0.14"
            />
            <circle
              cx={x}
              cy="70"
              r="15"
              fill="white"
              stroke="var(--id-accent, #e2620f)"
              strokeWidth="2"
            />
            <text
              x={x}
              y="76"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="var(--id-accent, #e2620f)"
            >
              {i + 1}
            </text>
            <text
              x={x}
              y="128"
              textAnchor="middle"
              fontSize="13"
              fill="currentColor"
              fillOpacity="0.75"
            >
              {labels[i]}
            </text>
          </g>
        ))}

        {/* Valiz: yol boyunca duraktan durağa ilerler */}
        <g className="hiw-bag">
          <g transform="translate(90 24)">
            <rect
              x="-15"
              y="-2"
              width="30"
              height="24"
              rx="5"
              fill="var(--id-accent, #e2620f)"
            />
            <rect x="-5" y="-9" width="10" height="8" rx="2" fill="var(--id-accent, #e2620f)" />
            <rect x="-15" y="7" width="30" height="3" fill="white" fillOpacity="0.5" />
            {/* Mühür 3. adımda takılır */}
            <circle className="hiw-seal" cx="14" cy="18" r="7" fill="#0f766e" />
            <path
              className="hiw-seal"
              d="M11 18l2 2 4-4"
              stroke="white"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </svg>

      {/*
        DIKEY VARYANT — telefon icin.

        Yatay serit 680 pikselin altina inemiyor (dort istasyonun etiketi
        okunakli kalsin diye) ve 360 px'lik bir ekranda yatay kaydirma seridine
        donusuyordu: ilk istasyon gorunuyor, canta animasyonun ortasinda ekranin
        disina cikiyor, kimse yana kaydirmayi denemiyor. Bir sure gizlemeyi
        denedim; ama o zaman telefon kullanicisi sureci anlatan gorselden
        TAMAMEN mahrum kaliyor. Dogru cevap gizlemek degil, dar ekranin kendi
        yonunu kullanmak: ayni dort adim, asagi akan canta.

        Ayni etiketler, ayni zamanlama, ayni `prefers-reduced-motion` davranisi.
        Etiketler burada sola dayali ve 190 px genislige sahip -- yatay
        varyantta ortalanmis 150 px'e sigmak zorundaydilar.
      */}
      <svg
        viewBox="0 0 300 430"
        role="img"
        aria-label={ariaLabel}
        className="mx-auto block w-full max-w-[320px] md:hidden"
      >
        <line
          x1="30"
          y1="50"
          x2="30"
          y2="390"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="2"
          strokeDasharray="6 8"
        />

        {[50, 160, 270, 380].map((y, i) => (
          <g key={y}>
            <circle
              className={`hiw-s${i}`}
              cx="30"
              cy={y}
              r="26"
              fill="var(--id-accent, #e2620f)"
              fillOpacity="0.14"
            />
            <circle
              cx="30"
              cy={y}
              r="15"
              fill="white"
              stroke="var(--id-accent, #e2620f)"
              strokeWidth="2"
            />
            <text
              x="30"
              y={y + 6}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="var(--id-accent, #e2620f)"
            >
              {i + 1}
            </text>
            <text
              x="100"
              y={y + 5}
              fontSize="14"
              fill="currentColor"
              fillOpacity="0.75"
            >
              {labels[i]}
            </text>
          </g>
        ))}

        <g className="hiw-bag-y">
          <g transform="translate(64 50)">
            <rect
              x="-15"
              y="-2"
              width="30"
              height="24"
              rx="5"
              fill="var(--id-accent, #e2620f)"
            />
            <rect x="-5" y="-9" width="10" height="8" rx="2" fill="var(--id-accent, #e2620f)" />
            <rect x="-15" y="7" width="30" height="3" fill="white" fillOpacity="0.5" />
            <circle className="hiw-seal" cx="14" cy="18" r="7" fill="#0f766e" />
            <path
              className="hiw-seal"
              d="M11 18l2 2 4-4"
              stroke="white"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
