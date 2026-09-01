import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "toronto",
  posts: [
    {
      locale: "tr",
      slug: "toronto-path-yeralti-agi-union-station-valiz",
      title: "Toronto'da Kışın Herkes Yerin Altından Yürüyor",
      excerpt:
        "PATH otuz kilometrelik bir yeraltı yaya ağı ve kışın şehrin asıl yolu. Ama bir labirent ve her bağlantıda merdiven var.",
      cover: "toronto-union",
      body: `
<p>Toronto kışı sert: sıcaklık eksi yirmiye iniyor ve rüzgâr göl üzerinden geliyor. Şehir bunun üzerine bir çözüm kurmuş — PATH.</p>

<p>PATH, şehir merkezinin altında uzanan otuz kilometrelik bir yaya tüneli ağı. Ofis kuleleri, alışveriş merkezleri, oteller ve metro istasyonları birbirine bağlanıyor.</p>

{{img:toronto-union}}

<h2>Ama bir labirent</h2>

<p>Ağ tek bir koridor değil; binaların bodrum katlarını birleştiren bir örgü. Yön levhaları var ama bina değiştikçe tabela düzeni de değişiyor.</p>

<p>Bavulla bu ağın içinde doğru çıkışı aramak, kışın dışarıda yürümekten daha uzun sürebiliyor. Her bina geçişinde merdiven ya da yürüyen merdiven çıkıyor karşınıza.</p>

<h2>Union Station her şeyin merkezi</h2>

<p>VIA Rail, banliyö trenleri, metro ve havalimanı ekspresi Union Station'da birleşiyor. Bina büyük ve katlı; hatlar arası geçiş uzun koridorlardan yapılıyor.</p>

<p>Havalimanına giden UP Express yirmi beş dakikada Pearson'a varıyor — bu gerçekten pratik. Ama gardan çıkıp şehre girmek başlı başına bir yolculuk.</p>

<h2>Şehir ızgara planlı ama bloklar uzun</h2>

<p>Toronto merkezi ızgara planlı ve yön bulmak kolay. Ama bloklar uzun; Union Station'dan Dundas Meydanı'na yürümek yirmi dakika sürüyor.</p>

<p>Kışın o yirmi dakikayı açık havada yapmak istemiyorsunuz, PATH'e iniyorsunuz — ve orada da merdivenler başlıyor.</p>

<h2>CN Kulesi'nde çanta kontrolü var</h2>

<p>CN Kulesi'ne girişte havalimanı tipi kontrol yapılıyor ve büyük bagaj kabul edilmiyor. Bilet saatli ve asansör kuyruğu uzun.</p>

{{img:toronto-cn-kule}}

<h2>Tramvaylar zemin seviyesinden</h2>

<p>Toronto'nun caddelerinde yürüyen tramvaylar zemin seviyesinden biniliyor ve rampalı. Bu, metroya göre bavulla binmeyi kolaylaştırıyor.</p>

<p>Ama duraklar caddenin ortasında ve karşıya geçmek gerekiyor; kışın o adacıklar karla kaplı oluyor.</p>

<h2>Niagara günübirlik</h2>

<p>Niagara Şelaleleri'ne otobüsle bir buçuk iki saat ve turlar sabah kalkıp akşam dönüyor. Araçlarda bavul için yer yok.</p>

<p>Çıkış gününde bu turu yapmak isteyen biri bavulunu şehirde bırakmak zorunda.</p>

<h2>Havalimanı yirmi beş kilometre</h2>

<p>Pearson Havalimanı merkeze yirmi beş kilometre. Billy Bishop ise adada ve merkeze çok yakın; oraya yaya tüneliyle geçiliyor.</p>

<p>Hangi havalimanına ineceğiniz günün şeklini belirliyor ama otel çıkışı ile uçuş arasındaki boşluk her iki durumda da var.</p>

<h2>Kensington ve St. Lawrence pazarları dar</h2>

<p>Kensington Market'in sokakları dar ve dükkânlar kaldırıma taşıyor; St. Lawrence Market ise kapalı bir yapı ve koridorları sıkışık. İkisi de yürüyerek geziliyor.</p>

<p>Bavulla o koridorlarda ilerlemek yavaş, hafta sonu ise neredeyse durmak demek.</p>

<h2>Yaz aylarında göl kıyısı</h2>

<p>Yazın Harbourfront ve göl kenarı yürüyüş yolu şehrin en iyi kısmı; adalara feribotlar da buradan kalkıyor. Feribotta bagaj için yer yok ve adalarda bırakacak yer de yok.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "toronto-luggage-storage-path-network",
      title: "In a Toronto Winter Everyone Walks Underground",
      excerpt:
        "The PATH is a thirty-kilometre pedestrian network and the city's real route in winter. It's also a maze with stairs at every junction.",
      cover: "toronto-union",
      body: `
<p>Toronto winters are hard: temperatures drop to minus twenty and the wind comes off the lake. The city built an answer to that — the PATH.</p>

<p>The PATH is thirty kilometres of pedestrian tunnels under downtown, linking office towers, malls, hotels and subway stations.</p>

{{img:toronto-union}}

<h2>But it's a maze</h2>

<p>It isn't one corridor; it's a web joining the basements of buildings. There is signage, but the system changes as you pass from one building to the next.</p>

<p>Hunting for the right exit down there with a bag can take longer than walking outside in the cold. Every building transition brings another set of stairs or escalators.</p>

<h2>Union Station is the centre of everything</h2>

<p>VIA Rail, the commuter trains, the subway and the airport express all meet at Union Station. The building is large and multi-level, with long corridors between services.</p>

<p>The UP Express reaches Pearson in twenty-five minutes, which is genuinely useful. But getting out of the station and into the city is a journey in itself.</p>

<h2>The CN Tower checks bags</h2>

<p>Entry to the CN Tower involves airport-style screening and large luggage isn't admitted. The ticket is timed and the lift queue is long.</p>

{{img:toronto-cn-kule}}

<h2>Niagara is a day trip</h2>

<p>Niagara Falls is an hour and a half to two hours by coach, and the tours leave in the morning and return in the evening. There's no room for luggage on board.</p>

<p>Anyone doing that on their checkout day has to leave the bag in the city.</p>

<h2>The airport is twenty-five kilometres out</h2>

<p>Pearson is twenty-five kilometres from downtown. Billy Bishop sits on an island very close to the centre, reached by a pedestrian tunnel.</p>

<p>Which airport you use shapes the day, but the gap between checkout and the flight exists either way.</p>

<h2>Kensington and St. Lawrence markets are tight</h2>

<p>Kensington Market's streets are narrow with shops spilling onto the pavement; St. Lawrence Market is an indoor hall with cramped aisles. Both are walked.</p>

<p>Getting through with a bag is slow, and at the weekend it's close to standing still.</p>

<h2>The lakefront in summer</h2>

<p>In summer the Harbourfront and the lakeside path are the best of the city, and the island ferries leave from there. The ferries have no luggage space and there's nowhere to leave anything on the islands.</p>
`.trim(),
    },
  ],
};
