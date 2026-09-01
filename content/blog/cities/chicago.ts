import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "chicago",
  posts: [
    {
      locale: "tr",
      slug: "chicago-uzun-mesafe-trenleri-ogleden-sonra-valiz",
      title: "Chicago'da Uzun Mesafe Trenleri Öğleden Sonra Kalkıyor",
      excerpt:
        "Otel çıkışı on birde, tren üçte. Kışın rüzgârlı bir şehirde o dört saati sokakta geçirmek istemezsiniz.",
      cover: "chicago-union-hol",
      body: `
<p>Chicago Amerika'nın demiryolu düğümü. Batıya ve kuzeybatıya giden uzun mesafe trenlerinin çoğu Union Station'dan kalkıyor ve saatleri öğleden sonraya toplanmış.</p>

<p>Otel çıkışı ise on bir. Yani şehri bir gecelik ziyaret eden ya da burada aktarma yapan biri için ortada dört beş saat kalıyor.</p>

{{img:chicago-union-hol}}

<h2>Union Station'ın Büyük Holü bir bekleme salonu değil</h2>

<p>Gar binasının mermer holü etkileyici ama gündüz saatlerinde kalabalık ve oturma alanı sınırlı. Bekleme salonlarının bir kısmı yalnızca belirli biletlere açık.</p>

<h2>L hattının her istasyonunda merdiven var</h2>

<p>Chicago'nun metrosu şehir merkezinde yükseltilmiş: raylar caddelerin üstünden geçiyor ve peronlara merdivenle çıkılıyor. Asansör her istasyonda yok.</p>

{{img:chicago-el}}

<p>Bavulla o merdivenleri gün içinde birkaç kez çıkmak yorucu; kışın basamaklar buzlu ve kaygan oluyor.</p>

<h2>Millennium Park ve müze kampüsü ayrı uçlarda</h2>

<p>Millennium Park Loop'un kuzey ucunda; Field Müzesi, Shedd Akvaryumu ve Adler Gözlemevi'nin bulunduğu müze kampüsü ise güneyde, göl kıyısında.</p>

<p>Aralarında iki kilometre var ve yol açık göl kenarından geçiyor. Müzelerin hepsinde girişte kontrol var ve valiz kabul edilmiyor.</p>

<h2>Havalimanları uzak</h2>

<p>O'Hare merkeze yaklaşık otuz kilometre ve Mavi Hat ile kırk beş dakika. Midway daha yakın ama yine de yarım saat. İkisi de "uğrayıp döneyim" mesafesinde değil.</p>

<h2>İki gar, iki farklı hizmet</h2>

<p>Uzun mesafe ve banliyö trenleri Union Station'dan; bazı banliyö hatları ise Ogilvie ve Millennium istasyonlarından kalkıyor. Üçü de Loop'un içinde ama farklı köşelerinde.</p>

<p>Aralarındaki mesafe yürüyerek on beş dakikayı buluyor ve bu yürüyüş kış aylarında açık havada geçiyor.</p>

<h2>Loop yürünüyor</h2>

<p>Şehir merkezi Loop kompakt: Millennium Park, Sanat Enstitüsü, nehir kıyısı yürüyüş yolu ve mimari tekne turları birbirine yakın.</p>

<p>Sanat Enstitüsü'nde vestiyer var ama boyut sınırı uygulanıyor; tekne turlarında da bavul için yer yok.</p>

<h2>Mimari tekne turları saatli</h2>

<p>Chicago'nun en bilinen aktivitesi nehir üzerindeki mimari tekne turu. Turlar saatli ve iskeleye kalkıştan önce gelmek gerekiyor; tur doksan dakika sürüyor.</p>

<p>Teknede güverte açık ve oturma sıraları dar; bavul için ayrılmış yer yok.</p>

<h2>Rüzgâr gerçek</h2>

<p>Chicago'nun rüzgârlı şehir lakabı boşuna değil: göl kıyısından gelen rüzgâr caddeler arasında hızlanıyor. Kışın hissedilen sıcaklık sıfırın çok altına iniyor.</p>

<p>Bavulla o rüzgârda dışarıda beklemek dört saat sürecek bir şey değil.</p>

<h2>Nehir kıyısı ve göl kenarı yaz programı</h2>

<p>Yaz aylarında Riverwalk ve göl kenarındaki bisiklet yolu şehrin en iyi kısmı. Ama ikisi de açık alan ve bavul konacak yer sunmuyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "chicago-luggage-storage-afternoon-trains",
      title: "Chicago's Long-Distance Trains Leave in the Afternoon",
      excerpt:
        "Checkout at eleven, train at three. In a city this windy, you don't want to spend those four hours outside.",
      cover: "chicago-union-hol",
      body: `
<p>Chicago is America's railway knot. Most long-distance services west and northwest leave from Union Station, and their departures cluster in the afternoon.</p>

<p>Hotel checkout is at eleven. So anyone spending a night here, or connecting through, has four or five hours to fill.</p>

{{img:chicago-union-hol}}

<h2>The Great Hall isn't a waiting room</h2>

<p>The marble hall in the station building is impressive, but it's busy during the day and seating is limited. Some of the lounges are open only to particular tickets.</p>

<h2>Every L station has stairs</h2>

<p>Chicago's rapid transit is elevated through the centre: the tracks run above the streets and the platforms are reached by stairs. Not every station has a lift.</p>

{{img:chicago-el}}

<p>Climbing those several times a day with a bag is tiring, and in winter the steps ice over.</p>

<h2>The airports are far out</h2>

<p>O'Hare is about thirty kilometres from the centre, forty-five minutes on the Blue Line. Midway is closer but still half an hour. Neither is within "pop over" range.</p>

<h2>Several stations, different services</h2>

<p>Long-distance and some commuter trains use Union Station; other commuter lines run from Ogilvie and Millennium. All three are in the Loop, but in different corners of it.</p>

<p>Walking between them takes up to fifteen minutes — outdoors, which in winter matters.</p>

<h2>The Loop is walked</h2>

<p>The downtown Loop is compact: Millennium Park, the Art Institute, the Riverwalk and the architecture boat tours are all close together.</p>

<p>The Art Institute has a cloakroom with a size limit, and the boat tours have no space for luggage.</p>

<h2>The architecture boat tours run to a timetable</h2>

<p>Chicago's signature activity is the architecture boat tour on the river. Departures are timed, you board before the hour, and the tour runs ninety minutes.</p>

<p>The deck is open and the bench seating is tight; there's no space set aside for luggage.</p>

<h2>The wind is real</h2>

<p>The Windy City name is earned: wind off the lake accelerates between the buildings. In winter the wind chill drops far below freezing.</p>

<p>Waiting outside in that with a bag is not a four-hour proposition.</p>

<h2>The river and lakefront are the summer plan</h2>

<p>In summer the Riverwalk and the lakefront trail are the best of the city. But both are open ground with nowhere to set a bag down.</p>
`.trim(),
    },
  ],
};
