import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "torino",
  posts: [
    {
      locale: "tr",
      slug: "torino-iki-gar-mise-egizio-valiz",
      title: "Torino'da İki Gar, Bir Müze Vestiyeri ve Kayak Transferleri",
      excerpt:
        "Porta Nuova mı Porta Susa mı? Torino'da bavul planı bu sorunun cevabıyla başlıyor.",
      cover: "torino-mole",
      body: `
<p>Torino'nun iki büyük garı var ve ikisi de merkeze yakın. Porta Nuova klasik ana gar, şehrin göbeğinde. Porta Susa ise daha yeni ve yeraltında; Paris yönündeki trenler ile bazı hızlı seferler oradan kalkıyor.</p>

<p>İkisi arası iki kilometre kadar, metroyla birkaç dakika. Ama biletinizde hangisinin yazdığını görmeden plan yapmak, Torino'da yapılan en yaygın hata.</p>

{{img:torino-gar}}

<h2>Museo Egizio yarım gün alıyor</h2>

<p>Torino'daki Mısır Müzesi, Kahire dışındaki en büyük Mısır koleksiyonu olarak anılıyor ve gezmek üç dört saat sürüyor. Müzenin vestiyeri var ama küçük dolaplardan oluşuyor — palto ve sırt çantası için ölçülmüş, valiz için değil.</p>

<p>Şehre bir günlüğüne gelip bu müzeyi görmek isteyenler için bu doğrudan bir engel: kapıda geri çevrilmek istemiyorsanız bavulu başka bir yere bırakmanız gerekiyor.</p>

<h2>Mole Antonelliana'nın cam asansörü</h2>

<p>Şehrin simgesi Mole Antonelliana, içinde Ulusal Sinema Müzesi'ni barındırıyor ve kubbenin içinden geçen cam asansörle seyir terasına çıkılıyor. Asansör küçük ve şeffaf; içinde bir bavulla durmak hem yasak hem de fiziksel olarak zor.</p>

{{img:torino-mole}}

<h2>On sekiz kilometre revak</h2>

<p>Torino'nun merkezi revaklı caddelerle örülü — toplamı on sekiz kilometreye yaklaşıyor. Via Roma, Via Po ve Piazza San Carlo çevresi baştan sona kapalı yürüyüş yolu.</p>

<p>Bu, kışın yağmur ve karda büyük kolaylık. Ama revakların altı aynı zamanda kafelerin masalarını koyduğu yer; kalabalık saatlerde geçiş daralıyor.</p>

<h2>Kayak transferleri Torino'dan kalkıyor</h2>

<p>Sestriere, Bardonecchia ve Via Lattea bölgesine giden servisler kışın Torino'dan hareket ediyor ve yol iki saate yakın. Kayak ekipmanıyla gidenler için bu, şehirde geçirilen birkaç saatin ekstra yük demek olduğu anlamına geliyor.</p>

<p>Aynısı ters yönde de geçerli: dağdan dönüp akşam uçağına binecek biri, arada Torino'da yarım gün buluyor.</p>

<h2>Havalimanı ve tren bağlantısı</h2>

<p>Torino-Caselle Havalimanı merkeze on altı kilometre ve tren ile otobüs bağlantısı var. Şehir aynı zamanda Milano'ya bir saat, yani pek çok kişi Torino'yu Milano'dan günübirlik geziyor.</p>

<h2>Kahve evleri ve Piazza San Carlo</h2>

<p>Torino'nun tarihi kahve evleri şehrin kendi geleneği: ahşap ve aynayla kaplı salonlar, mermer masalar, bicerin denen katmanlı sıcak içecek. Bu mekânların çoğu dar ve masalar birbirine yakın.</p>

<p>İçeride bir valizle oturmak pratikte mümkün değil — geçişi kapatıyor. Aynısı Porta Palazzo'daki büyük açık pazar için de geçerli; Avrupa'nın en büyük açık hava pazarlarından biri sayılıyor ve tezgâh araları dar.</p>

<p>Bütün bu senaryolarda ortak nokta aynı: Torino'da geçirilen süre çoğu zaman otelsiz geçiyor ve bavulun nerede durduğu günün şeklini belirliyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "turin-luggage-storage-two-stations",
      title: "Turin: Two Stations, a Museum Cloakroom and the Ski Transfers",
      excerpt:
        "Porta Nuova or Porta Susa? In Turin the luggage plan starts with answering that question.",
      cover: "torino-mole",
      body: `
<p>Turin has two main stations, both close to the centre. Porta Nuova is the classic one, right in the middle of town. Porta Susa is newer and underground; trains towards Paris and some high-speed services leave from there.</p>

<p>They're about two kilometres apart, a few minutes by metro. But planning your day without checking which one is printed on the ticket is the most common mistake made here.</p>

{{img:torino-gar}}

<h2>The Museo Egizio takes half a day</h2>

<p>Turin's Egyptian Museum is described as the largest collection of Egyptian antiquities outside Cairo, and getting round it takes three or four hours. It has a cloakroom, but it is a wall of small lockers — sized for a coat and a daypack, not a suitcase.</p>

<p>For anyone in the city for a single day, that's a hard stop: unless you want to be turned away at the door, the bag has to be somewhere else.</p>

<h2>The glass lift in the Mole Antonelliana</h2>

<p>The Mole Antonelliana, the city's landmark, houses the National Cinema Museum, and a glass lift rises through the dome to the viewing deck. The lift is small and transparent; standing in it with a suitcase is both prohibited and physically awkward.</p>

{{img:torino-mole}}

<h2>Eighteen kilometres of arcades</h2>

<p>Turin's centre is laced with arcaded streets, close to eighteen kilometres of them. Via Roma, Via Po and the streets around Piazza San Carlo are covered walkways from end to end.</p>

<p>That's a real comfort in winter rain and snow. But the arcades are also where the cafés put their tables, and at busy hours the passage narrows.</p>

<h2>The ski transfers leave from Turin</h2>

<p>Coaches to Sestriere, Bardonecchia and the Via Lattea area run from Turin in winter, about two hours each way. If you're travelling with ski gear, every hour spent in the city is an hour of extra load.</p>

<p>The same applies in reverse: come down from the mountains for an evening flight and you have half a day in Turin to fill.</p>

<h2>Airport and rail links</h2>

<p>Turin-Caselle airport is sixteen kilometres out with both train and bus connections. The city is also an hour from Milan, so plenty of people see Turin as a day trip from there.</p>

<p>All of these scenarios share one thing: time in Turin is usually spent without a hotel room, and where the bag sits shapes the day.</p>
`.trim(),
    },
  ],
};
