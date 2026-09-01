import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "santiago",
  posts: [
    {
      locale: "tr",
      slug: "santiago-metro-yogun-saat-dag-turlari-valiz",
      title: "Santiago Metrosu Yoğun Saatte Valiz Kaldırmıyor",
      excerpt:
        "Şehrin ağı geniş ve hızlı, ama sabah ve akşam vagonlar tıklım tıklım. Dağ turları da sabah erken kalkıyor.",
      cover: "santiago-plaza",
      body: `
<p>Santiago metrosu Güney Amerika'nın en kapsamlı ağlarından: yedi hat, yüz otuzdan fazla istasyon, temiz ve hızlı. Şehri gezmek için ideal.</p>

<p>Ama mesai saatlerinde vagonlar doluyor. Sabah yedi ile dokuz, akşam altı ile sekiz arasında kapı önünde durmak bile zor; bir valizle binmek pratik değil.</p>

{{img:santiago-plaza}}

<h2>Yaya caddeleri gün boyu kalabalık</h2>

<p>Merkezdeki Paseo Ahumada ve Paseo Huérfanos trafiğe kapalı ve şehrin en yoğun yaya hatları. Seyyar satıcılar ve müzisyenler geçidi daraltıyor.</p>

<p>Bavulla o caddelerden geçmek yavaş; iki yaya caddesi de metro istasyonlarını birbirine bağladığı için kaçınmak da kolay değil.</p>

<h2>Merkez düz, çevre yamaçlı</h2>

<p>Plaza de Armas çevresindeki tarihi merkez düz ve yürünebilir; Lastarria ve Bellas Artes de öyle. Ama şehir doğuya doğru yükseliyor ve Andlar hemen arkada duruyor.</p>

<p>Bellavista'daki San Cristóbal tepesine füniküler ya da teleferikle çıkılıyor; kabinlerde bagaj için yer yok.</p>

{{img:santiago-san-cristobal}}

<h2>Dağ turları sabah kalkıyor</h2>

<p>Kış aylarında Valle Nevado ve Farellones'e kayak servisleri sabah yedide kalkıyor ve akşam dönüyor; yol dağ virajlarından geçiyor.</p>

<p>Yazın Cajón del Maipo ve Valparaíso turları da aynı saatlerde. Araçlarda bavul için yer yok.</p>

<h2>Otobüs terminalleri güneyde toplanmış</h2>

<p>Şehirlerarası otobüsler Alameda ve Sur terminallerinden kalkıyor ve ikisi de merkezin güneybatısında, metroyla yirmi dakika. Patagonya ve kuzey yönündeki seferler gece.</p>

<p>Yani otelden öğlen çıkan biri için terminale gitmeden önce yine uzun bir bekleme var.</p>

<h2>Valparaíso iki saat</h2>

<p>Sahildeki Valparaíso'ya otobüsle iki saat ve pek çok kişi orada bir gece kalıyor. Şehir baştan sona yamaç ve funikülerlerle çıkılıyor.</p>

<p>Yani Santiago'dan çıkarken bavulun bir kısmını bırakmak yaygın bir tercih.</p>

<h2>Bellavista akşam bölgesi</h2>

<p>Mapocho'nun karşı yakasındaki Bellavista restoran ve barlarıyla akşam bölgesi; Pablo Neruda'nın evi de burada. Sokaklar dar ve masalar kaldırıma taşıyor.</p>

<p>Neruda'nın evinde girişte çanta bırakılıyor ama dolaplar küçük; valiz alan bir yer değil.</p>

<h2>Havalimanı yirmi kilometre</h2>

<p>Arturo Merino Benítez Havalimanı merkeze yirmi kilometre ve otobüsle kırk beş dakika. Metro hattı henüz oraya ulaşmıyor.</p>

<p>Uzun mesafe uçuşları gece kalkıyor; otel çıkışı öğlen. Aradaki saatler şehirde geçiyor.</p>

<h2>Pazarlar ve müzeler biletli</h2>

<p>Mercado Central ve La Vega pazarı merkezin kuzeyinde ve koridorları dar; öğle saatlerinde tıklım tıklım oluyor. Bellas Artes ve Precolombino müzelerinde ise girişte çanta kontrolü var.</p>

<p>Bavulla ne pazara girilebiliyor ne de müzeye.</p>

<h2>Yaz kuru ve sıcak</h2>

<p>Aralık ile mart arasında sıcaklık otuz beşi geçiyor ve hava kuru. Merkezde gölge sınırlı; parklar dışında ağaç az.</p>

<p>O saatlerde bavul çekmek gerçekten yorucu ve kaldırımlar geniş olsa da mesafeler uzun.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "santiago-luggage-storage-metro-peak-hours",
      title: "The Santiago Metro Won't Take a Suitcase at Rush Hour",
      excerpt:
        "The network is wide and fast, but the carriages fill morning and evening. The mountain trips leave early too.",
      cover: "santiago-plaza",
      body: `
<p>Santiago has one of the most comprehensive metro networks in South America: seven lines, more than a hundred and thirty stations, clean and quick. Ideal for seeing the city.</p>

<p>But at commuting hours the carriages fill. Between seven and nine in the morning and six and eight in the evening, standing by the door is hard enough; boarding with a suitcase isn't practical.</p>

{{img:santiago-plaza}}

<h2>The pedestrian streets are busy all day</h2>

<p>Paseo Ahumada and Paseo Huérfanos in the centre are closed to traffic and are the city's busiest walking routes. Vendors and musicians narrow them further.</p>

<p>Getting through with a bag is slow — and hard to avoid, since both link the metro stations together.</p>

<h2>Flat centre, sloping edges</h2>

<p>The historic centre around the Plaza de Armas is flat and walkable, and so are Lastarria and Bellas Artes. But the city rises to the east and the Andes stand right behind it.</p>

<p>Cerro San Cristóbal above Bellavista is reached by funicular or cable car; neither has space for luggage.</p>

{{img:santiago-san-cristobal}}

<h2>The mountain trips leave early</h2>

<p>In winter the shuttles to Valle Nevado and Farellones go at seven and return in the evening, on a road of mountain switchbacks.</p>

<p>In summer the trips to the Cajón del Maipo and Valparaíso run at the same hours. None has room for luggage.</p>

<h2>Valparaíso is two hours away</h2>

<p>Valparaíso on the coast is two hours by bus, and many people stay a night. The city is all hillside, climbed by funiculars.</p>

<p>Leaving part of the luggage behind in Santiago is the usual choice.</p>

<h2>The airport is twenty kilometres out</h2>

<p>Arturo Merino Benítez airport is twenty kilometres from the centre, forty-five minutes by bus. The metro doesn't reach it yet.</p>

<p>Long-haul flights leave at night; checkout is at noon. The hours in between are spent in the city.</p>

<h2>Markets and museums both check bags</h2>

<p>The Mercado Central and La Vega market north of the centre have narrow aisles and pack out at lunchtime. The Bellas Artes and Precolombino museums check bags at the door.</p>

<p>With a suitcase you get into neither.</p>

<h2>Dry, hot summers</h2>

<p>Between December and March the temperature passes thirty-five and the air is dry. Shade in the centre is limited; outside the parks there are few trees.</p>

<p>Pulling a bag in those hours is genuinely tiring, and though the pavements are wide the distances are long.</p>
`.trim(),
    },
  ],
};
