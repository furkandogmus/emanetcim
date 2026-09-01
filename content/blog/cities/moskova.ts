import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "moskova",
  posts: [
    {
      locale: "tr",
      slug: "moskova-uc-gar-ayni-meydanda-metro-derin-valiz",
      title: "Moskova'da Üç Tren Garı Aynı Meydanda ve Metro Çok Derin",
      excerpt:
        "Komsomolskaya Meydanı'nda üç ayrı gar yan yana duruyor. Metroda ise peronlara dakikalarca süren yürüyen merdivenlerle iniliyor.",
      cover: "moskova-kizil-meydan",
      body: `
<p>Moskova'da dokuz büyük tren garı var ve her biri farklı bir yöne hizmet veriyor: Leningradsky kuzeye, Kazansky doğuya, Kursky güneye.</p>

<p>Bunlardan üçü aynı meydanda: Komsomolskaya Meydanı'nda Leningradsky, Yaroslavsky ve Kazansky yan yana duruyor. Yani şehirde "gara git" demek yetmiyor; hangi gar olduğunu bilmek gerekiyor.</p>

{{img:moskova-kizil-meydan}}

<h2>Metro hızlı ama derin</h2>

<p>Moskova metrosu şehri gezmenin tek makul yolu: sefer aralığı bir iki dakika ve ağ her yere gidiyor. Ama istasyonların çoğu çok derinde ve peronlara uzun yürüyen merdivenlerle iniliyor.</p>

{{img:moskova-metro}}

<p>Bazı istasyonlarda o iniş bir dakikadan uzun sürüyor. Asansör istisna; aktarmalar da uzun koridorlardan geçiyor.</p>

<h2>Kızıl Meydan'a çantayla girilmiyor</h2>

<p>Kızıl Meydan'a ve çevresindeki yapılara girişte güvenlik kontrolü var. Kremlin ve katedraller için ayrı bilet alınıyor ve büyük bagaj kabul edilmiyor.</p>

<p>Kremlin girişinde küçük bir emanet bulunuyor ama valiz almıyor ve kuyruk uzun.</p>

<h2>Arbat ve yaya caddeleri</h2>

<p>Eski Arbat trafiğe kapalı ve bir kilometre boyunca dükkânlar, ressamlar ve sokak müzisyenleriyle dolu. Şehirdeki nadir yaya hatlarından biri.</p>

<p>Cadde düz ve geniş — bavulla yürünebilir. Ama kalabalık saatlerde ilerlemek yavaş ve oturacak yer sınırlı.</p>

<h2>Üç havalimanı, üçü ayrı yönde</h2>

<p>Şeremetyevo kuzeybatıda, Domodedovo güneyde, Vnukovo güneybatıda. Üçüne de Aeroexpress treniyle gidiliyor ve yol yarım saat sürüyor — ama trenler farklı garlardan kalkıyor.</p>

<p>Yani hangi havalimanına gideceğiniz, hangi gara gideceğinizi de belirliyor.</p>

<h2>Aeroexpress bagajı alıyor ama saatli</h2>

<p>Havalimanı trenleri geniş ve bagaj rafları var; bu, Moskova'da bavulla en rahat yolculuk. Ama seferler yarım saatte bir ve son tren akşam.</p>

<p>Gece uçuşu olan biri için o son trenden sonrası taksi demek — ve trafik geceleyin bile öngörülemez.</p>

<h2>Kış uzun ve kaldırımlar buzlu</h2>

<p>Moskova kışı kasımdan marta uzanıyor ve sıcaklık eksi yirmiye iniyor. Kaldırımlar temizleniyor ama buzlanma oluyor ve metro girişlerinin merdivenleri ıslak.</p>

<p>Bavulla o merdivenlerde ilerlemek kışın gerçekten dikkat gerektiriyor.</p>

<h2>Müzeler ve saraylar saatli</h2>

<p>Tretyakov Galerisi, Puşkin Müzesi ve Novodeviçi Manastırı belirli saatlerde açık ve her birinde girişte kontrol var. Vestiyerler palto için ölçülmüş.</p>

<p>Bu duraklar birer üç saatlik program ve hiçbirinde valiz bırakılacak yer yok.</p>

<h2>Merkez geniş, mesafeler uzun</h2>

<p>Kızıl Meydan, Arbat ve Gorki Parkı birbirine yakın görünüyor ama caddeler çok geniş ve karşıya geçişler alt geçitlerden yapılıyor.</p>

<p>O alt geçitlerin hepsinde merdiven var; bavulla her karşıya geçiş bir inip çıkma demek.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "moscow-luggage-storage-three-stations-square",
      title: "Three of Moscow's Railway Stations Share One Square, and the Metro Is Deep",
      excerpt:
        "Leningradsky, Yaroslavsky and Kazansky all stand on Komsomolskaya Square. And the metro platforms are minutes down an escalator.",
      cover: "moskova-kizil-meydan",
      body: `
<p>Moscow has nine main railway terminals, each serving a direction: Leningradsky north, Kazansky east, Kursky south.</p>

<p>Three of them share one square. Leningradsky, Yaroslavsky and Kazansky all stand on Komsomolskaya Square. So "go to the station" isn't an instruction here; you need to know which one.</p>

{{img:moskova-kizil-meydan}}

<h2>The metro is fast but deep</h2>

<p>The Moscow metro is the only sensible way to cross the city: trains every minute or two and a network that reaches everywhere. But most stations sit far underground, reached by long escalators.</p>

{{img:moskova-metro}}

<p>At some stations that descent takes more than a minute. Lifts are the exception, and interchanges run through long corridors.</p>

<h2>You don't take a bag onto Red Square</h2>

<p>Red Square and the buildings around it are entered through security screening. The Kremlin and the cathedrals are separately ticketed and large luggage isn't admitted.</p>

<p>There's a small deposit at the Kremlin gate, but it won't take a suitcase and the queue is long.</p>

<h2>The Arbat and the pedestrian streets</h2>

<p>Old Arbat is closed to traffic and runs a kilometre lined with shops, painters and buskers — one of the few pedestrian routes in the city.</p>

<p>It's flat and wide, so walkable with a bag. But progress is slow at busy hours and seating is limited.</p>

<h2>Three airports, in three directions</h2>

<p>Sheremetyevo is northwest, Domodedovo south, Vnukovo southwest. All three are reached by Aeroexpress in about half an hour — but the trains leave from different terminals.</p>

<p>So which airport you're using also decides which station you're going to.</p>

<h2>Long winters and icy pavements</h2>

<p>Moscow's winter runs from November to March with temperatures down to minus twenty. The pavements are cleared but ice forms, and the stairs into the metro get wet.</p>

<p>Handling a bag on those stairs in winter genuinely takes care.</p>

<h2>Museums and palaces run to fixed hours</h2>

<p>The Tretyakov Gallery, the Pushkin Museum and the Novodevichy Convent open at set times, each with a check at the door. The cloakrooms are sized for coats.</p>

<p>Each is a three-hour visit, and none of them takes a suitcase.</p>

<h2>A wide centre with long distances</h2>

<p>Red Square, the Arbat and Gorky Park look close together, but the avenues are very wide and crossings are made through underpasses.</p>

<p>Every one of those underpasses has stairs; with a bag, each crossing is a descent and a climb.</p>
`.trim(),
    },
  ],
};
