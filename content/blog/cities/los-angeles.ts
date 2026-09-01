import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "los-angeles",
  posts: [
    {
      locale: "tr",
      slug: "los-angeles-hollywood-santa-monica-arasi-valiz",
      title: "Los Angeles'ta Hollywood ile Santa Monica Arası Bir Saat",
      excerpt:
        "Şehir yürünecek ölçekte değil. Her hedef bir araç yolculuğu ve bavul o yolculukların hepsine biniyor.",
      cover: "la-downtown",
      body: `
<p>Los Angeles bir merkez etrafında kurulmamış; birbirinden uzak bölgelerin toplamı. Hollywood, Santa Monica, Venice, Downtown — hepsi ayrı yerler ve aralarında kilometreler var.</p>

<p>Hollywood ile Santa Monica arası yirmi beş kilometre kadar; trafiğe göre bir saat sürebiliyor. Downtown ile Venice arası da benzer.</p>

{{img:la-downtown}}

<h2>Bu, günün araçta geçmesi demek</h2>

<p>Bir günde iki üç bölge görmek isteyen biri toplamda iki saatten fazlasını yolda geçiriyor. Bavul da o yolculukların her birinde bagajda inip biniyor.</p>

<p>Metro var ama ağ sınırlı: Hollywood ve Downtown bağlı, Santa Monica'ya hat uzatıldı, ama pek çok nokta hâlâ kapsam dışında.</p>

<h2>LAX şehirden uzak ve çevresi boş</h2>

<p>LAX Santa Monica'ya on beş, Hollywood'a otuz kilometre. Terminaller at nalı şeklinde dizilmiş ve aralarında yürüyerek geçilebiliyor ama çevrede gezilecek bir şey yok.</p>

<p>Uçuşların çoğu akşam ve gece; otel çıkışı ise on bir ya da on iki. Aradaki saatleri havalimanında geçirmek, LA'de geçirilecek son günü harcamak oluyor.</p>

<h2>Santa Monica ve Venice yürüyerek</h2>

<p>Santa Monica iskelesi ile Venice sahili arasındaki yürüyüş yolu üç kilometre kadar ve deniz kenarından gidiyor. Şehirdeki en rahat yürüyüşlerden biri.</p>

{{img:la-santa-monica}}

<p>Ama kum ve tahta iskele bavul için uygun bir zemin değil; iskeledeki dükkânlar da emanet sunmuyor.</p>

<h2>Griffith Gözlemevi'ne yokuş</h2>

<p>Griffith Gözlemevi tepede ve otoparkı sınırlı; pek çok kişi aşağıdan yürüyerek çıkıyor. Patika toprak ve eğimli.</p>

<p>Bavulla bu çıkışı yapmak mümkün değil, otoparkta bırakacak yer de yok.</p>

<h2>Getty ve müzeler tepede</h2>

<p>Getty Center bir tepenin üstünde ve otoparktan müzeye küçük bir tramvayla çıkılıyor. Giriş ücretsiz ama otopark ücretli ve tramvay kabinleri küçük.</p>

<p>Girişte çanta kontrolü var ve büyük bagaj kabul edilmiyor.</p>

<h2>Stüdyo turları yarım gün</h2>

<p>Warner Bros. ve Universal turları belirli saatlerde başlıyor ve iki üç saat sürüyor. Girişte güvenlik kontrolü var ve büyük çanta kabul edilmiyor.</p>

<h2>Uygulama üzerinden araç günün maliyeti</h2>

<p>LA'de gezinin büyük kısmı uygulama üzerinden çağrılan araçlarla yapılıyor. Her yolculuk on beş dakikayla bir saat arasında ve fiyat trafiğe göre değişiyor.</p>

<p>Bavulunuz varken araç boyutu da bir mesele oluyor: iki valizle küçük araç geldiğinde yeniden çağırmak gerekiyor.</p>

<h2>Union Station Downtown'da</h2>

<p>Amtrak ve banliyö trenleri Downtown'daki Union Station'a geliyor. San Diego'ya tren üç saat, Santa Barbara'ya iki buçuk.</p>

<p>Gar merkezde ama LA'de "merkez" demek diğer bölgelere hâlâ yarım saat demek.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "los-angeles-luggage-storage-distances",
      title: "Hollywood to Santa Monica Is an Hour in Los Angeles",
      excerpt:
        "The city isn't built at walking scale. Every destination is a drive, and the bag rides along on all of them.",
      cover: "la-downtown",
      body: `
<p>Los Angeles isn't built around a centre; it's a sum of districts far apart. Hollywood, Santa Monica, Venice, Downtown — all separate places with kilometres between them.</p>

<p>Hollywood to Santa Monica is about twenty-five kilometres, and up to an hour depending on traffic. Downtown to Venice is much the same.</p>

{{img:la-downtown}}

<h2>Which means the day is spent in a vehicle</h2>

<p>Anyone hoping to see two or three districts in a day spends more than two hours on the road. And the bag goes in and out of the boot on every one of those trips.</p>

<p>There is a metro, but the network is limited: Hollywood and Downtown are connected and the line now reaches Santa Monica, yet plenty of places are still off it.</p>

<h2>LAX is far out with nothing around it</h2>

<p>LAX is fifteen kilometres from Santa Monica and thirty from Hollywood. The terminals sit in a horseshoe you can walk between, but there's nothing to see nearby.</p>

<p>Most flights are in the evening or at night; checkout is at eleven or twelve. Spending those hours at the airport writes off your last day in LA.</p>

<h2>Santa Monica and Venice are walked</h2>

<p>The path between Santa Monica pier and Venice beach runs about three kilometres along the water. It's one of the easiest walks in the city.</p>

{{img:la-santa-monica}}

<p>But sand and boardwalk are no surface for a case, and the shops on the pier don't offer storage.</p>

<h2>Griffith Observatory is uphill</h2>

<p>The Griffith Observatory sits on a hill with limited parking, and many people walk up from below. The path is dirt and steep.</p>

<p>You can't make that climb with a suitcase, and there's nowhere in the car park to leave one.</p>

<h2>The studio tours are half a day</h2>

<p>Warner Bros. and Universal tours start at set times and run two or three hours. There's security at the entrance and large bags aren't admitted.</p>

<h2>Union Station is downtown</h2>

<p>Amtrak and the commuter trains arrive at Union Station downtown. San Diego is three hours by rail, Santa Barbara two and a half.</p>

<p>The station is central — but in LA, central still means half an hour from everywhere else.</p>
`.trim(),
    },
  ],
};
