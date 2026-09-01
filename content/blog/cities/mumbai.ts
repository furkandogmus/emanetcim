import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "mumbai",
  posts: [
    {
      locale: "tr",
      slug: "mumbai-banliyo-treni-valizle-binilmez",
      title: "Mumbai Banliyö Trenine Yoğun Saatte Valizle Binilmiyor",
      excerpt:
        "Şehrin ana ulaşımı yerel trenler ve mesai saatlerinde vagonlar fiziksel olarak dolu. Bir valiz orada yer bulamıyor.",
      cover: "mumbai-cst",
      body: `
<p>Mumbai kuzeye doğru uzanan dar bir yarımada ve şehrin omurgası banliyö tren hatları. Milyonlarca kişi her gün bu trenlerle işe gidiyor.</p>

<p>Mesai saatlerinde vagonlar tıklım tıklım oluyor; kapılar açık kalıyor ve insanlar basamakta duruyor. Bu koşullarda bir valizle binmek pratikte mümkün değil.</p>

{{img:mumbai-cst}}

<h2>Chhatrapati Shivaji Terminus hem gar hem anıt</h2>

<p>CST binası UNESCO listesinde ve Mumbai'nin en tanınan yapılarından biri. Aynı zamanda hem banliyö hem uzun mesafe trenlerinin durağı; günde yüzbinlerce yolcu geçiyor.</p>

<p>Uzun mesafe trenleri şehirde tek noktadan kalkmıyor: CST'nin yanı sıra Mumbai Central ve Lokmanya Tilak terminalleri de var ve aralarında kilometreler var.</p>

<h2>Taksiler var ama trafik uzun</h2>

<p>Siyah sarı taksiler ve uygulama üzerinden çağrılan araçlar şehrin her yerinde. Ama Mumbai trafiği yoğun ve güneyden kuzeye gitmek saatler alabiliyor.</p>

<p>Bu yüzden yerel halk trene biniyor — ve tren de bavul kabul etmiyor. Aradaki boşlukta kalan tek şey bavulun kendisi oluyor.</p>

<h2>Elephanta feribotu iki saat sürüyor</h2>

<p>Hindistan Kapısı'nın önünden kalkan feribotlar Elephanta adasına bir saatte gidiyor. Adada mağaralara çıkmak için yüzden fazla basamak var.</p>

{{img:mumbai-gateway}}

<p>Gidiş dönüş ve geziyle birlikte yarım gün. Teknede bagaj için ayrılmış yer yok ve iskele dar.</p>

<h2>Colaba ve Kala Ghoda yürüyerek</h2>

<p>Hindistan Kapısı, Colaba Nedeni caddesi ve Kala Ghoda sanat bölgesi birbirine yürüme mesafesinde. Kaldırımlar tezgâhlarla dolu ve öğle saatlerinde kalabalık.</p>

<p>Marine Drive boyunca uzanan sahil yolu ise geniş ve düz; akşamüstü herkes buraya çıkıyor.</p>

<h2>Kaldırımlar dar, trafik yoğun</h2>

<p>Güneydeki tarihi bölgede kaldırımlar var ama tezgâhlar, park etmiş araçlar ve seyyar satıcılarla daralıyor. Karşıya geçmek için üst geçit ya da alt geçit kullanmak gerekiyor.</p>

<p>Bavulla o geçitlerin merdivenlerini çıkmak, kısa mesafeleri uzun gösteriyor.</p>

<h2>Havalimanı yirmi kilometre kuzeyde</h2>

<p>Chhatrapati Shivaji Havalimanı güneydeki turistik bölgeye yaklaşık yirmi kilometre. Trafiğe göre yol bir saati aşabiliyor.</p>

<p>Uluslararası uçuşların çoğu gece kalkıyor ve otel çıkışı öğlen. Aradaki on saat şehirde geçiyor.</p>

<h2>Dhobi Ghat ve Bandra ayrı yolculuklar</h2>

<p>Açık hava çamaşırhanesi Dhobi Ghat şehrin ortasında ve seyir noktası bir üst geçitten. Bandra ise kuzeyde, deniz kenarı ve kafeleriyle ayrı bir bölge.</p>

<p>İkisi de güneydeki turistik merkeze uzak ve banliyö treniyle ya da taksiyle gidiliyor. Her yolculuk bavulla iki katı zaman alıyor.</p>

<h2>Muson yağmurları planı bozuyor</h2>

<p>Haziran ile eylül arasında yağmur çok şiddetli ve sokaklar su tutuyor. Bu dönemde bavulla dışarıda kalmak sadece zor değil, bavulun da ıslanması demek.</p>

<p>Bavulunuz merkezde bir yerde durduğunda Elephanta da Marine Drive de aynı güne sığıyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "mumbai-luggage-storage-local-trains",
      title: "You Don't Board a Mumbai Local at Rush Hour With a Suitcase",
      excerpt:
        "The suburban trains are the city's backbone, and at peak hours the carriages are physically full. There is no space for a case.",
      cover: "mumbai-cst",
      body: `
<p>Mumbai is a narrow peninsula running north, and its backbone is the suburban railway. Millions of people commute on it every day.</p>

<p>At peak hours the carriages are packed solid; the doors stay open and people ride on the steps. Boarding with a suitcase in those conditions is not realistically possible.</p>

{{img:mumbai-cst}}

<h2>Chhatrapati Shivaji Terminus is a station and a monument</h2>

<p>The CST building is on the UNESCO list and is one of Mumbai's most recognisable structures. It's also a stop for both suburban and long-distance trains, with hundreds of thousands of passengers a day.</p>

<p>Long-distance services don't all leave from one place: alongside CST there are Mumbai Central and Lokmanya Tilak terminals, kilometres apart.</p>

<h2>The Elephanta ferry is a two-hour round trip</h2>

<p>Ferries from in front of the Gateway of India reach Elephanta island in an hour. Getting up to the caves means more than a hundred steps.</p>

{{img:mumbai-gateway}}

<p>With the crossing and the visit it's half a day. There's no space aboard for luggage and the jetty is narrow.</p>

<h2>Colaba and Kala Ghoda are walked</h2>

<p>The Gateway of India, Colaba Causeway and the Kala Ghoda arts district are within walking distance of each other. The pavements are lined with stalls and busy in the middle of the day.</p>

<p>Marine Drive along the seafront is wide and flat; the whole city comes out there in the late afternoon.</p>

<h2>Narrow pavements, heavy traffic</h2>

<p>The historic south does have pavements, but stalls, parked vehicles and hawkers narrow them. Crossing means using a footbridge or a subway.</p>

<p>Climbing those steps with a bag makes short distances feel long.</p>

<h2>The airport is twenty kilometres north</h2>

<p>Chhatrapati Shivaji airport is about twenty kilometres from the southern tourist district. Depending on the traffic the drive can exceed an hour.</p>

<p>Most international flights leave at night and checkout is at noon. Those ten hours are spent in the city.</p>

<h2>The monsoon rewrites the plan</h2>

<p>Between June and September the rain is heavy and the streets flood. Being out with a bag then isn't just hard — the bag gets soaked.</p>

<p>With it left somewhere central, Elephanta and Marine Drive both fit into the same day.</p>
`.trim(),
    },
  ],
};
