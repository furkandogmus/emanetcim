import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "houston",
  posts: [
    {
      locale: "tr",
      slug: "houston-yeralti-tunelleri-mesai-saatinde-aciliyor-valiz",
      title: "Houston'ın Yeraltı Tünelleri Yalnızca Mesai Saatlerinde Açık",
      excerpt:
        "Merkezdeki on kilometrelik klimalı tünel ağı hafta içi gündüz çalışıyor. Akşam ve hafta sonu kapalı.",
      cover: "houston-downtown",
      body: `
<p>Houston yazın çok sıcak ve nemli; dışarıda yürümek temmuzda gerçekten zor. Şehir merkezi bu soruna kendi çözümünü kurmuş: binaların altından geçen yaklaşık on kilometrelik klimalı tünel ağı.</p>

<p>Tüneller ofis kulelerini, otelleri ve alışveriş alanlarını birbirine bağlıyor ve sıcak günlerde merkezde yürümenin asıl yolu bu.</p>

{{img:houston-downtown}}

<h2>Ama tüneller her saat açık değil</h2>

<p>Ağ ofis çalışanları için kurulmuş ve buna göre işliyor: hafta içi gündüz saatlerinde açık, akşam ve hafta sonu kapalı.</p>

<p>Yani cumartesi öğleden sonra bavulla merkezde olan biri o tünelleri kullanamıyor ve sokakta, sıcakta kalıyor.</p>

<h2>Şehir yürüme ölçeğinde değil</h2>

<p>Houston Amerika'nın en yayılmış şehirlerinden ve imar kısıtı olmadan büyümüş. Museum District, Montrose ve merkez ayrı bölgeler ve aralarında kilometrelerce mesafe var.</p>

<p>METRORail üç kısa hattan oluşuyor ve merkez ile müze bölgesini bağlıyor; geri kalan her yere araçla gidiliyor.</p>

{{img:houston-metrorail}}

<h2>Kaldırım her yerde yok</h2>

<p>Merkez dışında kaldırımlar kesintiye uğruyor ve bazı caddelerde hiç bulunmuyor. Şehir araba için tasarlandığı için yaya geçişleri de seyrek.</p>

<p>Bavulla o caddelerde yürümek, kısa görünen mesafeleri gerçekte yürünemez hale getiriyor.</p>

<h2>İki havalimanı, ikisi ters yönde</h2>

<p>Bush Havalimanı şehrin kuzeyinde otuz yedi kilometre, Hobby ise güneydoğuda on sekiz kilometre. İkisi arasında aktarma yapmak bir saatten fazla sürüyor.</p>

<p>Uluslararası uçuşların çoğu Bush'tan ve akşam kalkıyor; otel çıkışı ise öğlen.</p>

<h2>Otoparklar merkezin dokusunu belirliyor</h2>

<p>Downtown Houston'ın önemli bir bölümü otopark ve boş arsa; binalar arası mesafeler bu yüzden uzun görünüyor. Yürüyerek iki blok gitmek beklenenden fazla sürüyor.</p>

<p>Gölge de o boşluklarda yok; bavulla yürümek yazın gerçekten zor.</p>

<h2>Uzay merkezi şehir dışında</h2>

<p>NASA'nın Uzay Merkezi merkeze kırk kilometre güneydoğuda ve gezmek yarım gün alıyor. Girişte kontrol var ve büyük bagaj kabul edilmiyor.</p>

<p>Turlar sabah kalkıyor; çıkış gününde oraya gitmek isteyen biri bavulunu şehirde bırakmak zorunda.</p>

<h2>Nem sıcaktan daha belirleyici</h2>

<p>Mayıs ile ekim arasında nem çok yüksek ve gölgede bile terletiyor. Kısa mesafeler bile bavulla uzun geliyor.</p>

<h2>Merkezde hafta sonu sessiz</h2>

<p>Downtown Houston bir iş bölgesi ve hafta sonları sokaklar boşalıyor. Kafelerin bir kısmı yalnızca hafta içi açık, tüneller de öyle.</p>

<p>Yani cumartesi öğleden sonra bekleyecek yer aramak, hafta içine göre belirgin biçimde zor.</p>

<h2>Museum District yürünüyor</h2>

<p>On dokuz müze Hermann Park çevresinde toplanmış ve aralarında yürünüyor. Hepsinde girişte çanta kontrolü var ve vestiyerler küçük.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "houston-luggage-storage-tunnels-business-hours",
      title: "Houston's Underground Tunnels Are Open on Business Hours Only",
      excerpt:
        "Ten kilometres of air-conditioned tunnel under downtown — open on weekday daytimes, shut in the evening and at weekends.",
      cover: "houston-downtown",
      body: `
<p>Houston is very hot and humid in summer; walking outside in July is genuinely hard. Downtown built its own answer: roughly ten kilometres of air-conditioned tunnels running under the buildings.</p>

<p>They link office towers, hotels and shopping areas, and on hot days they are how you actually move around the centre.</p>

{{img:houston-downtown}}

<h2>But the tunnels aren't open at all hours</h2>

<p>The network was built for office workers and runs accordingly: open on weekday daytimes, closed in the evening and at weekends.</p>

<p>So anyone downtown with a suitcase on a Saturday afternoon can't use them and stays out on the street, in the heat.</p>

<h2>The city isn't built at walking scale</h2>

<p>Houston is among the most spread-out cities in America, grown without zoning. The Museum District, Montrose and downtown are separate areas kilometres apart.</p>

<p>METRORail is three short lines connecting downtown and the museums; everywhere else is by car.</p>

{{img:houston-metrorail}}

<h2>There isn't pavement everywhere</h2>

<p>Outside downtown the pavements break off and on some roads there are none at all. The city was built for cars, so pedestrian crossings are sparse too.</p>

<p>Walking those roads with a bag turns distances that look short into ones you can't actually walk.</p>

<h2>Two airports, in opposite directions</h2>

<p>Bush is thirty-seven kilometres north of the city, Hobby eighteen kilometres southeast. Connecting between them takes more than an hour.</p>

<p>Most international flights use Bush and leave in the evening; checkout is at noon.</p>

<h2>The space center is outside the city</h2>

<p>NASA's Space Center is forty kilometres southeast of the centre and takes half a day. There's screening at the entrance and large luggage isn't admitted.</p>

<p>The tours leave in the morning; anyone going on their checkout day has to leave the bag in town.</p>

<h2>The humidity matters more than the heat</h2>

<p>Between May and October the humidity is very high and you sweat even in shade. Short distances feel long with a bag.</p>

<h2>Downtown is quiet at weekends</h2>

<p>Downtown Houston is a business district and the streets empty at weekends. Some cafés open on weekdays only — and so do the tunnels.</p>

<p>Finding somewhere to wait on a Saturday afternoon is markedly harder than midweek.</p>

<h2>The Museum District is walked</h2>

<p>Nineteen museums cluster around Hermann Park and are walked between. All of them check bags at the door, and the cloakrooms are small.</p>
`.trim(),
    },
  ],
};
