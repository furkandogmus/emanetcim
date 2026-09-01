import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "tel-aviv",
  posts: [
    {
      locale: "tr",
      slug: "tel-aviv-shabbat-toplu-tasima-durunca-valiz",
      title: "Tel Aviv'de Cuma Akşamı Toplu Taşıma Duruyor",
      excerpt:
        "Shabbat boyunca otobüsler ve trenler çalışmıyor. Cumartesi gecesi uçağı olan biri için bu, günü baştan planlamak demek.",
      cover: "tel-aviv-rothschild",
      body: `
<p>İsrail'de Shabbat cuma günü gün batımından cumartesi akşamına kadar sürüyor ve bu süre boyunca toplu taşımanın büyük bölümü durur. Otobüsler çalışmaz, trenler durur, dükkânların çoğu kapalıdır.</p>

<p>Tel Aviv bu konuda ülkenin diğer şehirlerine göre daha esnek ama yine de fark belirgin: cuma öğleden sonra şehir yavaşlar, cumartesi gündüz sokaklar sessizleşir.</p>

{{img:tel-aviv-rothschild}}

<h2>Cumartesi uçuşu olan için bu bir plan sorunu</h2>

<p>Otel çıkışı cuma ya da cumartesi öğlense ve uçuş cumartesi gecesiyse, aradaki süreyi geçirmek gerekiyor — ve o süre boyunca ulaşım seçenekleri sınırlı.</p>

<p>Şeruta denen paylaşımlı minibüsler Shabbat'ta da çalışıyor ama koltuklar sıkışık ve bagaj için ayrılmış yer yok.</p>

<h2>Bisiklet şehrin ulaşım biçimi</h2>

<p>Tel Aviv düz ve bisiklet yolları her yerde; paylaşımlı bisikletler ve scooterlar yaygın. Şehri gezmenin en hızlı yolu bu.</p>

<p>Ama bisikletin sepeti bir çanta alıyor, valiz almıyor. Yani bavulunuz varken şehrin kendi ulaşım biçimi size kapalı.</p>

<h2>Havalimanı yirmi kilometre ve tren de durur</h2>

<p>Ben Gurion Havalimanı merkeze yirmi kilometre ve normalde trenle on beş dakika. Ama Shabbat boyunca tren de çalışmıyor; taksi ya da şeruta kalıyor.</p>

<p>Üstelik havalimanına erken gitmek gerekiyor: güvenlik süreci uzun ve yolculardan üç saat önce gelmeleri isteniyor.</p>

<h2>Bauhaus binaları ve Beyaz Şehir</h2>

<p>Rothschild Bulvarı ve çevresindeki Bauhaus yapıları UNESCO listesinde ve yürüyüş rotalarıyla geziliyor. Bulvarın ortasında ağaçlı bir yaya şeridi var.</p>

<p>Rota birkaç kilometre ve tamamı yaya; bavulla yapılacak bir gezi değil.</p>

<h2>Karmel Pazarı cuma öğleden sonra kapanıyor</h2>

<p>Şehrin en canlı pazarı Karmel, cuma öğleye kadar en yoğun hâlinde ve sonra kapanıyor. Koridorlar dar ve o son saatlerde tıklım tıklım oluyor.</p>

{{img:tel-aviv-carmel}}

<p>Bavulla o koridorlara girmek mümkün değil.</p>

<h2>Sahil bandı on dört kilometre</h2>

<p>Tayelet denen sahil yürüyüş yolu şehrin kuzeyinden Yafa'ya kadar uzanıyor ve düz. Plajlarda duş ve tuvalet var ama dolap bulunmuyor.</p>

<h2>Kudüs ve Ölü Deniz günübirlik</h2>

<p>Kudüs'e trenle yarım saat, otobüsle bir saat; Ölü Deniz'e ise iki saat. İkisi de günübirlik gidiliyor ama Shabbat'ta tren ve otobüs çalışmıyor.</p>

<p>O günlerde tur şirketlerinin araçları kalıyor ve onlarda bavul için yer yok.</p>

<h2>Yafa'nın sokakları taş ve dar</h2>

<p>Güneydeki Yafa'nın eski şehri taş döşeli, dar ve basamaklı sokaklardan oluşuyor. Merkeze yürüyerek yarım saat, sahil boyunca.</p>

<p>Bavulla o sokaklara girmek zor ve pire pazarının tezgâhları geçidi daraltıyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "tel-aviv-luggage-storage-shabbat-transport",
      title: "Public Transport Stops in Tel Aviv on Friday Evening",
      excerpt:
        "Buses and trains don't run through Shabbat. With a Saturday night flight, the whole day has to be planned around it.",
      cover: "tel-aviv-rothschild",
      body: `
<p>Shabbat runs from sunset on Friday to Saturday evening, and through it most public transport in Israel stops. The buses don't run, the trains stop, most shops are closed.</p>

<p>Tel Aviv is more relaxed about this than the rest of the country, but the difference is still clear: the city slows on Friday afternoon and the streets go quiet on Saturday.</p>

{{img:tel-aviv-rothschild}}

<h2>A Saturday flight is a planning problem</h2>

<p>If checkout is Friday or Saturday at noon and the flight is Saturday night, the hours in between have to be filled — with limited transport available.</p>

<p>The shared minibuses called sherut do run through Shabbat, but the seats are tight and there's no space set aside for luggage.</p>

<h2>The airport is twenty kilometres out and the train stops too</h2>

<p>Ben Gurion is twenty kilometres from the centre, normally fifteen minutes by train. But the train doesn't run through Shabbat either; that leaves a taxi or a sherut.</p>

<p>And you go early: the security process is long and passengers are asked to arrive three hours ahead.</p>

<h2>The Carmel Market shuts on Friday afternoon</h2>

<p>Carmel, the city's liveliest market, is at its busiest on Friday morning and then closes. The aisles are narrow and packed solid in those last hours.</p>

{{img:tel-aviv-carmel}}

<p>Getting into them with a bag isn't possible.</p>

<h2>The seafront runs fourteen kilometres</h2>

<p>The tayelet promenade runs from the north of the city down to Jaffa and is flat. The beaches have showers and toilets, but no lockers.</p>

<h2>Jerusalem and the Dead Sea are day trips</h2>

<p>Jerusalem is half an hour by train, an hour by bus; the Dead Sea is two hours. Both are done in a day — but neither the train nor the buses run on Shabbat.</p>

<p>That leaves the tour operators' vehicles, and they have no room for luggage.</p>

<h2>Jaffa's lanes are stone and narrow</h2>

<p>The old town of Jaffa in the south is cobbled, narrow and stepped. It's half an hour from the centre on foot along the shore.</p>

<p>Getting into those lanes with a bag is hard, and the flea market stalls narrow them further.</p>
`.trim(),
    },
  ],
};
