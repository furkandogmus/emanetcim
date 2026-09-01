import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "melbourne",
  posts: [
    {
      locale: "tr",
      slug: "melbourne-tramvay-bedava-bolge-flinders-valiz",
      title: "Melbourne'de Merkezdeki Tramvaylar Ücretsiz ama Bavul İçin Yer Yok",
      excerpt:
        "Şehir merkezinde tramvay bedava ve her yere gidiyor. Ama vagonlar dolu ve basamaklar dar.",
      cover: "melbourne-flinders",
      body: `
<p>Melbourne'ün merkezinde tramvaylar ücretsiz. Free Tram Zone denen bölge şehir merkezini ve Docklands'i kapsıyor; binip inmek için bilet gerekmiyor.</p>

<p>Bu, şehri gezmeyi çok kolaylaştırıyor. Ama vagonlar bu yüzden sürekli dolu ve kapı önünde durmak zor.</p>

{{img:melbourne-tramvay}}

<h2>Tramvay basamakları yüksek</h2>

<p>Eski tip tramvaylarda giriş basamağı yüksek ve koridor dar; bagaj için ayrılmış yer yok. Yeni araçlar alçak tabanlı ama onlar da yoğun saatte doluyor.</p>

<p>Bir valizle binmek, kapıyı kapatmak ve inecek yolcuları bekletmek anlamına geliyor.</p>

<h2>Flinders Street istasyonu şehrin düğümü</h2>

<p>Banliyö hatlarının neredeyse tamamı Flinders Street'ten geçiyor ve istasyonun önündeki basamaklar şehrin klasik buluşma noktası.</p>

{{img:melbourne-flinders}}

<p>Peronlara merdivenle iniliyor ve aktarmalar alt geçitlerden yapılıyor; yoğun saatte o geçitler tıklım tıklım oluyor.</p>

<h2>Queen Victoria pazarı koridorlarla dolu</h2>

<p>Merkezin kuzeyindeki Queen Victoria Market üstü kapalı sıralardan oluşuyor ve sabah saatlerinde en yoğun hâlinde. Tezgâh araları dar ve zemin ıslak.</p>

<p>Pazar merkeze yürüme mesafesinde ama bavulla o koridorlara girmek ilerlemeyi durduruyor.</p>

<h2>Ara sokaklar dar ve kafelerle dolu</h2>

<p>Melbourne'ün karakteri ara sokaklarında: Degraves, Centre Place ve Hosier Lane gibi geçitler iki metre genişliğinde ve masalarla, duvar resimleriyle dolu.</p>

<p>Bavulla o geçitlerden geçmek pratikte mümkün değil; zaten oturacak yer de bulamıyorsunuz.</p>

<h2>Hava gün içinde değişiyor</h2>

<p>Melbourne'de dört mevsimin bir günde yaşandığı söylenir ve bu abartı değil: sabah güneşli, öğlen yağmurlu, akşam rüzgârlı olabiliyor.</p>

<p>Bu, dışarıda geçirilecek saatleri planlamayı zorlaştırıyor — ve elinizde bavul varken sığınacak yer bulmak daha da zor.</p>

<h2>Havalimanı yirmi beş kilometre ve tren yok</h2>

<p>Melbourne Havalimanı merkeze yirmi beş kilometre ve şehre tren bağlantısı bulunmuyor; SkyBus ya da taksi kullanılıyor. Yol yarım saat ile bir saat arası.</p>

<p>Uzun mesafe uçuşları gece ve sabaha karşı; otel çıkışı ise on. Aradaki saatler şehirde geçiyor.</p>

<h2>Great Ocean Road tam gün</h2>

<p>Great Ocean Road turları sabah yedi sekizde kalkıyor ve akşam geç dönüyor; yol tek yönde üç saat. Minibüslerde bavul için yer yok.</p>

<h2>Southern Cross uzun mesafe garı</h2>

<p>Adelaide ve Sydney yönündeki trenler ile eyalet içi otobüsler Southern Cross'tan kalkıyor; havalimanı otobüsü de oradan. Flinders Street'e yürüyerek on beş dakika.</p>

<p>Yani şehirden ayrılış günü, merkez ile Southern Cross arasında bir yolculuk daha demek.</p>

<h2>St Kilda tramvayla yarım saat</h2>

<p>St Kilda sahili merkeze tramvayla yarım saat ve iskele boyunca yürünüyor. Plajda dolap yok ve iskelede bırakılacak yer bulunmuyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "melbourne-luggage-storage-free-tram-zone",
      title: "Melbourne's City Trams Are Free — But There's No Room for a Suitcase",
      excerpt:
        "The Free Tram Zone covers the centre and goes everywhere. Which is exactly why the carriages are always full.",
      cover: "melbourne-flinders",
      body: `
<p>Trams are free in central Melbourne. The Free Tram Zone covers the CBD and Docklands; you board and alight without a ticket.</p>

<p>That makes the city very easy to get around. It also means the carriages are permanently full and standing by the door is hard.</p>

{{img:melbourne-tramvay}}

<h2>The tram steps are high</h2>

<p>On the older trams the entrance step is high and the aisle narrow, with no space for luggage. The newer vehicles are low-floor, but they fill at peak too.</p>

<p>Boarding with a suitcase blocks the door and holds up the people getting off.</p>

<h2>Flinders Street is the city's knot</h2>

<p>Almost every suburban line runs through Flinders Street, and the steps outside are the city's classic meeting point.</p>

{{img:melbourne-flinders}}

<p>The platforms are reached by stairs and the interchanges run through subways, which pack out at peak hours.</p>

<h2>The laneways are narrow and full of cafés</h2>

<p>Melbourne's character is in its laneways: Degraves, Centre Place and Hosier Lane are two metres wide and filled with tables and murals.</p>

<p>Getting through them with a bag isn't realistic — and there's nowhere to sit anyway.</p>

<h2>The airport is twenty-five kilometres out with no train</h2>

<p>Melbourne airport is twenty-five kilometres from the centre and there's no rail link; you take the SkyBus or a taxi. Half an hour to an hour.</p>

<p>Long-haul flights leave at night and before dawn; checkout is at ten. The hours in between are spent in the city.</p>

<h2>The Great Ocean Road is a full day</h2>

<p>Great Ocean Road tours leave at seven or eight and get back late; it's three hours each way. The minibuses have no room for luggage.</p>

<h2>Southern Cross is the long-distance station</h2>

<p>Trains towards Adelaide and Sydney, the regional coaches and the airport bus all use Southern Cross — fifteen minutes on foot from Flinders Street.</p>

<p>So departure day includes one more trip, between the centre and Southern Cross.</p>

<h2>St Kilda is half an hour by tram</h2>

<p>St Kilda beach is half an hour from the centre by tram, with a walk along the pier. There are no lockers on the beach and nowhere to leave anything on the pier.</p>
`.trim(),
    },
  ],
};
