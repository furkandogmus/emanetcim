import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "new-orleans",
  posts: [
    {
      locale: "tr",
      slug: "new-orleans-fransiz-mahallesi-tramvay-valiz",
      title: "New Orleans'ta Tarihi Tramvayın Basamakları Dik ve Dar",
      excerpt:
        "St. Charles hattının vagonları yüz yıllık; içeride bagaj yeri yok, basamaklar yüksek. Fransız Mahallesi'nin kaldırımları da düzensiz.",
      cover: "new-orleans-fransiz-mahallesi",
      body: `
<p>New Orleans'ın merkezi Fransız Mahallesi ve alan kompakt: on üçe altı bloktan oluşan bir ızgara. Her yer yürüme mesafesinde.</p>

<p>Ama zemin öyle değil. Kaldırımlar eski taş ve tuğla döşeli, ağaç kökleriyle kabarmış ve yer yer çökmüş. Demir balkonlar kaldırıma sarkıyor, direkler geçidi daraltıyor.</p>

{{img:new-orleans-fransiz-mahallesi}}

<h2>Tekerlekli valiz bu zeminde ilerlemiyor</h2>

<p>Bu kaldırımlarda bavul çekmek hem gürültülü hem yavaş. Yağmurdan sonra su birikintileri de kalıyor; şehir deniz seviyesinin altında ve drenaj yavaş.</p>

<h2>Tarihi tramvay bagaj almıyor</h2>

<p>St. Charles hattındaki yeşil vagonlar yüz yılı aşkın süredir çalışıyor ve orijinal hallerini koruyor. Ahşap sıralar, dar koridor, yüksek giriş basamakları.</p>

<p>Vagonlarda bagaj için ayrılmış hiçbir yer yok ve basamaklar dik. Bir valizle binmek hem zor hem de kapıyı kapatmak anlamına geliyor.</p>

<h2>French Market ve nehir kıyısı</h2>

<p>Fransız Mahallesi'nin doğu ucundaki French Market üstü kapalı bir çarşı ve tezgâhlar arası dar. Hemen arkasındaki Moonwalk ise Mississippi kıyısı boyunca uzanan yürüyüş yolu.</p>

<p>Nehir kıyısı düz ve rahat — şehirdeki en kolay yürüyüş. Ama oraya varmak için mahallenin bozuk kaldırımlarından geçmek gerekiyor.</p>

<h2>Bourbon Sokağı akşam kapanıyor</h2>

<p>Bourbon Sokağı akşamüstü trafiğe kapanıyor ve kalabalık yola yayılıyor. Mekânların kapıları açık, müzik sokağa taşıyor.</p>

{{img:new-orleans-bourbon}}

<p>Bu kalabalığın içinde bavulla ilerlemek neredeyse durmak demek.</p>

<h2>Garden District ve mezarlıklar tramvay hattında</h2>

<p>Garden District'in konakları ve tarihi mezarlıkları St. Charles tramvay hattı boyunca uzanıyor. Merkezden yirmi dakika ve inip yürüyerek geziliyor.</p>

<p>Mezarlıklara giriş bazı yerlerde rehberli ve saatli; girişte çanta kontrolü de var.</p>

<h2>Havalimanı yirmi kilometre batıda</h2>

<p>Louis Armstrong Havalimanı merkeze yirmi kilometre ve araçla yarım saat. Otobüs bağlantısı var ama seyrek; çoğu kişi taksi ya da uygulama kullanıyor.</p>

<h2>Festival dönemlerinde şehir doluyor</h2>

<p>Mardi Gras ve Jazz Fest dönemlerinde oteller aylar öncesinden doluyor ve fiyatlar katlanıyor. Pek çok kişi civarda kalıp şehre günübirlik geliyor.</p>

<p>Geçit törenleri sırasında da caddeler kapanıyor ve araçla ulaşım kesiliyor; her şey yürüyerek yapılıyor.</p>

<h2>Jackson Square ve katedral</h2>

<p>Fransız Mahallesi'nin kalbi Jackson Square; çevresinde St. Louis Katedrali, ressamlar ve at arabaları var. Meydan taş döşeli ve etrafı demir parmaklıklı.</p>

<p>Katedrale girişte çanta kontrolü var ve büyük bagaj kabul edilmiyor.</p>

<h2>Yaz nemli, öğleden sonra sağanaklı</h2>

<p>New Orleans yazı nemli ve ağır; öğleden sonra sağanakları ani ve şiddetli. Gölge dar sokaklarda ve balkonların altında var, meydanlarda yok.</p>

<p>Bavulla o havada dolaşmak, günü yarıya indiriyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "new-orleans-luggage-storage-streetcar",
      title: "The Historic Streetcar in New Orleans Has Steep, Narrow Steps",
      excerpt:
        "The St. Charles cars are a century old: no luggage space, high steps. The French Quarter pavements are uneven too.",
      cover: "new-orleans-fransiz-mahallesi",
      body: `
<p>New Orleans centres on the French Quarter, and the area is compact: a grid thirteen blocks by six. Everything is within walking distance.</p>

<p>The ground isn't so simple. The pavements are old stone and brick, lifted by tree roots and sunken in places. Iron balconies overhang them and posts narrow the way.</p>

{{img:new-orleans-fransiz-mahallesi}}

<h2>A wheeled case doesn't run on that surface</h2>

<p>Pulling a bag over those pavements is loud and slow. Puddles linger after rain, too; the city sits below sea level and drains slowly.</p>

<h2>The historic streetcar takes no luggage</h2>

<p>The green cars on the St. Charles line have run for over a century and keep their original form: wooden benches, a narrow aisle, high entrance steps.</p>

<p>There is no space set aside for luggage and the steps are steep. Boarding with a suitcase is awkward and blocks the door.</p>

<h2>Bourbon Street closes in the evening</h2>

<p>Bourbon Street closes to traffic in the late afternoon and the crowd spreads across the roadway. Doors stand open and the music carries into the street.</p>

{{img:new-orleans-bourbon}}

<p>Moving through that crowd with a bag amounts to standing still.</p>

<h2>The Garden District and the cemeteries are on the streetcar line</h2>

<p>The Garden District's mansions and the historic cemeteries run along the St. Charles streetcar line, twenty minutes from the centre, and you get off and walk.</p>

<p>Some cemeteries admit visitors only on guided tours at set times, with a bag check at the gate.</p>

<h2>The airport is twenty kilometres west</h2>

<p>Louis Armstrong airport is twenty kilometres out, half an hour by road. There's a bus, but it's infrequent; most people take a taxi or a ride-hail.</p>

<h2>Festival weeks fill the city</h2>

<p>During Mardi Gras and Jazz Fest the hotels sell out months ahead and prices multiply. Plenty of people stay outside town and come in for the day.</p>

<p>Parade days also close the streets and cut vehicle access; everything happens on foot.</p>

<h2>Humid summers with afternoon storms</h2>

<p>Summer here is heavy and humid, with sudden violent afternoon downpours. There's shade in the narrow streets and under the balconies, none in the squares.</p>

<p>Walking around in that with a bag halves the day.</p>
`.trim(),
    },
  ],
};
