import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "milano",
  posts: [
    {
      locale: "tr",
      slug: "milano-centrale-aktarma-valiz",
      title: "Milano Çoğu Kişi İçin Bir Aktarma: Centrale'de Geçen O Dört Saat",
      excerpt:
        "Duomo'nun güvenlik kapısı, Malpensa Express ve Navigli — Milano'da bavul nereye bırakılır?",
      cover: "milano-duomo",
      body: `
<p>Milano'ya gelenlerin büyük kısmı Milano'da kalmıyor. Şehir İtalya'nın kuzey kapısı: Venedik'e, Floransa'ya, Como'ya ve İsviçre'ye trenler buradan kalkıyor, uzun uçuşlar Malpensa'ya iniyor. Yani tipik Milano ziyareti bir aktarma ve arada dört beş saat oluyor.</p>

<p>O dört saati Centrale'nin salonunda geçirmek zorunda değilsiniz — Duomo metroyla on dakika. Ama bavulunuz yanınızdaysa başka türlüsü olmuyor.</p>

<h2>Centrale'de emanet var, sırası da var</h2>

<p>Milano Centrale'de bagaj deposu bulunuyor. Ücret süre üzerinden işliyor, girişte güvenlik taraması var ve sabah–akşamüstü kuyruk uzuyor. İstasyon çok büyük ve depo peronlardan uzakta; bulup teslim etmek başlı başına yirmi dakika.</p>

{{img:milano-centrale}}

<p>Bir de Malpensa Express meselesi var: tren Centrale ve Cadorna'dan kalkıyor ve yaklaşık elli dakika sürüyor. Yani günün sonunda hangi istasyonda olacağınız baştan belli — ve bavulu doğru yere bırakmak bir saat kazandırıyor.</p>

<h2>Duomo'ya büyük çantayla girilmiyor</h2>

<p>Duomo girişinde güvenlik kontrolü var ve büyük bagajlar içeri alınmıyor. Terasa çıkmak isterseniz — ki Milano'da yapılacak en iyi şey o — merdiven ya da asansörle çıkılıyor ve yanınıza valiz alamıyorsunuz.</p>

{{img:milano-duomo}}

<p>Son Akşam Yemeği'ni görmek için ise saatli giriş gerekiyor; randevunuza dakikası dakikasına gitmeniz isteniyor ve orada da büyük çanta kabul edilmiyor. Bavulla bu randevuya yetişmeye çalışmak, randevuyu kaçırmanın en kolay yolu.</p>

<h2>Galleria ve moda mahallesi yürüyerek</h2>

<p>Galleria Vittorio Emanuele, Duomo Meydanı'ndan La Scala'ya açılıyor ve gün boyu kalabalık. Quadrilatero della Moda'nın sokakları ise dar ve zemin çoğu yerde taş. Alışveriş için gelen biri, iki elinin serbest olmasını istiyor.</p>

<h2>Navigli akşam kalabalığı</h2>

<p>Navigli kanallarının kıyısı akşamüstü aperitivo için doluyor. Masalar sokağa taşıyor ve aralar dar; yanınızda bir valizle o kalabalığa girmek hem zor hem de akşamın tadını kaçırıyor.</p>

<h2>BagajPark Milano'da ne yapacak?</h2>

<p>BagajPark bavulu gara değil semte götürüyor: mahalledeki kafe, otel ve dükkanlarla anlaşıp emanet noktasına çeviriyoruz. Milano'da Milano Centrale, Duomo ve Navigli çevresinde noktalar için hazırlık yapıyoruz — yani indiğiniz yerde, gezeceğiniz yerde ve akşamı geçireceğiniz yerde.</p>

<p>İşleyiş şöyle: rezervasyonu telefondan yapıyorsunuz, bavulu bırakırken esnaf üzerine numaralı bir plastik mühür takıp fotoğraflıyor. Mühür kırılmadan çanta açılmıyor; siz alırken numarayı karşılaştırıyorsunuz. Ücret bavul başına ve günlük — treniniz gecikirse ek ücret çıkmıyor.</p>

<p>Milano noktalarımız henüz açık değil. Aramada görüyorsanız sebebi bu: hangi semtte gerçekten talep olduğunu ölçüyoruz ve esnafla önce orada anlaşıyoruz. Açılınca haber almak isterseniz nokta sayfasından e-postanızı bırakın.</p>
      `.trim(),
    },
    {
      locale: "en",
      slug: "milan-luggage-storage-centrale-layover",
      title: "For Most People Milan Is a Connection: Those Four Hours at Centrale",
      excerpt:
        "The security check at the Duomo, the Malpensa Express and the Navigli — where to leave your bag in Milan.",
      cover: "milano-duomo",
      body: `
<p>Most people who arrive in Milan do not stay in Milan. The city is Italy's northern gateway: trains to Venice, Florence, Como and Switzerland leave from here, and long-haul flights land at Malpensa. The typical visit is a connection with four or five hours in the middle.</p>

<p>You do not have to spend those hours in the concourse at Centrale — the Duomo is ten minutes away by metro. But with your bag beside you, there is no other option.</p>

<h2>Centrale has a deposit, and a queue</h2>

<p>Milano Centrale has a luggage deposit. It is charged by time, there is a security scan at the door, and the queue lengthens morning and late afternoon. The station is enormous and the deposit sits well away from the platforms; finding it and handing the bag over is twenty minutes in itself.</p>

{{img:milano-centrale}}

<p>Then there is the Malpensa Express: it runs from Centrale and Cadorna and takes about fifty minutes. So which station you need to be at by the end of the day is known in advance — and leaving the bag at the right one saves you an hour.</p>

<h2>You do not enter the Duomo with a large bag</h2>

<p>There is a security check at the entrance to the Duomo and large luggage does not go through. If you want to go up to the terraces — which is the best thing to do in Milan — it is stairs or a lift, and a suitcase is not coming with you.</p>

{{img:milano-duomo}}

<p>Seeing the Last Supper requires a timed entry; you are expected to arrive exactly on your slot, and large bags are not accepted there either. Trying to make that appointment while towing a case is the easiest way to miss it.</p>

<h2>The Galleria and the fashion quarter are walked</h2>

<p>The Galleria Vittorio Emanuele runs from the Piazza del Duomo through to La Scala and is busy all day. The streets of the Quadrilatero della Moda are narrow and mostly stone-paved. Anyone here to shop wants both hands free.</p>

<h2>The Navigli fill up in the evening</h2>

<p>The canal sides of the Navigli fill for aperitivo in the early evening. Tables spill into the street and the gaps are tight; getting into that crowd with a suitcase is hard work and spoils the evening.</p>

<h2>What BagajPark will do in Milan</h2>

<p>BagajPark moves storage out of the station and into the neighbourhood: we partner with local cafes, hotels and shops and turn them into drop-off points. In Milan we are preparing points around Milano Centrale, the Duomo and the Navigli — where you arrive, where you sightsee and where you spend the evening.</p>

<p>It works like this. You book from your phone. When you hand the bag over, the shopkeeper fits a numbered plastic seal to it and photographs it. It cannot be opened without breaking the seal, and you check the number when you collect. Pricing is per bag and per day, so a delayed train costs you nothing extra.</p>

<p>Our Milan points are not open yet. That is why you may see them in search: we are measuring which areas the demand is really in, and that is where we sign up shopkeepers first. Leave your email on a point's page to hear when it opens.</p>
      `.trim(),
    },
  ],
};
