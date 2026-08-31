import type { CityBlogEntry } from "../types";

/**
 * SLUG'LAR KORUNDU. Bu iki yazı daha önce `src/lib/blog-initializer.ts`
 * içindeki `DEFAULT_POSTS` dizisindeydi ve yayındaydı; gövde tamamen yeniden
 * yazıldı ama URL aynı bırakıldı — slug değiştirmek arama motorundaki mevcut
 * konumu ve paylaşılmış bağlantıları çöpe atardı.
 */
export const entry: CityBlogEntry = {
  cityKey: "istanbul",
  posts: [
    {
      locale: "tr",
      slug: "istanbul-valiz-emanet-rehberi",
      title: "İstanbul'da Valiz Nereye Bırakılır? Sultanahmet, Karaköy ve Kadıköy İçin Saha Notları",
      excerpt:
        "Otele 14:00'ten önce giremeyenler, öğlen çıkıp gece uçanlar ve iki kıtayı bir günde gezmeye çalışanlar için: İstanbul'da bavul gerçekte nereye bırakılır.",
      cover: "istanbul-sultanahmet",
      body: `
<p>İstanbul'a gelen hemen herkes aynı iki saat diliminden birine denk geliyor. Ya sabah erken iniyorsunuz ve otel odası 14:00'ten önce hazır olmuyor; ya da öğlen otelden çıkıyorsunuz ve uçağınız gece. İki durumda da elinizde bir valiz ve önünüzde yarım gün var.</p>

<p>Bu şehirde o yarım gün, valizin nerede olduğuna göre ya İstanbul'un en iyi günü ya da en yorucu günü oluyor. Aşağıdakiler yıllardır aynı sorunu yaşayan insanlardan ve kendi yürüyüşlerimizden çıkan notlar.</p>

<h2>Sultanahmet: müzelerin hiçbiri valizinizi almıyor</h2>

<p>Ayasofya, Topkapı Sarayı, Yerebatan Sarnıcı ve Sultanahmet Camii'nin girişlerinde güvenlik kontrolü var ve büyük bavullarla içeri alınmıyorsunuz. Bunların hiçbirinde bagaj emaneti de yok. Topkapı özellikle sert bir örnek: avludan Harem'e ve oradan Bağdat Köşkü'ne kadar epey yol var, ziyaret rahat iki saat sürüyor ve o iki saat boyunca valizinizi kapıda bırakacağınız bir yer yok.</p>

{{img:istanbul-sultanahmet}}

<p>Bir de zemin var. Sultanahmet'in sokakları arnavut kaldırımı; Ayasofya'dan Kapalıçarşı'ya yürümek sürekli hafif bir yokuş. Küçük tekerlekli bir kabin valizi bu taşlarda ya devriliyor ya tekerleği eziliyor.</p>

<h2>Sirkeci: gar artık gar değil, ama düğüm noktası</h2>

<p>Sirkeci Garı'nın tarihi binası bugün intercity trenlerin kalktığı yer değil; Marmaray'ın Sirkeci istasyonu yer altında ve Halkalı ile Gebze arasında iki kıtayı bağlıyor. Yani Avrupa yakasından Asya yakasına valizle geçmek isteyen çoğu insan buradan geçiyor.</p>

{{img:istanbul-sirkeci}}

<p>Marmaray'da turnikelerden geçerken büyük bir valizle uğraşmak yoğun saatlerde ciddi bir sorun. Akşam 17:00–19:00 arasında Sirkeci ve Üsküdar'da vagonlar dolu; bir bavulla o kalabalığa girmek hem size hem herkese eziyet.</p>

<h2>Eminönü ve vapurlar: İstanbul'un en iyi yirmi dakikası</h2>

<p>Eminönü'nden Kadıköy'e ya da Üsküdar'a giden vapur, şehirde para karşılığı alabileceğiniz en iyi manzara. Yirmi dakika sürüyor, çay içiliyor, martı besleniyor. Vapura valizle binmek yasak değil ama güverte iskemleleri dar ve iniş binişte rampa kalabalık oluyor.</p>

{{img:istanbul-eminonu}}

<p>Mısır Çarşısı hemen iskelenin arkasında, Kapalıçarşı yukarıda. İkisi de dar, kalabalık ve valizle girilmeyecek yerler. Eminönü'nde bavulu bırakıp vapura binmek, bu bölgeyi gezmenin tek makul yolu.</p>

<h2>Karaköy ve Galata: yokuş şaka değil</h2>

<p>Galataport açıldığından beri kruvaziyer yolcuları doğrudan Karaköy'e iniyor ve şehre yürüyerek karışıyor. Güzel — ta ki Galata Kulesi'ne çıkmaya karar edene kadar. Karaköy'den kuleye çıkan sokaklar dik ve merdivenli. Tünel füniküleri kısa bir kurtarıcı ama sizi kulenin dibine bırakmıyor.</p>

{{img:istanbul-galata}}

<p>İstiklal Caddesi'ne Tünel'den girip Taksim'e yürümek yaklaşık bir buçuk kilometre. Kalabalık bir caddede valizle bu yolu yapmak, caddeyi hiç görmemekle eşdeğer.</p>

<h2>Otogar ve havalimanları: hepsi merkezin dışında</h2>

<p>İstanbul Otogarı Bayrampaşa'da, M1 metro hattının üzerinde. Havalimanı şehrin kuzeybatısında, kırk kilometreden uzak; Sabiha Gökçen ise Asya yakasında. Yani "bavulu havalimanına bırakıp şehre dönerim" planı İstanbul'da hiç işlemiyor — gidiş dönüş üç saatinizi alır.</p>

<p>Havaist otobüsleri Taksim, Beşiktaş ve Kadıköy gibi noktalardan kalkıyor. Uçuş saatinizden geriye doğru hesap yaparken trafiği ciddiye alın: aynı yol öğlen 45 dakika, akşam 5'te bir buçuk saat sürüyor.</p>

<h2>Kadıköy: kalabalıktan kaçmanın en kolay yolu</h2>

<p>Yarım gününüz varsa ve Sultanahmet'i zaten gördüyseniz, Kadıköy iyi bir fikir. Çarşısı, Moda'ya inen sahil yürüyüşü ve Bahariye'nin kitapçıları turistik yoğunluğun dışında. Ama Kadıköy de yürüme şehri; çarşının sokakları dar ve eğimli, valizle keyfi kaçıyor.</p>

<h2>BagajPark İstanbul'da ne yapıyor?</h2>

<p>BagajPark bavulu havalimanına ya da otogara değil, semte götürüyor: mahalledeki kafe, otel ve dükkanlarla anlaşıp emanet noktasına çeviriyoruz. İstanbul'da Sultanahmet, Taksim, Kadıköy, Eminönü, Beşiktaş, Galata, Sirkeci Garı, Üsküdar, Ortaköy ve İstanbul Otogarı çevresinde noktalar için hazırlık yapıyoruz.</p>

<p>İşleyiş şöyle: rezervasyonu telefondan yapıyorsunuz, bavulu bırakırken esnaf üzerine numaralı bir plastik mühür takıp fotoğraflıyor. Mühür kırılmadan çanta açılmıyor; siz alırken numarayı karşılaştırıyorsunuz. Ücret bavul başına ve günlük hesaplanıyor, yani vapur geciktiğinde ek ücret çıkmıyor.</p>

<p>İstanbul'daki noktalarımızın çoğu henüz açık değil. Aramada görüyorsanız sebebi bu: hangi semtte gerçekten talep olduğunu ölçüyoruz ve esnafla önce orada anlaşıyoruz. Açılınca haber almak isterseniz nokta sayfasından e-postanızı bırakın.</p>
      `.trim(),
    },
    {
      locale: "en",
      slug: "istanbul-luggage-storage-guide",
      title: "Where to Leave Your Bags in Istanbul: Field Notes on Sultanahmet, Karakoy and Kadikoy",
      excerpt:
        "For anyone who lands before the 2pm check-in, checks out at noon with a night flight, or tries to cross two continents in a day — where the suitcase actually goes in Istanbul.",
      cover: "istanbul-sultanahmet",
      body: `
<p>Almost everyone who comes to Istanbul hits one of the same two windows. Either you land early and the hotel room is not ready before two in the afternoon, or you check out at noon and your flight is at night. Either way there is a suitcase in your hand and half a day ahead of you.</p>

<p>In this city that half day is either the best day of the trip or the most exhausting one, and the difference is mostly about where the bag is. What follows are notes from our own walks and from people who keep running into the same problem.</p>

<h2>Sultanahmet: none of the museums will take your bag</h2>

<p>Hagia Sophia, Topkapi Palace, the Basilica Cistern and the Blue Mosque all have security checks at the entrance, and large suitcases do not get through. None of them offers left luggage either. Topkapi is the hardest case: it is a long way from the outer courtyard through the Harem to the Baghdad Pavilion, the visit takes a comfortable two hours, and for those two hours there is nowhere at the gate to leave anything.</p>

{{img:istanbul-sultanahmet}}

<p>Then there is the ground itself. Sultanahmet's streets are cobbled, and the walk from Hagia Sophia up to the Grand Bazaar is a constant gentle climb. Small cabin-bag wheels either jam or snap on those stones.</p>

<h2>Sirkeci: no longer a terminus, still a hinge</h2>

<p>The historic Sirkeci station building is no longer where intercity trains depart. The Marmaray station sits underground beneath it and links Halkali to Gebze — which means most people crossing from the European to the Asian side with a bag pass through here.</p>

{{img:istanbul-sirkeci}}

<p>Wrestling a large suitcase through Marmaray turnstiles at rush hour is a genuine problem. Between five and seven in the evening the carriages at Sirkeci and Uskudar are full, and adding a suitcase to that crowd is hard on you and on everyone else.</p>

<h2>Eminonu and the ferries: the best twenty minutes in the city</h2>

<p>The ferry from Eminonu to Kadikoy or Uskudar is the best view money can buy in Istanbul. Twenty minutes, a glass of tea, a seagull following the stern. Bringing a bag aboard is not forbidden, but the deck seating is tight and the boarding ramp gets crowded.</p>

{{img:istanbul-eminonu}}

<p>The Spice Bazaar is directly behind the pier and the Grand Bazaar is up the hill. Both are narrow, packed, and no place for a suitcase. Leaving the bag in Eminonu and getting on the ferry is really the only sensible way to see this part of town.</p>

<h2>Karakoy and Galata: the hill is not a joke</h2>

<p>Since Galataport opened, cruise passengers step straight out into Karakoy and walk into the city. Excellent — right up until you decide to go up to the Galata Tower. The streets from Karakoy up to the tower are steep and partly stepped. The Tunel funicular helps, but it does not put you at the foot of the tower.</p>

{{img:istanbul-galata}}

<p>From Tunel along Istiklal to Taksim is about a kilometre and a half on a very crowded street. Doing that with a suitcase is more or less the same as not seeing the street at all.</p>

<h2>The bus terminal and the airports are all outside the centre</h2>

<p>Istanbul's main bus terminal is in Bayrampasa on the M1 metro line. Istanbul Airport is more than forty kilometres out to the northwest, and Sabiha Gokcen is on the Asian side. So the "drop the bag at the airport and come back into town" plan simply does not work here — the round trip costs you three hours.</p>

<p>Havaist coaches run from Taksim, Besiktas and Kadikoy among others. When you count backwards from your flight, take the traffic seriously: the same road takes 45 minutes at midday and an hour and a half at five in the afternoon.</p>

<h2>Kadikoy: the easiest way out of the crowds</h2>

<p>If you have half a day and have already seen Sultanahmet, Kadikoy is a good idea. The market, the seafront walk down to Moda and the bookshops of Bahariye are all outside the tourist crush. But Kadikoy is a walking district too — its market lanes are narrow and sloped, and a suitcase takes the pleasure out of it.</p>

<h2>What BagajPark is doing in Istanbul</h2>

<p>BagajPark moves storage out of the airport and the coach terminal and into the neighbourhood: we partner with local cafes, hotels and shops and turn them into drop-off points. In Istanbul we are preparing points around Sultanahmet, Taksim, Kadikoy, Eminonu, Besiktas, Galata, Sirkeci station, Uskudar, Ortakoy and the main bus terminal.</p>

<p>It works like this. You book from your phone. When you hand the bag over, the shopkeeper fits a numbered plastic seal to it and photographs it. It cannot be opened without breaking that seal, and you check the number when you collect. Pricing is per bag and per day, so a late ferry does not cost you extra.</p>

<p>Most of our Istanbul points are not open yet. That is why you may see them in search: we are measuring which districts the demand is actually in, and that is where we sign up shopkeepers first. Leave your email on a point's page and you will hear when it opens.</p>
      `.trim(),
    },
  ],
};
