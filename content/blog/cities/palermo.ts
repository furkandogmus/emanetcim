import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "palermo",
  posts: [
    {
      locale: "tr",
      slug: "palermo-gece-feribotu-carsi-valiz",
      title: "Palermo'da Feribot Akşam Kalkıyor, Gün Sizin",
      excerpt:
        "Napoli ve Cagliari gemileri akşamüstü demir alıyor. Aradaki bütün gün şehirde geçiyor — ama otelden çıkalı saatler olmuş oluyor.",
      cover: "palermo-ballaro",
      body: `
<p>Sicilya'ya gelen ya da adadan ayrılan pek çok kişi feribot kullanıyor. Napoli ve Cagliari hatları akşamüstü kalkıp sabah varıyor; yani gemi bir gece konaklaması gibi çalışıyor.</p>

<p>Bunun bir yan etkisi var: otelden çıkış öğlen, geminin kalkışı akşam sekiz civarı. Aradaki yedi sekiz saat tam anlamıyla açıkta.</p>

{{img:palermo-liman}}

<h2>Çarşılarda bavul ilerlemiyor</h2>

<p>Palermo'nun üç tarihi çarşısı — Ballarò, Capo ve Vucciria — şehrin en canlı yerleri ve dar sokaklara kurulu. Tezgâhlar iki yandan sokağı kapatıyor, motosikletler arada geçiyor, zemin ıslak ve düzensiz.</p>

{{img:palermo-ballaro}}

<p>Bu sokaklarda bavul çekmek yalnızca zor değil, çevredeki insanları da engelliyor. Ballarò öğleden sonra kapanmaya başlıyor, yani görmek isteyen sabah gitmek zorunda — tam da otelden çıktığınız saat.</p>

<h2>Havalimanı otuz beş kilometre uzakta</h2>

<p>Punta Raisi Havalimanı şehir merkezine otuz beş kilometre. Trinacria Express treni ve otobüsler Palermo Centrale ile bağlantıyı sağlıyor, süre yaklaşık bir saat.</p>

<p>Bu mesafe "erkenden havalimanına gidip beklerim" seçeneğini pahalı hale getiriyor: gidiş bir saat, dönüş yok. Uçuşunuz akşamsa günü şehirde geçirmek daha mantıklı.</p>

<h2>Monreale yarım gün</h2>

<p>Palermo'nun hemen dışındaki Monreale, mozaikleriyle ünlü katedrali için gidilen klasik yarım günlük gezi. Otobüs merkeze bağlı ve yol yarım saat, tepeye çıkıyor.</p>

<p>Otobüste bavul için yer yok ve katedralde de emanet bulunmuyor. Son gününü Monreale'ye ayıranların bavulu şehirde kalıyor.</p>

<h2>Mondello plajı yazın</h2>

<p>Mondello merkeze on iki kilometre ve otobüsle gidiliyor. Yazın Palermolular için asıl plaj burası. Kum, şezlong ve bavul bir arada olmuyor; plaj kabinleri de küçük dolaplar.</p>

<h2>Merkez yürünebilir ama gölge yok</h2>

<p>Quattro Canti, katedral, Norman Sarayı ve Teatro Massimo birbirine yürüme mesafesinde. Ama Palermo yazın çok sıcak ve ana caddelerde gölge sınırlı. Öğle saatlerinde bavul çekmek fiziksel olarak zorlayıcı.</p>

<h2>Norman Sarayı ve Cappella Palatina saatli</h2>

<p>Norman Sarayı ile içindeki Cappella Palatina, Palermo'nun en çok ziyaret edilen yapısı ve saray hâlâ bölge meclisi olarak kullanıldığı için ziyaret saatleri sınırlı — bazı günler öğleden sonra kapanıyor.</p>

<p>Girişte güvenlik kontrolü var ve büyük çanta kabul edilmiyor. Yani bu yapıyı görmek isteyen biri, o saat aralığında bavulunun başka bir yerde olduğundan emin olmak zorunda.</p>

<h2>Cefalù treni bir saat</h2>

<p>Palermo Centrale'den Cefalù'ya trenler sık ve yol bir saat kadar. Deniz kıyısındaki bu kasaba günübirlik gidilenlerin başında geliyor. Geminizi ya da uçağınızı akşam bekleyen biri için bu bir seçenek — ama trene bavulla binip aynı gün geri getirmek anlamsız bir yük.</p>

<p>Bavulunuz merkezde bir yerde durduğunda, geminin kalkışına kadar geçen o yedi saat gezilen bir gün oluyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "palermo-luggage-storage-evening-ferry",
      title: "In Palermo the Ferry Leaves in the Evening — the Day Is Yours",
      excerpt:
        "The Naples and Cagliari boats sail at dusk. The whole day before is spent in the city, hours after checkout.",
      cover: "palermo-ballaro",
      body: `
<p>Plenty of people reach or leave Sicily by ferry. The Naples and Cagliari routes sail in the evening and arrive in the morning, so the crossing doubles as a night's accommodation.</p>

<p>There's a side effect. Hotel checkout is at noon and the ship leaves around eight. The seven or eight hours in between are entirely exposed.</p>

{{img:palermo-liman}}

<h2>A suitcase doesn't move through the markets</h2>

<p>Palermo's three historic markets — Ballarò, Capo and Vucciria — are the liveliest parts of town and they sit in narrow lanes. Stalls close the street in from both sides, mopeds push through, and the ground is wet and uneven.</p>

{{img:palermo-ballaro}}

<p>Pulling a case through them is not just hard, it blocks everyone else. Ballarò starts winding down in the afternoon, so seeing it means going in the morning — which is exactly when you check out.</p>

<h2>The airport is thirty-five kilometres away</h2>

<p>Punta Raisi airport is thirty-five kilometres from the centre. The Trinacria Express train and the buses connect it to Palermo Centrale in about an hour.</p>

<p>That distance makes "go to the airport early and wait" an expensive option: an hour out, and no coming back. With an evening flight, spending the day in the city makes far more sense.</p>

<h2>Monreale is a half day</h2>

<p>Monreale, just outside Palermo, is the classic half-day trip for its mosaic cathedral. The bus runs from the centre and takes half an hour, climbing the hill.</p>

<p>There's no room for luggage on the bus and no storage at the cathedral. Anyone giving their last day to Monreale leaves the bag in town.</p>

<h2>Mondello beach in summer</h2>

<p>Mondello is twelve kilometres out and reached by bus. In summer it is where Palermo actually swims. Sand, a sunbed and a suitcase don't combine, and the beach lockers are small.</p>

<h2>The centre is walkable, but there's no shade</h2>

<p>The Quattro Canti, the cathedral, the Norman Palace and the Teatro Massimo are all within walking distance of each other. But Palermo is very hot in summer and shade on the main streets is limited. Hauling a case at midday is genuinely hard work.</p>

<p>With the bag parked somewhere central, those seven hours before the ship sails turn into a day out.</p>
`.trim(),
    },
  ],
};
