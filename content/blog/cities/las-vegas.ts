import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "las-vegas",
  posts: [
    {
      locale: "tr",
      slug: "las-vegas-strip-yaya-koprusu-mesafe-valiz",
      title: "Las Vegas'ta Yan Yana Görünen İki Otel Arası Yirmi Dakika",
      excerpt:
        "Strip'te karşıdan karşıya geçmek yaya köprüsünden oluyor ve otellerin içinden yürünüyor. Mesafeler gözle görünenden çok uzun.",
      cover: "vegas-strip",
      body: `
<p>Las Vegas Strip yaklaşık yedi kilometre uzunluğunda ve dev otellerle çevrili. Bu ölçek insanı yanıltıyor: karşıda görünen otel yürüyerek yirmi dakika uzakta olabiliyor.</p>

<p>Sebebi iki katmanlı. Birincisi binalar devasa — bir otelin bir ucundan diğerine gitmek tek başına on dakika sürüyor ve yol kumarhane salonundan geçiyor.</p>

{{img:vegas-strip}}

<h2>Karşıya geçiş yaya köprüsünden</h2>

<p>İkincisi ve daha şaşırtıcı olanı: Strip'in büyük bölümünde caddeyi yaya olarak geçmek mümkün değil. Kavşaklarda karşıya geçiş üst köprülerden yapılıyor ve o köprülere yürüyen merdiven ya da asansörle çıkılıyor.</p>

{{img:vegas-yaya-koprusu}}

<p>Yani karşı kaldırıma geçmek için önce yukarı çıkıp sonra inmek gerekiyor. Bavulla bunu birkaç kez yapmak günün en yorucu kısmı oluyor.</p>

<h2>Otel çıkışı on birde, uçuşlar dağınık</h2>

<p>Vegas otellerinde çıkış genelde on bir. Uçuşlar ise gün boyuna yayılmış ve pek çok kişi akşam uçağıyla dönüyor.</p>

<p>Aradaki saatler Strip'te geçiyor — ve Strip bavulla yürünecek bir yer değil.</p>

<h2>Kumarhane salonlarında bavul dolaşmıyor</h2>

<p>Otellerin lobisinden geçmek için kumarhane salonundan geçmek gerekiyor. Masalar ve makineler arasındaki koridorlar dar ve kalabalık.</p>

<p>Konaklayanlar için bagaj bankosu var ama yalnızca o otelin misafirlerine. Çıkış yaptıktan sonra başka bir otelin gösterisine gidecek biri için bu bir çözüm değil.</p>

<h2>Monorail Strip'in arkasından geçiyor</h2>

<p>Strip boyunca bir monorail hattı var ama caddenin kendisinden değil, otellerin arkasından geçiyor. İstasyonlara ulaşmak için otelin içinden yürümek gerekiyor.</p>

<p>Yani bir durak arası bile kapıdan kapıya on beş dakika sürebiliyor ve o yolun büyük kısmı kapalı alanda, kalabalıkta.</p>

<h2>Gösteriler akşam, girişte kontrol var</h2>

<p>Strip'teki gösterilerin çoğu akşam yedi ile ondaki seanslarda. Salon girişlerinde çanta kontrolü var ve büyük bagaj kabul edilmiyor.</p>

<h2>Büyük Kanyon turları sabah kalkıyor</h2>

<p>Büyük Kanyon'a otobüs turları sabah altı yedi gibi kalkıyor ve akşam dönüyor; helikopter turları daha kısa ama yine saatli. Araçlarda bavul için yer yok.</p>

<p>Çıkış gününde bu turlardan birine yazılan biri bavulunu şehirde bırakmak zorunda.</p>

<h2>Fremont Street ayrı bir bölge</h2>

<p>Şehrin eski merkezi Fremont Street, Strip'in yedi kilometre kuzeyinde ve ayrı bir yer. Üstü kapalı yaya bölgesi ve akşam ışık gösterisi var.</p>

<p>İkisi arasında otobüs ya da araç gerekiyor; yürünmüyor. Yani bir günde ikisini birden görmek şehri baştan sona kat etmek demek.</p>

<h2>Yaz sıcağı gerçek bir engel</h2>

<p>Vegas çölde ve yazın sıcaklık kırk derecenin üzerine çıkıyor. Strip boyunca gölge yok; otellerin içi klimalı ama arada kalan açık bölümler değil.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "las-vegas-luggage-storage-strip-distances",
      title: "Two Hotels That Look Adjacent Are Twenty Minutes Apart in Las Vegas",
      excerpt:
        "Crossing the Strip means a pedestrian bridge, and the route goes through the casinos. Distances are far longer than they look.",
      cover: "vegas-strip",
      body: `
<p>The Las Vegas Strip runs about seven kilometres, lined with enormous resorts. That scale deceives: the hotel you can see across the road can be a twenty-minute walk away.</p>

<p>There are two reasons. First, the buildings are vast — crossing a single resort from one end to the other takes ten minutes, and the route goes through the casino floor.</p>

{{img:vegas-strip}}

<h2>You cross on a footbridge</h2>

<p>The second reason surprises people: along most of the Strip you cannot cross the road at street level. At the junctions, crossings are on overhead bridges reached by escalator or lift.</p>

{{img:vegas-yaya-koprusu}}

<p>So getting to the opposite pavement means going up and then down again. Doing that several times with a suitcase is the most tiring part of the day.</p>

<h2>Checkout at eleven, flights all day</h2>

<p>Vegas hotels generally check out at eleven. Flights are spread across the day and many people leave in the evening.</p>

<p>The hours in between are spent on the Strip — and the Strip is not somewhere to walk with a bag.</p>

<h2>A suitcase doesn't move through a casino floor</h2>

<p>Reaching a hotel lobby means crossing the casino floor. The aisles between the tables and machines are narrow and busy.</p>

<p>There are bell desks for guests, but only for that hotel's guests. For someone who has checked out and is heading to a show elsewhere, that isn't a solution.</p>

<h2>Shows are in the evening, with bag checks</h2>

<p>Most Strip shows run at seven or ten in the evening. There's a bag check at the theatre doors and large luggage isn't admitted.</p>

<h2>The Grand Canyon trips leave early</h2>

<p>Coach tours to the Grand Canyon leave around six or seven in the morning and return in the evening; helicopter tours are shorter but still timed. Neither has room for luggage.</p>

<p>Anyone booking one on their checkout day has to leave the bag in the city.</p>

<h2>Fremont Street is a separate district</h2>

<p>The old downtown, Fremont Street, is seven kilometres north of the Strip and a different place: a covered pedestrian zone with an evening light show.</p>

<p>Getting between them means a bus or a car; you don't walk it. Seeing both in a day means crossing the whole city.</p>

<h2>The summer heat is a real obstacle</h2>

<p>Vegas is in the desert and summer temperatures pass forty degrees. There's no shade along the Strip; the resorts are air-conditioned, the stretches between them are not.</p>
`.trim(),
    },
  ],
};
