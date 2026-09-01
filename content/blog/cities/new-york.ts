import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "new-york",
  posts: [
    {
      locale: "tr",
      slug: "new-york-metro-turnike-valiz-gecmiyor",
      title: "New York Metrosunda Valiz Turnikeden Geçmiyor",
      excerpt:
        "Standart turnikeler bel hizasında dönen kollardan oluşuyor. Büyük bir bavulla oradan geçmek mümkün değil.",
      cover: "ny-grand-central",
      body: `
<p>New York metrosu şehri gezmenin en hızlı yolu ama bir valizle kullandığınızda ilk engel girişte çıkıyor: standart turnikeler bel hizasında dönen üç kollu tiptedir ve arasından ancak bir insan geçer.</p>

<p>Büyük bir bavulla oradan geçmek fiziksel olarak mümkün değil. Yanda daha geniş bir servis kapısı bulunuyor ama her istasyonda görevli olmuyor ve kapı her zaman açık değil.</p>

<h2>İstasyonların çoğunda asansör yok</h2>

<p>Metro istasyonlarının önemli bir bölümüne yalnızca merdivenle iniliyor. Aktarma noktalarında iki üç kat inip çıkmak gerekiyor ve merdivenler dar.</p>

<p>Yani şehirde bavulla dolaşmak pratikte taksi ya da uygulama üzerinden araç demek — ve Manhattan trafiğinde o araç metrodan yavaş.</p>

{{img:ny-grand-central}}

<h2>Penn Station ile Grand Central farklı hatlar</h2>

<p>İki büyük gar var ve aynı işi yapmıyorlar. Amtrak, New Jersey ve Long Island trenleri Penn Station'dan; Metro-North hattı ise Grand Central'dan kalkıyor.</p>

<p>İkisi arası yaklaşık bir kilometre ve yürüyerek on beş dakika. Biletinizde hangisinin yazdığına bakmamak burada tren kaçırmakla sonuçlanıyor.</p>

<h2>Müzelerde vestiyerin boyut sınırı var</h2>

<p>Metropolitan, MoMA ve diğer büyük müzeler vestiyer sunuyor ama boyut sınırı uyguluyor; valiz kabul edilmiyor. Girişte ayrıca çanta kontrolü var.</p>

<p>Yani bir müze günü planlayan biri için bavul kapıda çözülmesi gereken bir mesele.</p>

<h2>Otel çıkışı on birde, giriş on beşte</h2>

<p>New York otellerinde çıkış genelde on bir, giriş on beş ya da on altı. Sabah şehre inen ya da akşam uçuşu olan biri için bu dört beş saatlik bir boşluk demek.</p>

{{img:ny-times-square}}

<h2>Central Park dört kilometre uzunluğunda</h2>

<p>Central Park güneyden kuzeye dört kilometre ve genişliği sekiz yüz metre. Bir uçtan diğerine yürümek bir saatten fazla sürüyor.</p>

<p>Park içinde bank çok ama bavul bırakılacak yer yok; parkın içinden geçip diğer taraftaki müzeye gitmek isteyen biri bavulu taşımak zorunda.</p>

<h2>Üç havalimanı, üçü de uzak</h2>

<p>JFK Manhattan'a yaklaşık yirmi beş kilometre, LaGuardia daha yakın ama toplu taşıma bağlantısı zayıf, Newark ise başka bir eyalette. Hiçbirine "bir uğrayıp döneyim" mesafesinde değilsiniz.</p>

<h2>Broadway ve gösteri saatleri</h2>

<p>Broadway gösterileri akşam sekizde başlıyor; matine günleri iki. Salonlarda vestiyer var ama küçük ve valiz kabul edilmiyor; koltuk altında da yer yok.</p>

<p>Yani son akşamı gösteriye ayıran biri için bavul çözülmesi gereken bir konu.</p>

<h2>Yürünecek şehir</h2>

<p>Manhattan ızgara planlı ve blok blok yürünüyor: SoHo, Central Park, Lower Manhattan hep yaya keşfi. Brooklyn Köprüsü'nden DUMBO'ya yürüyüş de öyle.</p>

<p>Bavulunuz bir yerde durduğunda bu yürüyüşlerin hepsi aynı güne sığıyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "new-york-luggage-storage-subway-turnstile",
      title: "A Suitcase Doesn't Fit Through a New York Subway Turnstile",
      excerpt:
        "The standard gates are waist-high revolving arms. A large bag physically will not go through.",
      cover: "ny-grand-central",
      body: `
<p>The subway is the fastest way to see New York, but with a suitcase the first obstacle is at the entrance: the standard turnstiles are waist-high three-arm gates, wide enough for one person and nothing else.</p>

<p>A large case physically cannot go through. There's a wider service gate alongside, but not every station is staffed and the gate isn't always open.</p>

<h2>Most stations have no lift</h2>

<p>A large share of subway stations are reached by stairs only. At interchanges you go down and up two or three flights, and the staircases are narrow.</p>

<p>So getting around with a bag really means a taxi or a ride-hailing car — and in Manhattan traffic that's slower than the subway.</p>

{{img:ny-grand-central}}

<h2>Penn Station and Grand Central are different railroads</h2>

<p>There are two great stations and they don't do the same job. Amtrak, New Jersey and Long Island trains use Penn Station; the Metro-North lines run from Grand Central.</p>

<p>They're about a kilometre apart, fifteen minutes on foot. Not checking which one is on your ticket ends in a missed train here.</p>

<h2>Museum cloakrooms have a size limit</h2>

<p>The Met, MoMA and the other large museums have cloakrooms, but with size limits — suitcases aren't accepted. There's a bag check at the entrance too.</p>

<p>So for anyone planning a museum day, the luggage is a problem to be solved before the door.</p>

<h2>Checkout at eleven, check-in at three</h2>

<p>New York hotels generally check out at eleven and in at three or four. For anyone arriving in the morning or flying out in the evening, that's a four- or five-hour gap.</p>

{{img:ny-times-square}}

<h2>Three airports, all of them far</h2>

<p>JFK is about twenty-five kilometres from Manhattan, LaGuardia is closer but poorly served by transit, and Newark is in another state. None of them is within "pop over and come back" range.</p>

<h2>A walking city</h2>

<p>Manhattan is a grid and it's walked block by block: SoHo, Central Park, Lower Manhattan are all discovered on foot. So is the walk over the Brooklyn Bridge into DUMBO.</p>

<p>With the bag left somewhere, all of that fits into a single day.</p>
`.trim(),
    },
  ],
};
