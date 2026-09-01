import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "tunus",
  posts: [
    {
      locale: "tr",
      slug: "tunus-medina-kartaca-tgm-valiz",
      title: "Tunus'ta Medina Dar, Kartaca Uzak, Feribot Akşam",
      excerpt:
        "Sidi Bou Said treni bir saat, feribot akşam kalkıyor, medina sokakları bir metre. Tunus'ta günün planı bavulun nerede olduğuna bağlı.",
      cover: "tunus-medina",
      body: `
<p>Tunus şehrinde iki farklı doku üst üste duruyor: Habib Burgiba Bulvarı çevresindeki geniş caddeli yeni şehir ve onun hemen batısındaki medina. İkisi arasında bir kapı var — Bab Bhar — ve karşıya geçer geçmez sokak genişliği bir anda düşüyor.</p>

{{img:tunus-bourguiba}}

<h2>Medina sokakları bir bavula göre değil</h2>

<p>Tunus medinası UNESCO listesinde ve içinde yedi yüzden fazla anıt sayılıyor. Ama gezerken hissedilen şey bu değil: sokaklar dar, üstü yer yer kapalı, iki yanı dükkân. Zeytuna Camii çevresindeki çarşılar günün her saati kalabalık.</p>

{{img:tunus-medina}}

<p>Bu sokaklarda tekerlekli valizle ilerlemek yavaş ve çevredekiler için de rahatsız edici. Medinanın içi ayrıca düz değil; bazı bölümler basamaklı.</p>

<h2>Kartaca ve Sidi Bou Said bir saat uzakta</h2>

<p>TGM adıyla bilinen banliyö hattı Tunis Marine'den kalkıp Kartaca ve Sidi Bou Said üzerinden La Marsa'ya gidiyor. Sidi Bou Said'e yaklaşık kırk dakika.</p>

<p>Kartaca kalıntıları birkaç ayrı istasyona dağılmış durumda — Kartaca Hannibal, Kartaca Salammbô gibi — ve hepsini görmek yürüyerek dolaşmayı gerektiriyor. Sidi Bou Said ise tepeye kurulu ve baştan sona basamaklı bir kasaba.</p>

<p>Bu iki durak yarım günü rahat götürüyor. Bavulla yapılacak bir gezi değil.</p>

<h2>Bardo Müzesi merkezin dışında</h2>

<p>Roma mozaikleriyle ünlü Bardo Müzesi şehir merkezine birkaç kilometre ve metro hattıyla gidiliyor. Müzeyi gezmek iki saat sürüyor ve girişte büyük çanta kabul edilmiyor.</p>

<h2>Feribotlar La Goulette'ten ve akşam kalkıyor</h2>

<p>Marsilya, Cenova ve Palermo hatları La Goulette limanından kalkıyor. Kalkışlar genelde akşamüstü ve varış ertesi gün; yani gemi bir gece konaklaması yerine geçiyor.</p>

<p>La Goulette merkeze on kilometre kadar. Otel çıkışı öğlen, geminin kalkışı akşam olunca aradaki yarım gün açıkta kalıyor.</p>

<h2>Havalimanı sekiz kilometre</h2>

<p>Tunus-Kartaca Havalimanı merkeze sekiz kilometre ve taksiyle yirmi dakika. Yakın olması "erkenden gideyim" demeyi kolaylaştırıyor ama terminalde beklemek de şehirde geçirilebilecek saatleri harcamak oluyor.</p>

<h2>Metro hafif raylı, vagonlar dar</h2>

<p>Şehir içi ulaşımın omurgası Métro léger denen hafif raylı sistem. İstasyonlar merkeze yakın ve seferler sık, ama vagonlar özellikle mesai saatlerinde doluyor ve kapı önü dar.</p>

<p>Bavulla binmek mümkün ama rahat değil; taksi alternatifi de trafiğe takılıyor.</p>

<h2>Sıcak öğle saatleri</h2>

<p>Tunus yaz aylarında öğlen otuz beş dereceyi buluyor ve medinanın kapalı bölümleri dışında gölge sınırlı. Bulvarda ağaç var ama yan sokaklarda yok.</p>

<p>Bavulunuz merkezde bir yerde durduğunda medina, TGM hattı ve akşam feribotu aynı güne rahatça sığıyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "tunis-luggage-storage-medina-carthage",
      title: "Tunis: A Tight Medina, Carthage Out of Town, and an Evening Ferry",
      excerpt:
        "Sidi Bou Said is an hour out, the ferry sails at dusk, the medina lanes are a metre wide. The day depends on where the bag is.",
      cover: "tunus-medina",
      body: `
<p>Two different city fabrics sit side by side in Tunis: the wide-avenued new town around Avenue Habib Bourguiba, and the medina immediately west of it. A single gate separates them — Bab Bhar — and the moment you pass through, the street width collapses.</p>

{{img:tunus-bourguiba}}

<h2>The medina lanes weren't built for a suitcase</h2>

<p>The Tunis medina is on the UNESCO list and holds more than seven hundred listed monuments. That isn't what you feel walking it, though: the lanes are narrow, roofed over in places, and lined with shops. The souks around the Zitouna Mosque are busy at any hour.</p>

{{img:tunus-medina}}

<p>Moving through them with a wheeled case is slow and awkward for everyone around you. The medina isn't flat either — parts of it are stepped.</p>

<h2>Carthage and Sidi Bou Said are an hour away</h2>

<p>The suburban line known as the TGM runs from Tunis Marine through Carthage and Sidi Bou Said to La Marsa. Sidi Bou Said is about forty minutes out.</p>

<p>The Carthage ruins are spread across several separate stations — Carthage Hannibal, Carthage Salammbô and others — and seeing them means walking between sites. Sidi Bou Said is built on a hill and stepped from end to end.</p>

<p>Those two stops comfortably fill half a day. It is not an outing to do with luggage.</p>

<h2>The Bardo Museum is outside the centre</h2>

<p>The Bardo, famous for its Roman mosaics, is a few kilometres from the centre and reached by the light rail. Getting round it takes two hours, and large bags aren't admitted at the entrance.</p>

<h2>The ferries leave from La Goulette, in the evening</h2>

<p>The Marseille, Genoa and Palermo routes sail from La Goulette. Departures are generally late afternoon with arrival the next day, so the crossing doubles as a night's accommodation.</p>

<p>La Goulette is about ten kilometres from the centre. With checkout at noon and the ship leaving in the evening, half a day is left uncovered.</p>

<h2>The airport is eight kilometres out</h2>

<p>Tunis-Carthage airport is eight kilometres from the centre, twenty minutes by taxi. Being close makes "I'll just go early" tempting — but waiting in the terminal spends hours you could have spent in the city.</p>

<p>With the bag parked somewhere central, the medina, the TGM line and the evening ferry all fit comfortably into one day.</p>
`.trim(),
    },
  ],
};
