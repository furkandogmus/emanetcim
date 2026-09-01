import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "kyoto",
  posts: [
    {
      locale: "tr",
      slug: "kyoto-istasyon-dolaplari-otobus-valiz",
      title: "Kyoto'da Dolaplar Öğleden Önce Doluyor",
      excerpt:
        "Kyoto istasyonunda yüzlerce dolap var ve sezonda hepsi dolu. Şehrin otobüsleri de bavul için tasarlanmadı.",
      cover: "kyoto-gar",
      body: `
<p>Kyoto istasyonu Japonya'nın en büyük istasyon binalarından biri: on beş katlı, içinde otel, mağaza ve tiyatro barındıran devasa bir cam-çelik yapı. İçinde yüzlerce jetonlu emanet dolabı da var.</p>

<p>Buna rağmen kiraz çiçeği ve sonbahar yaprağı sezonlarında bu dolapların hepsi öğleden önce doluyor. Özellikle valiz alan büyük boy olanlar sabah dokuz on gibi tükeniyor.</p>

{{img:kyoto-dolap}}

<h2>Neden hep aynı saat</h2>

<p>Sebep basit: Kyoto otellerinde çıkış saati on ya da on bir, giriş saati üç. Şehre trenle gelenlerin ve şehirden ayrılacakların hepsi aynı sabah saatlerinde istasyonda buluşuyor.</p>

<p>Bir de günübirlikçiler var — Osaka'dan yarım saat, Nara'dan kırk dakika. Onlar da aynı saatlerde geliyor.</p>

{{img:kyoto-gar}}

<h2>Şehir otobüsleri bavul taşımaya uygun değil</h2>

<p>Kyoto'nun asıl ulaşımı otobüs; metro yalnızca iki hat ve tapınakların çoğu metro güzergâhının dışında. Otobüsler arkadan binilip önden ödenerek inilen tipte ve koridor dar.</p>

<p>Yoğun hatlarda — özellikle Gion ve Kiyomizu yönünde — otobüsler ayakta doluyor. Bir valizle binmek pratikte kapıyı kapatmak anlamına geliyor.</p>

<h2>Gion ve Higashiyama taş döşeli</h2>

<p>Gion'daki Hanamikoji ve Shinbashi-dori, Higashiyama'daki Ninenzaka ve Sannenzaka gibi sokaklar taş döşeli ve yer yer basamaklı. Tekerlekli valizin sesi de bu sokaklarda oldukça belirgin oluyor.</p>

{{img:kyoto-gion}}

<h2>Arashiyama tren yolculuğu</h2>

<p>Bambu ormanıyla bilinen Arashiyama şehrin batısında ve trenle yarım saat. Oraya gidip dönmek yarım gün; tren vagonları da yoğun saatlerde dolu.</p>

<p>Bambu patikası tek yönlü ilerliyor ve genişliği sabit. Sabahın erken saatleri dışında burada durup fotoğraf çekmek bile sıra gerektiriyor.</p>

<h2>Ryokan giriş saatleri katı</h2>

<p>Geleneksel ryokan konaklamalarında giriş saati genelde üç ile beş arası ve akşam yemeği saatlidir. Yani öğlen varan biri bavuluyla ortada kalıyor.</p>

<h2>Fushimi Inari yokuş yukarı</h2>

<p>Binlerce turuncu torii kapısıyla bilinen Fushimi Inari, istasyonun hemen yanında başlıyor ama asıl rota dağın tepesine kadar çıkıyor. Tam tur iki üç saat sürüyor ve baştan sona basamaklı.</p>

<p>Aşağıdaki ilk birkaç yüz metre kalabalık ve dar; bavulla oraya girmek bile mümkün değil.</p>

<h2>Kiraz çiçeği ve yaprak sezonunda şehir doluyor</h2>

<p>Nisan başı ve kasım sonu Kyoto'nun en yoğun dönemleri. Oteller aylar öncesinden doluyor, tapınak girişlerinde kuyruk oluşuyor ve otobüsler sefer aralarını tutamıyor.</p>

<p>Bu dönemlerde istasyon dolaplarının erken tükenmesi de bir tesadüf değil; şehirdeki herkes aynı anda aynı şeye ihtiyaç duyuyor.</p>

<p>Kyoto yürüyerek gezilen bir şehir: tapınaklar arası mesafeler kısa ve ara sokaklar asıl güzelliği. Bavulunuz bir yerde durduğunda o yürüyüş şehrin kendisi oluyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "kyoto-luggage-storage-lockers-buses",
      title: "In Kyoto the Lockers Are Full Before Noon",
      excerpt:
        "Kyoto Station has hundreds of lockers, and in season they're all taken. The city buses weren't built for suitcases either.",
      cover: "kyoto-gar",
      body: `
<p>Kyoto Station is one of the largest station buildings in Japan: fifteen storeys of glass and steel containing a hotel, shops and a theatre. It also holds hundreds of coin lockers.</p>

<p>Even so, during cherry blossom and autumn leaf season they are all full before midday. The large ones that take a suitcase are typically gone by nine or ten in the morning.</p>

{{img:kyoto-dolap}}

<h2>Why it's always the same hour</h2>

<p>The reason is simple: Kyoto hotels check out at ten or eleven and check in at three. Everyone arriving and everyone leaving converges on the station in the same morning window.</p>

<p>Then there are the day-trippers — half an hour from Osaka, forty minutes from Nara. They arrive at the same time too.</p>

{{img:kyoto-gar}}

<h2>The city buses aren't built for luggage</h2>

<p>Kyoto runs on buses; the subway is only two lines and most temples are off it. The buses are boarded at the back and paid on exit at the front, and the aisle is narrow.</p>

<p>On the busy routes — towards Gion and Kiyomizu especially — they fill to standing. Getting on with a suitcase effectively means blocking the door.</p>

<h2>Gion and Higashiyama are paved in stone</h2>

<p>Hanamikoji and Shinbashi-dori in Gion, Ninenzaka and Sannenzaka in Higashiyama, are stone-paved and stepped in places. The noise a wheeled case makes on them carries a long way.</p>

{{img:kyoto-gion}}

<h2>Arashiyama is a train ride out</h2>

<p>Arashiyama, known for its bamboo grove, is west of the city and half an hour by train. Going out and back is half a day, and the carriages are full at busy times.</p>

<p>The bamboo path runs one way and doesn't widen. Outside the early morning, even stopping for a photograph means waiting your turn.</p>

<h2>Fushimi Inari climbs the mountain</h2>

<p>Fushimi Inari, with its thousands of orange torii, starts right beside its station but the full route climbs to the top of the mountain — two or three hours, stepped the whole way. The first few hundred metres are narrow and crowded enough that a suitcase couldn't enter at all.</p>

<h2>Ryokan check-in times are strict</h2>

<p>Traditional ryokan stays generally check in between three and five, with dinner served at a set hour. Arrive at midday and you and your bag have nowhere to be.</p>

<p>Kyoto is a walking city: the temples are close together and the side lanes are the real pleasure. With the bag parked, that walk becomes the city itself.</p>
`.trim(),
    },
  ],
};
