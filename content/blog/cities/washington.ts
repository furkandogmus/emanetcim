import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "washington",
  posts: [
    {
      locale: "tr",
      slug: "washington-national-mall-yuruyus-muze-guvenlik-valiz",
      title: "Washington'da National Mall Baştan Sona Üç Kilometre Yürüyüş",
      excerpt:
        "Kongre Binası'ndan Lincoln Anıtı'na kadar hepsi yaya. Müzeler ücretsiz ama hiçbiri valiz kabul etmiyor.",
      cover: "washington-capitol",
      body: `
<p>Washington'a gelenlerin çoğu bir gün ayırıyor: New York'tan trenle üç saat, Philadelphia'dan iki. Sabah geliniyor, National Mall geziliyor, akşam dönülüyor.</p>

<p>Program sade görünüyor ama Mall sanıldığından uzun. Kongre Binası'ndan Lincoln Anıtı'na kadar yaklaşık üç kilometre ve arada Washington Anıtı, savaş anıtları ve müzeler var.</p>

{{img:washington-capitol}}

<h2>Hepsi yürünüyor</h2>

<p>Mall boyunca metro istasyonları var ama anıtlar arası mesafeler için pratik değil; herkes yürüyor. Zemin çakıl ve çim, kaldırım her yerde yok.</p>

<p>Bir valizle bu güzergâhı yapmak, üç kilometreyi çakıl üstünde çekmek demek.</p>

<h2>Smithsonian müzeleri ücretsiz ama valiz almıyor</h2>

<p>Mall çevresindeki Smithsonian müzelerine giriş ücretsiz ve bu, bir günde birkaçını gezmeyi cazip kılıyor. Ama her birinin girişinde güvenlik kontrolü var ve büyük bagaj içeri alınmıyor.</p>

<p>Vestiyer sunanlar da boyut sınırı uyguluyor. Yani müze planı yapan biri bavulunu başka bir yere bırakmak zorunda.</p>

<h2>Arlington ve anıt mezarlık nehrin karşısında</h2>

<p>Arlington Ulusal Mezarlığı Potomac'ın karşı yakasında ve metroyla gidiliyor. Alan geniş, yollar eğimli ve gezmek iki saati buluyor.</p>

<p>Girişte kontrol var ve büyük çanta kabul edilmiyor; içeride de bırakılacak yer yok.</p>

<h2>Union Station merkezde</h2>

<p>Amtrak ve banliyö trenleri Union Station'a geliyor ve gar Kongre Binası'na yürüme mesafesinde. Bu, günübirlik gelenlerin işini kolaylaştırıyor.</p>

{{img:washington-union-gar}}

<p>Ama tren saatleriyle otel saatleri örtüşmüyor: sabah trenle gelen biri öğleden önce şehirde oluyor, akşam treni ise saat yediyi buluyor.</p>

<h2>Üç havalimanı, üçü farklı yönde</h2>

<p>Reagan merkeze yakın ve metroyla bağlı; Dulles kırk kilometre batıda; BWI ise Maryland'de. Hangi havalimanına ineceğiniz, şehirde geçireceğiniz süreyi doğrudan belirliyor.</p>

<h2>Metro geniş ama istasyonlar derin</h2>

<p>Washington metrosu temiz ve düzenli ama istasyonların bir kısmı çok derinde; uzun yürüyen merdivenlerle iniliyor. Dupont Circle ve Rosslyn gibi noktalarda bu merdivenler ülkenin en uzunları arasında.</p>

<p>Bavulla o merdivenlerde durmak, arkanızdaki akışı da yavaşlatıyor.</p>

<h2>Kongre Binası turu randevulu</h2>

<p>Kongre Binası'nın iç turu önceden alınan biletlerle ve belirli saatlerde yapılıyor. Girişte güvenlik var ve yanınıza alabileceğiniz eşya sınırlı.</p>

<h2>Georgetown metroya bağlı değil</h2>

<p>Şehrin en çok gezilen mahallelerinden Georgetown'ın kendi metro istasyonu yok; en yakın durak yürüyerek yirmi dakika ya da otobüsle gidiliyor.</p>

<p>Mahallenin sokakları da arnavut kaldırımı ve eğimli. Bavulla o yürüyüşü yapmak günün planını bozuyor.</p>

<h2>Yaz sıcak, kış rüzgârlı</h2>

<p>Washington yazın nemli ve sıcak; Mall boyunca gölge yalnızca ağaçların altında. Kışın ise açık alanlarda rüzgâr sert.</p>

<p>İki durumda da bavulla üç kilometre yürümek istemeyeceğiniz bir şey.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "washington-luggage-storage-national-mall",
      title: "The National Mall Is Three Kilometres of Walking End to End",
      excerpt:
        "From the Capitol to the Lincoln Memorial, all of it on foot. The museums are free — and none of them takes a suitcase.",
      cover: "washington-capitol",
      body: `
<p>Most people give Washington a day: three hours by train from New York, two from Philadelphia. In for the morning, the National Mall, out in the evening.</p>

<p>It sounds simple, but the Mall is longer than people expect. From the Capitol to the Lincoln Memorial is about three kilometres, with the Washington Monument, the war memorials and the museums in between.</p>

{{img:washington-capitol}}

<h2>All of it is walked</h2>

<p>There are metro stations along the Mall, but they aren't practical for the distances between the monuments; everyone walks. The surface is gravel and grass, and there isn't pavement everywhere.</p>

<p>Doing that route with a suitcase means dragging it three kilometres over gravel.</p>

<h2>The Smithsonians are free, and they don't take suitcases</h2>

<p>The Smithsonian museums around the Mall are free to enter, which makes seeing several in a day tempting. But each has a security check at the door, and large luggage isn't admitted.</p>

<p>Those with cloakrooms apply size limits. So anyone planning a museum day has to leave the bag elsewhere.</p>

<h2>Union Station is central</h2>

<p>Amtrak and the commuter trains arrive at Union Station, within walking distance of the Capitol. That makes life easy for day-trippers.</p>

{{img:washington-union-gar}}

<p>But train times and hotel times don't line up: a morning train puts you in the city before noon, and the evening train back can be as late as seven.</p>

<h2>The metro is spacious but the stations are deep</h2>

<p>Washington's metro is clean and orderly, but some stations sit very deep and are reached by long escalators. At Dupont Circle and Rosslyn those are among the longest in the country.</p>

<p>Standing on them with a bag slows the flow behind you as well.</p>

<h2>Three airports, in three directions</h2>

<p>Reagan is close in and on the metro; Dulles is forty kilometres west; BWI is in Maryland. Which one you land at directly decides how much time you have in the city.</p>

<h2>The Capitol tour is by appointment</h2>

<p>Tours inside the Capitol run at set times on tickets booked in advance. There's security at the entrance and a limit on what you can bring in.</p>

<h2>Hot summers, windy winters</h2>

<p>Washington is humid and hot in summer, with shade along the Mall only under the trees. In winter the wind across the open ground is sharp.</p>

<p>Either way, three kilometres with a suitcase is not something you want to do.</p>
`.trim(),
    },
  ],
};
