import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "montreal",
  posts: [
    {
      locale: "tr",
      slug: "montreal-eski-sehir-arnavut-kaldirimi-kis-valiz",
      title: "Eski Montreal'in Sokakları Arnavut Kaldırımı, Kışı da Uzun",
      excerpt:
        "Yaz aylarında taş döşeli sokaklar, kışın buz ve kar. İki mevsimde de tekerlekli valiz burada işe yaramıyor.",
      cover: "montreal-eski-sehir",
      body: `
<p>Montreal'in gezilen kısmı Vieux-Montréal — nehir kıyısındaki eski şehir. Sokaklar dar, binalar taş ve zemin baştan sona arnavut kaldırımı.</p>

<p>Bu, şehrin en güzel yanı ve aynı zamanda bavulla en zor kısmı. Rue Saint-Paul ve çevresindeki sokaklarda tekerlekli valiz her taşta zıplıyor.</p>

{{img:montreal-eski-sehir}}

<h2>Kış beş ay sürüyor</h2>

<p>Montreal kışı kasımdan nisana kadar uzuyor ve sıcaklık eksi yirmiye iniyor. Kaldırımlar temizleniyor ama kenarlarda kar yığınları oluşuyor ve taş zemin buzlanıyor.</p>

<p>Şehir bunun için yeraltı ağını kurmuş: RÉSO denen tüneller metro istasyonlarını, alışveriş merkezlerini ve binaları birleştiriyor. Ama o ağ eski şehre uzanmıyor; merkez iş bölgesinin altında.</p>

<h2>Şehir iki dilli ve iki karakterli</h2>

<p>Eski şehir dar ve taş; merkez iş bölgesi ise geniş bulvarlar ve yeraltı geçitleriyle bambaşka. Plateau ve Mile End mahalleleri de kuzeyde, dış merdivenli apartmanlarıyla ayrı bir doku.</p>

<p>Bu mahallelerin ünlü demir dış merdivenleri dik ve dar; bir valizle çıkmak zor.</p>

<h2>Metro istasyonlarında merdiven var</h2>

<p>Montreal metrosu altmışlardan kalma ve istasyonların büyük bölümüne merdivenle iniliyor. Asansör sonradan eklenmeye başlandı ama her istasyonda yok.</p>

<p>Bavulla aktarma yapmak, iki üç kat inip çıkmak demek.</p>

<h2>Jean-Talon ve Atwater pazarları</h2>

<p>Şehrin iki büyük halk pazarı merkezin dışında ve metroyla gidiliyor. Jean-Talon açık, Atwater kapalı bir yapı; ikisinde de tezgâh araları dar.</p>

<p>Bu pazarlar Montreal'in yerel yüzü ve yürüyerek geziliyor — bavulla değil.</p>

<h2>Notre-Dame Bazilikası biletli</h2>

<p>Eski şehirdeki Notre-Dame Bazilikası'na giriş ücretli ve belirli saatlerde. Girişte çanta kontrolü var ve içeride bagaj bırakılacak yer yok.</p>

{{img:montreal-notre-dame}}

<h2>Mont-Royal yokuş yukarı</h2>

<p>Şehre adını veren Mont-Royal tepesine yürüyerek çıkılıyor; patika ve merdivenler var, tepeye kadar yarım saat. Manzara terası şehre bakıyor.</p>

<p>Bavulla o çıkışı yapmak diye bir şey yok.</p>

<h2>Eski liman ve nehir kıyısı</h2>

<p>Vieux-Port boyunca uzanan yürüyüş yolu düz ve geniş — eski şehrin taş sokaklarından sonra rahat geliyor. Kışın burada buz pisti kuruluyor.</p>

<p>Ama oraya varmak için eski şehri geçmek gerekiyor ve o geçiş baştan sona arnavut kaldırımı.</p>

<h2>Havalimanı yirmi kilometre</h2>

<p>Trudeau Havalimanı merkeze yirmi kilometre ve 747 otobüsüyle kırk beş dakika. Otobüs yirmi dört saat çalışıyor ve bagaj için yer var — ama yoğun saatte doluyor.</p>

<h2>Festival dönemlerinde caddeler kapanıyor</h2>

<p>Yaz aylarındaki caz festivali ve diğer etkinliklerde merkezdeki caddeler trafiğe kapanıyor ve sahneler kuruluyor. Kalabalık akşamüstü yoğunlaşıyor.</p>

<p>O kalabalığın içinde bavulla ilerlemek yavaş; oturacak yer de bulunmuyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "montreal-luggage-storage-cobblestones",
      title: "Old Montreal Is Cobbled, and the Winter Is Long",
      excerpt:
        "Stone streets in summer, ice and snow in winter. A wheeled case is no use here in either season.",
      cover: "montreal-eski-sehir",
      body: `
<p>The part of Montreal people come for is Vieux-Montréal, the old city by the river. The streets are narrow, the buildings are stone, and the surface is cobbled throughout.</p>

<p>That's the best thing about the city and the hardest part of it with a bag. On Rue Saint-Paul and the lanes around it, a wheeled case bounces over every stone.</p>

{{img:montreal-eski-sehir}}

<h2>Winter runs five months</h2>

<p>Montreal's winter stretches from November to April and temperatures drop to minus twenty. The pavements get cleared but snow banks build at the edges and the stone ices over.</p>

<p>The city built an underground network for this: the RÉSO tunnels link metro stations, malls and buildings. But that network doesn't reach the old city; it sits under the business district.</p>

<h2>The metro stations have stairs</h2>

<p>The Montreal metro dates from the sixties and most stations are reached by stairs. Lifts are being retrofitted, but they aren't everywhere yet.</p>

<p>Changing lines with a bag means two or three flights down and up.</p>

<h2>Notre-Dame Basilica is ticketed</h2>

<p>The Notre-Dame Basilica in the old city charges admission and opens at set hours. There's a bag check at the door and nowhere inside to leave luggage.</p>

{{img:montreal-notre-dame}}

<h2>Mont-Royal is uphill</h2>

<p>Mont-Royal, the hill the city is named for, is climbed on foot by paths and staircases — about half an hour to the top, where the lookout faces the city.</p>

<p>Making that climb with a suitcase is not a thing.</p>

<h2>The old port and the riverside</h2>

<p>The promenade along the Vieux-Port is flat and wide — a relief after the stone lanes of the old city. In winter a skating rink goes up there.</p>

<p>But getting to it means crossing the old city, and that crossing is cobbled from end to end.</p>

<h2>The airport is twenty kilometres out</h2>

<p>Trudeau airport is twenty kilometres away, forty-five minutes on the 747 bus. The bus runs around the clock and has luggage space — though it fills at peak times.</p>

<h2>Festival weeks close the streets</h2>

<p>During the summer jazz festival and other events the downtown streets close to traffic and stages go up. The crowd thickens in the late afternoon.</p>

<p>Moving through it with a bag is slow, and there's nowhere to sit.</p>
`.trim(),
    },
  ],
};
