import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "bangkok",
  posts: [
    {
      locale: "tr",
      slug: "bangkok-skytrain-merdiven-khao-san-valiz",
      title: "Bangkok'ta Her Skytrain İstasyonu Bir Kat Merdiven",
      excerpt:
        "Hat caddenin üstünden geçiyor, yani perona çıkmak için her seferinde merdiven var. Bavulla bu, günde on kez tekrarlanıyor.",
      cover: "bangkok-skytrain",
      body: `
<p>Bangkok'un BTS Skytrain hattı caddelerin üzerinde, viyadük üstünde ilerliyor. Bu, trafiği tamamen atlatmasını sağlıyor — şehrin en büyük kolaylığı.</p>

<p>Ama peron sokak seviyesinin iki kat yukarısında. Her istasyonda önce bilet katına, sonra perona çıkılıyor. Yürüyen merdiven ve asansör her istasyonda ve her çıkışta yok.</p>

{{img:bangkok-skytrain}}

<p>Bir valizle bunu gün içinde birkaç kez tekrarlamak yorucu. Üstelik Bangkok sıcak ve nemli; merdiven çıkışları da açık havada.</p>

<h2>İki havalimanı, iki farklı yön</h2>

<p>Suvarnabhumi şehrin doğusunda otuz kilometre, Don Mueang kuzeyinde yirmi beş kilometre. Ucuz hava yolları çoğunlukla Don Mueang'a iniyor.</p>

<p>Aralarında geçiş yapmak trafiğe bağlı olarak bir buçuk saati aşabiliyor. İki havalimanı arasında aktarma yapan biri için bu, şehirde geçen bir yarım gün demek.</p>

<h2>Khao San akşam kapanıyor</h2>

<p>Khao San Yolu akşamüstü tezgâhlarla ve masalarla doluyor; sokak fiilen yayalaşıyor ama geçiş daralıyor. Bölgedeki pansiyonların çoğunda giriş saati öğleden sonra.</p>

{{img:bangkok-khaosan}}

<p>Gece otobüsüyle gelen ya da gece uçağıyla gidecek olanlar için bu sokak bekleme alanı oluyor — bavulla oturacak yer bulmak zor.</p>

<h2>Büyük Saray'da kılık kıyafet kuralı ve çanta kontrolü</h2>

<p>Büyük Saray ve Zümrüt Buda'ya girişte kıyafet kuralı uygulanıyor: omuzlar ve dizler kapalı olmalı. Girişte ayrıca çanta kontrolü var ve büyük bagajla girilmiyor.</p>

<p>Wat Pho ve Wat Arun için de benzer kurallar geçerli. Bu üç tapınak birbirine yakın ve hepsini görmek yarım gün alıyor.</p>

<h2>Chatuchak hafta sonu pazarı devasa</h2>

<p>Chatuchak on beş binden fazla tezgâhıyla dünyanın en büyük hafta sonu pazarlarından biri. Koridorlar dar, üstü kapalı ve sıcak. İçeride kaybolmak olağan.</p>

<p>Bavulla bu pazara girmek gerçekten kötü bir fikir.</p>

<h2>Nehir tekneleri hızlı yanaşıyor</h2>

<p>Chao Phraya üzerindeki tekneler iskeleye kısa süre yanaşıyor ve iniş biniş hızlı oluyor. Elinizde valizle bu geçişi yapmak hem zor hem riskli.</p>

<h2>Trafik hesabı bozuyor</h2>

<p>Bangkok trafiği tahmin edilebilir değil. Taksiyle yirmi dakikalık bir yol mesai saatinde bir saati bulabiliyor. Bu yüzden uçuşa ya da otobüse yetişmek isteyen herkes fazladan pay bırakıyor.</p>

<p>O fazladan pay, bir yerde beklemek anlamına geliyor — ve bavul yanınızdaysa bekleyecek yer bulmak ayrı bir mesele.</p>

<h2>İki merkez arası: Sukhumvit ve eski şehir</h2>

<p>Sukhumvit modern tarafı: metro, alışveriş merkezleri, oteller. Rattanakosin ise tapınakların ve sarayın olduğu eski şehir ve oraya Skytrain gitmiyor; tekne ya da taksi gerekiyor.</p>

<p>Yani bir gün içinde ikisini birden görmek şehri baştan sona geçmek demek.
`.trim(),
    },
    {
      locale: "en",
      slug: "bangkok-luggage-storage-skytrain-stairs",
      title: "Every Skytrain Station in Bangkok Is a Flight of Stairs",
      excerpt:
        "The line runs above the street, so reaching the platform means climbing every single time. With a bag, that's ten times a day.",
      cover: "bangkok-skytrain",
      body: `
<p>Bangkok's BTS Skytrain runs on a viaduct above the roads. That's how it escapes the traffic entirely — the single greatest convenience in the city.</p>

<p>But the platform is two levels above the street. At every station you climb first to the concourse and then to the platform. Escalators and lifts are not at every station or every exit.</p>

{{img:bangkok-skytrain}}

<p>Repeating that several times a day with a suitcase is exhausting. Bangkok is hot and humid, and the stairways are in the open air.</p>

<h2>Two airports, in opposite directions</h2>

<p>Suvarnabhumi is thirty kilometres east of the city, Don Mueang twenty-five kilometres north. The budget airlines mostly use Don Mueang.</p>

<p>Getting between them can exceed an hour and a half depending on traffic. For anyone connecting between the two, that's half a day spent in the city.</p>

<h2>Khao San closes in for the evening</h2>

<p>Khao San Road fills with stalls and tables in the late afternoon; the street effectively pedestrianises but the passage narrows. Most guesthouses in the area check in during the afternoon.</p>

{{img:bangkok-khaosan}}

<p>For people arriving on the night bus or leaving on a night flight, this street becomes the waiting room — and finding somewhere to sit with a suitcase is hard.</p>

<h2>The Grand Palace has a dress code and a bag check</h2>

<p>The Grand Palace and the Emerald Buddha enforce a dress code: shoulders and knees covered. There's also a bag check at the entrance, and large luggage isn't admitted.</p>

<p>Similar rules apply at Wat Pho and Wat Arun. The three are close together and seeing all of them takes half a day.</p>

<h2>Chatuchak weekend market is enormous</h2>

<p>With more than fifteen thousand stalls, Chatuchak is one of the largest weekend markets in the world. The aisles are narrow, covered and hot. Getting lost inside is normal.</p>

<p>Bringing a suitcase in is a genuinely bad idea.</p>

<h2>The river boats dock briefly</h2>

<p>The boats on the Chao Phraya pull up to the pier only briefly, and boarding is quick. Making that step with a suitcase in hand is both awkward and risky.</p>

<h2>The traffic breaks every calculation</h2>

<p>Bangkok traffic isn't predictable. A twenty-minute taxi ride can take an hour at rush hour, which is why anyone with a flight or a bus to catch builds in a margin.</p>

<p>That margin means waiting somewhere — and with a bag in hand, finding somewhere to wait is its own problem.</p>
`.trim(),
    },
  ],
};
