import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "dublin",
  posts: [
    {
      locale: "tr",
      slug: "dublin-havalimanina-tren-yok-valiz",
      title: "Dublin Havalimanına Tren Gitmiyor: Otobüs, Trafik ve Elinizde Bir Bavul",
      excerpt:
        "İki ayrı gar, Temple Bar'ın taşları ve Guinness Storehouse — Dublin'de bavul nereye bırakılır?",
      cover: "dublin-temple-bar",
      body: `
<p>Dublin'de çoğu gezginin geç fark ettiği bir ayrıntı var: havalimanına tren ya da metro gitmiyor. Şehir merkezine bağlantı otobüsle sağlanıyor ve yolculuk trafiğe göre yarım saatle bir saat arasında değişiyor.</p>

<p>Bu, "bavulu havalimanına erken bırakırım" planını doğrudan ortadan kaldırıyor: gidiş dönüş rahat iki saat ve otobüste büyük valizle yer bulmak da ayrı bir iş.</p>

<h2>İki ayrı gar ve farklı hatlar</h2>

<p>Dublin'in iki ana garı var: Connolly kuzeyde, Heuston ise batıda. Belfast ve kuzey hatları Connolly'den, Cork ve Galway yönü Heuston'dan kalkıyor. Aralarında tramvayla yirmi dakika.</p>

{{img:dublin-connolly}}

<p>Yani bavulu hangi gara bırakacağınız hangi trene bineceğinize bağlı ve yanlış seçim gün sonunda şehri baştan sona geçmek demek.</p>

<h2>Temple Bar taş döşeli ve kalabalık</h2>

<p>Temple Bar'ın sokakları kaba taş döşeli ve akşamları çok kalabalık. Pub'lar küçük; müzik çalarken içeride durulacak yer zaten dar ve bir valizle o kalabalığa girmek mümkün değil.</p>

{{img:dublin-temple-bar}}

<p>Grafton Street yaya bölgesi ve gün boyu akış halinde; sokak müzisyenleri etrafında insanlar duruyor ve geçiş daralıyor.</p>

<h2>Trinity College ve Guinness saatli</h2>

<p>Trinity College'daki Book of Kells sergisi saatli girişle geziliyor ve büyük çantayla içeri alınmıyorsunuz. Guinness Storehouse ise merkezin iki kilometre batısında; orada da büyük bagaj kabul edilmiyor ve ziyaret iki saat sürüyor.</p>

<p>İkisi de randevu ya da sıra gerektiriyor. Bavulla o randevuya yetişmeye çalışmak, randevuyu kaçırmanın en kolay yolu.</p>

<h2>Yağmur her mevsim</h2>

<p>Dublin'de yağmur yılın her ayında olası ve genelde kısa ama sık geliyor. Sığınacak yer aramak bir pub'a ya da müzeye girmek demek; ikisi de bavulla zor.</p>

<h2>Kilmainham, Howth ve günübirlikler</h2>

<p>Kilmainham Gaol merkezin batısında ve saatli girişle geziliyor; Howth ve Bray gibi kıyı kasabalarına ise DART banliyö treniyle gidiliyor. Howth'ta uçurum yürüyüşü var — patika, toprak zemin ve rüzgâr.</p>

<p>Hepsi yarım günlük ve hepsi bavulsuz yapılıyor.</p>

<h2>BagajPark Dublin'de ne yapacak?</h2>

<p>BagajPark bavulu gara değil semte götürüyor: mahalledeki kafe, otel ve dükkanlarla anlaşıp emanet noktasına çeviriyoruz. Dublin'de Dublin Connolly ve Temple Bar çevresinde noktalar için hazırlık yapıyoruz — yani trenden indiğiniz yerde ve akşamı geçireceğiniz yerde.</p>

<p>İşleyiş şöyle: rezervasyonu telefondan yapıyorsunuz, bavulu bırakırken esnaf üzerine numaralı bir plastik mühür takıp fotoğraflıyor. Mühür kırılmadan çanta açılmıyor; siz alırken numarayı karşılaştırıyorsunuz. Ücret bavul başına ve günlük — havalimanı otobüsü trafiğe takılırsa ek ücret çıkmıyor.</p>

<p>Dublin noktalarımız henüz açık değil. Aramada görüyorsanız sebebi bu: hangi semtte gerçekten talep olduğunu ölçüyoruz ve esnafla önce orada anlaşıyoruz. Açılınca haber almak isterseniz nokta sayfasından e-postanızı bırakın.</p>
      `.trim(),
    },
    {
      locale: "en",
      slug: "dublin-luggage-storage-no-airport-train",
      title: "There Is No Train to Dublin Airport: a Bus, the Traffic, and a Suitcase in Your Hand",
      excerpt:
        "Two separate stations, the cobbles of Temple Bar and the Guinness Storehouse — where to leave your bag in Dublin.",
      cover: "dublin-temple-bar",
      body: `
<p>There is a detail most visitors work out late in Dublin: there is no train or metro to the airport. The connection into town is by bus, and the journey takes between half an hour and an hour depending on traffic.</p>

<p>That kills the "I'll drop the bag at the airport early" plan outright: out and back is a comfortable two hours, and finding room for a large case on the bus is its own task.</p>

<h2>Two stations on different lines</h2>

<p>Dublin has two main stations: Connolly to the north and Heuston to the west. Belfast and the northern lines go from Connolly, Cork and Galway from Heuston. They are twenty minutes apart by tram.</p>

{{img:dublin-connolly}}

<p>So which station you leave the bag at depends on which train you are catching, and the wrong choice means crossing the city at the end of the day.</p>

<h2>Temple Bar is cobbled and crowded</h2>

<p>The streets of Temple Bar are rough-paved and very busy in the evening. The pubs are small; with music playing there is barely room to stand inside, and getting into that crowd with a case is not possible.</p>

{{img:dublin-temple-bar}}

<p>Grafton Street is pedestrian and in constant flow; people stop around the buskers and the passage narrows.</p>

<h2>Trinity College and Guinness run on timed entry</h2>

<p>The Book of Kells exhibition at Trinity College runs on timed entry and you will not be admitted with a large bag. The Guinness Storehouse is two kilometres west of the centre; large luggage is refused there too and the visit takes two hours.</p>

<p>Both involve a slot or a queue. Trying to make one while towing a case is the easiest way to miss it.</p>

<h2>Rain in every season</h2>

<p>Rain is possible in any month here, usually brief but frequent. Finding shelter means going into a pub or a museum, and both are difficult with a case.</p>

<h2>Kilmainham, Howth and the day trips</h2>

<p>Kilmainham Gaol is west of the centre and runs on timed entry; coastal towns like Howth and Bray are reached on the DART commuter line. Howth has the cliff walk — a footpath, earth underfoot and wind.</p>

<p>All half-day outings, and all done without luggage.</p>

<h2>What BagajPark will do in Dublin</h2>

<p>BagajPark moves storage out of the station and into the neighbourhood: we partner with local cafes, hotels and shops and turn them into drop-off points. In Dublin we are preparing points around Connolly and Temple Bar — where you arrive and where you spend the evening.</p>

<p>It works like this. You book from your phone. When you hand the bag over, the shopkeeper fits a numbered plastic seal to it and photographs it. It cannot be opened without breaking the seal, and you check the number when you collect. Pricing is per bag and per day, so an airport bus stuck in traffic costs you nothing extra.</p>

<p>Our Dublin points are not open yet. That is why you may see them in search: we are measuring which areas the demand is really in, and that is where we sign up shopkeepers first. Leave your email on a point's page to hear when it opens.</p>
      `.trim(),
    },
  ],
};
