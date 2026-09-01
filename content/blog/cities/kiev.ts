import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "kiev",
  posts: [
    {
      locale: "tr",
      slug: "kiev-gece-treniyle-varis-sokaga-cikma-yasagi-valiz",
      title: "Kiev'e Uçakla Değil, Gece Treniyle Geliniyor",
      excerpt:
        "Hava sahası kapalı olduğu için varış Polonya sınırından gece treniyle oluyor. Gece saatlerinde sokağa çıkma kısıtı da var.",
      cover: "kiev-sofya",
      body: `
<p>Kiev'e ulaşım bugün başka bir şehre gitmeye benzemiyor. Ülkenin hava sahası kapalı, yani uçak seçeneği yok. Gelenler Polonya sınırındaki Przemyśl ya da Chełm'den gece treniyle geliyor.</p>

<p>Yolculuk on saatten uzun sürüyor ve yataklı vagonlarla yapılıyor. Kompartımanlarda bagaj yeri sınırlı: yatakların altı ve üst raflar.</p>

{{img:kiev-gar}}

<h2>Tren sabah erken bırakıyor</h2>

<p>Gece trenleri Kiev'e sabahın erken saatlerinde varıyor. Konaklamalarda giriş saati ise öğleden sonra; yani aradaki saatler bavulla geçiyor.</p>

<p>Ayrılışta da aynısı: tren akşam kalkıyor ve otelden öğlen çıkılmış oluyor.</p>

<h2>Gece saatlerinde sokağa çıkma kısıtı var</h2>

<p>Ülke genelinde gece saatlerinde sokağa çıkma kısıtı uygulanıyor. Bu, akşamdan sonra dışarıda bavulla dolaşmanın mümkün olmadığı anlamına geliyor.</p>

<p>Yani şehirde geçirilecek süre gündüz saatleriyle sınırlı ve o saatlerin verimli kullanılması gerekiyor.</p>

<h2>Otel yerine kısa dönem daire yaygın</h2>

<p>Kiev'de konaklamanın önemli bir kısmı kısa dönem kiralanan dairelerde ve giriş anahtar tesliminde oluyor. Ev sahibiyle buluşmak gerekiyor ve saat sabit değil.</p>

<p>Sabah trenle inen biri için bu, buluşma saatine kadar bavulla beklemek demek.</p>

<h2>Metro çok derin</h2>

<p>Kiev metrosu dünyanın en derin istasyonlarından bazılarına sahip; Arsenalna yüz metrenin altında ve yürüyen merdiven dakikalarca sürüyor.</p>

<p>Bu derinlik bir sebeple: istasyonlar aynı zamanda sığınak olarak kullanılıyor. Bavulla o merdivenlerde durmak, iniş süresi boyunca bavulu tutmak demek.</p>

<h2>Şehir tepelerin üstünde</h2>

<p>Kiev Dinyeper'in batı yakasındaki tepelere kurulu. Aziz Sofya ve Mihail Manastırı yukarıda; Podil mahallesi ise nehir seviyesinde ve arada füniküler var.</p>

{{img:kiev-sofya}}

<p>Füniküler kabinleri küçük ve bagaj için yer yok; alternatif merdiven ya da uzun bir yokuş.</p>

<h2>Sınırdan varış uzun sürüyor</h2>

<p>Polonya tarafındaki sınır geçişi tren üzerinde yapılıyor ve saatler alabiliyor; bagajlar kontrol ediliyor ve vagonda beklemek gerekiyor.</p>

<p>Yani yolculuk ilan edilen süreden uzun sürebiliyor ve varış saati kesin değil. Bu belirsizlik, varışta bir plan yapmayı zorlaştırıyor.</p>

<h2>Khreşçatik hafta sonu yayalaşıyor</h2>

<p>Ana cadde Khreşçatik hafta sonları trafiğe kapanıyor ve Maidan çevresi kalabalıklaşıyor. Cadde geniş ve düz.</p>

<h2>Podil ve nehir kıyısı düz</h2>

<p>Podil, Kiev'in nehir seviyesindeki eski ticaret mahallesi ve tepedeki merkezin aksine düz. Kontraktova Meydanı çevresindeki sokaklar taş döşeli ve yürüyerek geziliyor.</p>

<p>Yani şehri gezmek yukarı ile aşağı arasında gidip gelmek demek — ve o geçişte ya füniküler ya da uzun bir yokuş var.</p>

<h2>Program değişebilir</h2>

<p>Alarm dönemlerinde müzeler ve mekânlar kapanabiliyor, ulaşım durabiliyor. Bu, planlanan bir gezinin ortada kesilmesi ve elinizde bavulla beklemek anlamına gelebiliyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "kyiv-luggage-storage-overnight-train-curfew",
      title: "You Don't Fly Into Kyiv — You Arrive on the Overnight Train",
      excerpt:
        "The airspace is closed, so arrivals come by sleeper from the Polish border. And a curfew applies at night.",
      cover: "kiev-sofya",
      body: `
<p>Getting to Kyiv today is not like travelling to another city. The country's airspace is closed, so flying isn't an option. People arrive on the overnight train from Przemyśl or Chełm on the Polish border.</p>

<p>The journey runs over ten hours in sleeper carriages. Luggage space in the compartments is limited to the area under the berths and the overhead racks.</p>

{{img:kiev-gar}}

<h2>The train arrives early in the morning</h2>

<p>The night trains reach Kyiv in the early hours. Accommodation checks in during the afternoon, so the hours in between are spent with the bag.</p>

<p>Leaving is the same in reverse: the train goes in the evening and you checked out at noon.</p>

<h2>A curfew applies at night</h2>

<p>A nationwide curfew is in force during night hours. That means being outside with luggage after the evening simply isn't possible.</p>

<p>So time in the city is limited to daylight, and those hours need to count.</p>

<h2>The metro is very deep</h2>

<p>Kyiv has some of the deepest metro stations in the world; Arsenalna is over a hundred metres down and the escalator ride takes minutes.</p>

<p>That depth has a reason: the stations also serve as shelters. Standing on those escalators with a bag means holding it for the length of the descent.</p>

<h2>The city sits on hills</h2>

<p>Kyiv is built on the hills of the Dnipro's west bank. Saint Sophia and St Michael's are up top; the Podil district is down at river level, with a funicular between them.</p>

{{img:kiev-sofya}}

<p>The funicular cabins are small with no luggage space; the alternative is stairs or a long climb.</p>

<h2>Khreshchatyk pedestrianises at weekends</h2>

<p>The main street, Khreshchatyk, closes to traffic at weekends and the area around Maidan fills up. The street is wide and flat.</p>

<h2>Podil and the riverside are flat</h2>

<p>Podil, Kyiv's old merchant quarter at river level, is flat — unlike the centre on the hill above. The streets around Kontraktova Square are cobbled and walked.</p>

<p>So seeing the city means moving between upper and lower town, and that crossing is either the funicular or a long climb.</p>

<h2>Plans can change</h2>

<p>During alerts, museums and venues close and transport can stop. A planned outing may be cut short — leaving you waiting somewhere with your bag.</p>
`.trim(),
    },
  ],
};
