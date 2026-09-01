import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "delhi",
  posts: [
    {
      locale: "tr",
      slug: "delhi-metro-canta-taramasi-agra-treni-valiz",
      title: "Delhi Metrosunda Her Girişte Çanta Taranıyor",
      excerpt:
        "Her istasyonda X-ray cihazı var ve bagaj boyutunda sınır uygulanıyor. Bunu günde beş kez tekrarlamak günün ritmini bozuyor.",
      cover: "delhi-connaught",
      body: `
<p>Delhi metrosu geniş, temiz ve şehri baştan sona bağlıyor. Ama her istasyon girişinde güvenlik kontrolü var: çantalar X-ray cihazından geçiyor, yolcular ayrı bir noktadan aranıyor.</p>

<p>Küçük bir sırt çantasıyla bu birkaç saniye sürüyor. Büyük bir valizle her seferinde durup kaldırmak ve kuyruk beklemek gerekiyor. Metroya alınabilecek bagaj boyutunda da sınır var.</p>

<h2>Agra treni sabahın altısında kalkıyor</h2>

<p>Delhi'den Agra'ya en hızlı tren sabah çok erken kalkıyor ve iki saatte varıyor. Altın Üçgen'i yapanların çoğu Agra'yı günübirlik geziyor: sabah gidiyor, akşam dönüyor.</p>

{{img:delhi-eski-sehir}}

<p>Ama Delhi'den ayrılıp Agra'ya geçenler için tablo başka: bavul o trene biniyor ve Agra'da bütün gün yanınızda kalıyor.</p>

<h2>Eski Delhi'nin sokakları çekçek genişliğinde</h2>

<p>Chandni Chowk ve çevresindeki çarşılar Hindistan'ın en yoğun ticaret alanlarından. Sokaklar bir çekçeğin geçebileceği kadar geniş ve iki yanı dükkân.</p>

<p>Çekçekler burada asıl ulaşım aracı ama koltuk iki kişilik ve arkada bagaj yeri yok. Valizle binmek onu kucağınızda tutmak demek.</p>

<h2>Otorikşa pazarlığı zaman alıyor</h2>

<p>Şehir içinde otorikşa yaygın ve ucuz, ama fiyat çoğu zaman binmeden önce konuşuluyor. Bu pazarlık her yolculukta birkaç dakika sürüyor.</p>

<p>Elinizde bavul varken pazarlık gücünüz de azalıyor: sürücü bavulu görüyor ve alternatifinizin olmadığını biliyor.</p>

<h2>Anıtlar geniş alanlara yayılmış</h2>

<p>Kutub Minar, Hümayun Türbesi ve Kızıl Kale birbirine yakın değil ve her biri geniş bahçeler içinde. Girişte güvenlik kontrolü var ve büyük bagaj kabul edilmiyor.</p>

<p>Üçünü bir günde görmek şehri baştan sona kat etmek demek.</p>

<h2>Üç ayrı gar, üç ayrı yer</h2>

<p>Delhi'de New Delhi, Old Delhi ve Hazrat Nizamuddin garları var ve üçü de farklı hatlara hizmet veriyor. Biletinizde hangisinin yazdığı, o sabah nereye gideceğinizi belirliyor.</p>

<p>Aralarındaki mesafe metroyla yirmi dakika, trafikte daha uzun. Yanlış gara gitmek burada treni kaçırmak demek.</p>

<h2>Connaught Place revaklı bir daire</h2>

<p>Yeni Delhi'nin merkezindeki Connaught Place iç içe geçmiş daireler halinde ve kemerli revaklarla çevrili. Yağmurda ve sıcakta korunaklı.</p>

{{img:delhi-connaught}}

<p>Ama revakların altı dükkân girişleriyle bölünmüş ve kot farkları var; bavulla yürümek sürekli kenara çekilmek anlamına geliyor.</p>

<h2>Sıcak yazın planı bozuyor</h2>

<p>Mayıs ve haziranda Delhi'de sıcaklık kırk beş dereceyi görüyor. Anıtların bahçeleri açık ve gölge sınırlı; o saatlerde dışarıda kalmak zor.</p>

<p>Bu yüzden klasik program ikiye bölünüyor: sabah gezme, öğlen kapalı bir yere sığınma, akşamüstü yeniden çıkma. Otelden çıkmış biri için o öğlen molası bir sorun.</p>

<h2>Havalimanı metrosu yirmi dakika</h2>

<p>Indira Gandhi Havalimanı'na giden ekspres metro Yeni Delhi garından yirmi dakikada gidiyor. Bu, uçuş gününü şehirde geçirmeyi mümkün kılıyor — bavul bir yerde durduğu sürece.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "delhi-luggage-storage-metro-security",
      title: "Every Delhi Metro Entrance Scans Your Bag",
      excerpt:
        "There's an X-ray machine at every station and a size limit on what you can bring. Doing that five times a day breaks the rhythm.",
      cover: "delhi-connaught",
      body: `
<p>The Delhi Metro is wide, clean and connects the whole city. But there's a security check at every station entrance: bags go through an X-ray machine and passengers are searched separately.</p>

<p>With a daypack that's a few seconds. With a large case it means stopping, lifting and queueing every time — and there's a size limit on what the metro will accept.</p>

<h2>The Agra train leaves at six in the morning</h2>

<p>The fastest train from Delhi to Agra leaves very early and gets there in two hours. Most people doing the Golden Triangle treat Agra as a day trip: out in the morning, back at night.</p>

{{img:delhi-eski-sehir}}

<p>For those moving on rather than returning, it's different: the bag gets on that train and stays with you all day in Agra.</p>

<h2>Old Delhi's lanes are one rickshaw wide</h2>

<p>Chandni Chowk and the bazaars around it are among the densest trading areas in India. The lanes are just wide enough for a cycle rickshaw and lined with shops on both sides.</p>

<p>Rickshaws are the real transport here, but the seat takes two people and there's no luggage space behind. Riding with a suitcase means holding it on your lap.</p>

<h2>The monuments are spread across wide grounds</h2>

<p>The Qutub Minar, Humayun's Tomb and the Red Fort are nowhere near each other, and each sits inside extensive gardens. There's screening at every entrance and large bags aren't admitted.</p>

<p>Seeing all three in a day means crossing the city end to end.</p>

<h2>Connaught Place is an arcaded circle</h2>

<p>Connaught Place in the centre of New Delhi is built as concentric circles ringed by colonnades — sheltered from both rain and heat.</p>

{{img:delhi-connaught}}

<p>But the colonnade is broken up by shop entrances and level changes; walking it with a bag means constantly stepping aside.</p>

<h2>The summer heat rewrites the day</h2>

<p>In May and June Delhi reaches forty-five degrees. The monuments sit in open grounds with limited shade; staying outside in those hours is hard.</p>

<p>So the standard day splits in two: sightseeing in the morning, shelter indoors at midday, out again in the late afternoon. For someone already checked out, that midday break is the problem.</p>

<h2>The airport metro takes twenty minutes</h2>

<p>The express metro to Indira Gandhi airport runs from New Delhi station in twenty minutes. That makes spending your departure day in the city possible — as long as the bag is elsewhere.</p>
`.trim(),
    },
  ],
};
