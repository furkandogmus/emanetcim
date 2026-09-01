import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "fukuoka",
  posts: [
    {
      locale: "tr",
      slug: "fukuoka-havalimani-bes-dakika-yatai-valiz",
      title: "Fukuoka'da Havalimanı Metroyla Beş Dakika — Bu Bir Sorun da Yaratıyor",
      excerpt:
        "Hakata'dan havalimanına iki durak. Bu kadar yakın olunca insanlar uçuş gününü de şehirde geçiriyor ve bavul ortada kalıyor.",
      cover: "fukuoka-hakata",
      body: `
<p>Fukuoka Havalimanı, Japonya'da şehir merkezine en yakın büyük havalimanı olarak biliniyor. Hakata istasyonundan metroyla iki durak, yani beş altı dakika.</p>

<p>Bu yakınlık şehri çok pratik yapıyor. Ama bir yan etkisi de var: kimse uçuşundan saatler önce havalimanına gitmiyor. Herkes günü şehirde geçirip son anda metroya biniyor — bavuluyla birlikte.</p>

{{img:fukuoka-hakata}}

<h2>Yatai tezgâhları akşam kuruluyor</h2>

<p>Fukuoka'nın en bilinen yanı yatai denen sokak yemeği tezgâhları. Nakasu'da nehir kıyısına ve Tenjin çevresine akşamüstü kuruluyor, gece yarısına kadar açık kalıyor.</p>

{{img:fukuoka-yatai}}

<p>Bu tezgâhlar gerçekten küçük: bir tenteyle örtülü tezgâh ve etrafında sekiz on tabure. Ayak altında bavul için yer yok ve tezgâh sahibi de saklayamıyor.</p>

<p>Yani akşam uçağı olan biri için "son bir kase ramen" planı, bavulun nerede durduğuna bağlı.</p>

<h2>Hakata ve Tenjin iki ayrı merkez</h2>

<p>Şehrin iki merkezi var: Hakata istasyon çevresi ve iki durak batıdaki Tenjin. Alışveriş ve yeme içmenin çoğu Tenjin'de, ulaşımın çoğu Hakata'da.</p>

<p>Gün içinde bu ikisi arasında gidip gelmek olağan. Her geçiş bir metro yolculuğu ve yoğun saatlerde vagonlar dolu.</p>

<h2>Kyushu'nun kapısı</h2>

<p>Hakata, Sanyo Shinkansen'in son durağı ve Kyushu hattının başlangıcı. Nagasaki, Kumamoto, Kagoshima ve Beppu buradan bağlanıyor.</p>

<p>Bu, Fukuoka'yı klasik bir aktarma şehri yapıyor: Osaka'dan gelip Kyushu'ya devam edenler burada birkaç saat geçiriyor.</p>

<h2>Busan feribotu limandan</h2>

<p>Kore'ye giden feribotlar Hakata limanından kalkıyor. Hızlı tekne yaklaşık üç buçuk saatte Busan'a varıyor; gece feribotu ise akşam kalkıp sabah varıyor.</p>

<p>Liman merkeze birkaç kilometre ve otobüsle gidiliyor. Gece feribotuna binecek biri için gün yine ortada kalıyor: otelden çıkış öğlen, geminin kalkışı akşam.</p>

<h2>Ohori Parkı ve kale kalıntıları</h2>

<p>Merkeze yakın Ohori Parkı ve yanındaki Fukuoka Kalesi kalıntıları yürüyerek geziliyor. Park geniş ve göl çevresinde bir tur bir saat sürüyor — bavulla yapılacak bir yürüyüş değil.</p>

<h2>Dazaifu ve Itoshima yarım gün</h2>

<p>Dazaifu Tenmangu tapınağına trenle yarım saat; Itoshima kıyısına ise otobüsle bir saat. İkisi de yarım günlük klasik geziler ve ikisinde de bavul taşımak anlamsız.</p>

<p>Dazaifu'ya giden yol tapınak öncesinde uzun bir dükkân sokağından geçiyor ve o sokak hafta sonu tıklım tıklım oluyor.</p>

<h2>Canal City ve yeraltı geçitleri</h2>

<p>Hakata ile Tenjin arasında yeraltı alışveriş geçitleri var ve yağmurlu günlerde herkes oradan yürüyor. Koridorlar dar, mağaza girişleri koridora açılıyor.</p>

<p>Bavulla bu geçitlerde ilerlemek, yağmurdan kaçmanın bedeli oluyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "fukuoka-luggage-storage-airport-yatai",
      title: "Fukuoka's Airport Is Five Minutes by Subway — Which Creates a Problem",
      excerpt:
        "Two stops from Hakata. Because it's that close, nobody leaves early — they spend the whole day in town, bag and all.",
      cover: "fukuoka-hakata",
      body: `
<p>Fukuoka airport is known as the major Japanese airport closest to its city centre. Two subway stops from Hakata Station — five or six minutes.</p>

<p>That proximity makes the city extremely convenient. It has a side effect, though: nobody goes to the airport hours early. Everyone spends the day in town and gets on the subway at the last minute, luggage included.</p>

{{img:fukuoka-hakata}}

<h2>The yatai are set up in the evening</h2>

<p>Fukuoka is best known for its yatai, the street food carts. They appear along the river at Nakasu and around Tenjin in the late afternoon and stay open until the small hours.</p>

{{img:fukuoka-yatai}}

<p>They are genuinely small: a counter under an awning with eight or ten stools around it. There is no floor space for a suitcase, and the owner can't stash it either.</p>

<p>So for someone on an evening flight, the plan of "one last bowl of ramen" depends entirely on where the bag is.</p>

<h2>Hakata and Tenjin are two separate centres</h2>

<p>The city has two hearts: the area around Hakata Station, and Tenjin two stops west. Most of the shopping and eating is in Tenjin, most of the transport in Hakata.</p>

<p>Moving between them during the day is normal. Each crossing is a subway ride, and the carriages are full at peak hours.</p>

<h2>The gateway to Kyushu</h2>

<p>Hakata is the terminus of the Sanyo Shinkansen and the start of the Kyushu line. Nagasaki, Kumamoto, Kagoshima and Beppu all connect through it.</p>

<p>That makes Fukuoka a classic interchange city: people arriving from Osaka and continuing into Kyushu spend a few hours here.</p>

<h2>The Busan ferry leaves from the port</h2>

<p>Ferries to Korea sail from Hakata port. The fast craft reaches Busan in about three and a half hours; the night ferry leaves in the evening and arrives in the morning.</p>

<p>The port is a few kilometres from the centre and reached by bus. Anyone taking the night boat has the same gap again: checkout at noon, sailing in the evening.</p>

<h2>Ohori Park and the castle ruins</h2>

<p>Ohori Park and the ruins of Fukuoka Castle beside it are close to the centre and walked. The park is large and a circuit of the lake takes an hour — not a walk to do with a case.</p>
`.trim(),
    },
  ],
};
