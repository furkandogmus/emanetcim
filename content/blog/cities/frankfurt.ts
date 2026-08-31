import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "frankfurt",
  posts: [
    {
      locale: "tr",
      slug: "frankfurt-aktarma-fuar-valiz",
      title: "Frankfurt Bir Aktarma Şehri: Uçuşla Tren Arasındaki O Beş Saat",
      excerpt:
        "Hauptbahnhof'un dolapları, fuar haftaları ve Römerberg — Frankfurt'ta bavul nereye bırakılır?",
      cover: "frankfurt-hauptbahnhof",
      body: `
<p>Frankfurt'a gelenlerin büyük kısmı Frankfurt'a gelmiyor. Havalimanının kendi uzun mesafe tren garı var ve Almanya'nın demiryolu ağı buradan dağılıyor; insanlar uçaktan inip trene biniyor ya da tersini yapıyor.</p>

<p>Bu, çok tanıdık bir boşluk üretiyor: uçuşunuzla treniniz arasında dört beş saat var ve şehir merkezi havalimanından yalnızca on beş dakika uzakta. Yani dışarı çıkmak mantıklı — ama elinizde bavul varsa çıkmıyorsunuz.</p>

<h2>Hauptbahnhof'ta dolap var, fuar haftasında dolu</h2>

<p>Frankfurt Hauptbahnhof Avrupa'nın en yoğun garlarından biri ve otomatik emanet dolapları bulunuyor. Boyuta göre ücretlendiriliyor.</p>

{{img:frankfurt-hauptbahnhof}}

<p>Ama Frankfurt bir fuar şehri: kitap fuarı, otomobil fuarı, Ambiente ve daha onlarcası şehri yılda birçok kez dolduruyor. O haftalarda oteller doluyor, fiyatlar tavan yapıyor ve gar dolapları da doluyor. Fuar için gelenlerin çoğu günübirlik geliyor ve elinde bir valizle geliyor.</p>

<h2>Merkez ile gar arası yürüme mesafesinde</h2>

<p>Hauptbahnhof'tan Römerberg'e yürümek yaklaşık yirmi dakika, Ana nehri kıyısına daha da az. Bu iyi haber — Frankfurt kompakt bir şehir ve merkezdeki her şey birbirine yakın.</p>

{{img:frankfurt-romer}}

<p>Ama kompaktlık bavulu görünmez yapmıyor: Römerberg'in taş zemininde, Müze Kıyısı yürüyüşünde ve Sachsenhausen'in dar sokaklarında valiz yine yanınızda.</p>

<h2>Müzeler ve Sachsenhausen</h2>

<p>Müze Kıyısı'ndaki müzelerde vestiyer boyut sınırıyla çalışıyor. Nehrin karşı yakasındaki Sachsenhausen ise elma şarabı meyhaneleriyle bilinen bir mahalle; masalar uzun ve ortak, aralar dar. Bir valizle o masaya oturmak kimsenin işine gelmiyor.</p>

<h2>Havalimanı hem yakın hem tuzak</h2>

<p>Havalimanı merkeze S-Bahn ile on beş dakika. Bu kadar yakınken bavulu erken oraya götürmek cazip görünüyor, ama uçağınıza beş saat varken terminalde oturmak Frankfurt'ta geçirilebilecek en kötü zaman — üstelik şehir yanı başınızda.</p>

<p>Bir de şu var: uzun mesafe treni havalimanından da kalkıyor. Yani bağlantınıza göre günün sonunda merkezde mi havalimanında mı olacağınız değişiyor ve bu, bavulu nereye bırakacağınızı belirliyor.</p>

<h2>BagajPark Frankfurt'ta ne yapacak?</h2>

<p>BagajPark bavulu gara değil semte götürüyor: mahalledeki kafe, otel ve dükkanlarla anlaşıp emanet noktasına çeviriyoruz. Frankfurt'ta Frankfurt Hauptbahnhof ve Römer çevresinde noktalar için hazırlık yapıyoruz.</p>

<p>İşleyiş şöyle: rezervasyonu telefondan yapıyorsunuz, bavulu bırakırken esnaf üzerine numaralı bir plastik mühür takıp fotoğraflıyor. Mühür kırılmadan çanta açılmıyor; siz alırken numarayı karşılaştırıyorsunuz. Ücret bavul başına ve günlük — bağlantı treniniz gecikirse ek ücret çıkmıyor.</p>

<p>Frankfurt noktalarımız henüz açık değil. Aramada görüyorsanız sebebi bu: hangi semtte gerçekten talep olduğunu ölçüyoruz ve esnafla önce orada anlaşıyoruz. Açılınca haber almak isterseniz nokta sayfasından e-postanızı bırakın.</p>
      `.trim(),
    },
    {
      locale: "en",
      slug: "frankfurt-luggage-storage-layover",
      title: "Frankfurt Is a Connection City: Those Five Hours Between the Flight and the Train",
      excerpt:
        "The lockers at Hauptbahnhof, trade fair weeks and the Romerberg — where to leave your bag in Frankfurt.",
      cover: "frankfurt-hauptbahnhof",
      body: `
<p>Most people who arrive in Frankfurt are not coming to Frankfurt. The airport has its own long-distance railway station and Germany's rail network fans out from here; people step off a plane and onto a train, or the reverse.</p>

<p>That produces a very familiar gap: four or five hours between your flight and your train, with the city centre only fifteen minutes from the airport. Going into town makes obvious sense — and with a suitcase in hand, you do not go.</p>

<h2>Hauptbahnhof has lockers, and in fair weeks they fill</h2>

<p>Frankfurt Hauptbahnhof is one of the busiest stations in Europe and has automated left-luggage lockers, priced by size.</p>

{{img:frankfurt-hauptbahnhof}}

<p>But Frankfurt is a trade fair city: the book fair, the motor show, Ambiente and dozens more fill it several times a year. In those weeks the hotels fill, prices peak, and the station lockers fill too. Many fair visitors come for the day — and come with a case.</p>

<h2>The centre is walkable from the station</h2>

<p>Walking from Hauptbahnhof to the Romerberg takes about twenty minutes, and to the Main riverside less than that. That is good news — Frankfurt is compact and everything central is close together.</p>

{{img:frankfurt-romer}}

<p>But compactness does not make the bag disappear: on the Romerberg's stone paving, along the Museumsufer walk and in the narrow lanes of Sachsenhausen, the case is still with you.</p>

<h2>The museums and Sachsenhausen</h2>

<p>The museums along the Museumsufer run cloakrooms with size limits. Across the river, Sachsenhausen is the quarter known for its apple wine taverns; the tables are long and shared and the gaps are tight. Sitting down at one with a suitcase suits nobody.</p>

<h2>The airport is close, and that is the trap</h2>

<p>The airport is fifteen minutes from the centre on the S-Bahn. With it that close, taking the bag out early looks tempting — but sitting in the terminal five hours before your flight is the worst way to spend time in Frankfurt, with the city right there.</p>

<p>There is also this: long-distance trains leave from the airport too. So depending on your connection, whether you end the day in the centre or at the airport changes — and that decides where it makes sense to leave the bag.</p>

<h2>What BagajPark will do in Frankfurt</h2>

<p>BagajPark moves storage out of the station and into the neighbourhood: we partner with local cafes, hotels and shops and turn them into drop-off points. In Frankfurt we are preparing points around Hauptbahnhof and the Romer.</p>

<p>It works like this. You book from your phone. When you hand the bag over, the shopkeeper fits a numbered plastic seal to it and photographs it. It cannot be opened without breaking the seal, and you check the number when you collect. Pricing is per bag and per day, so a delayed connection costs you nothing extra.</p>

<p>Our Frankfurt points are not open yet. That is why you may see them in search: we are measuring which areas the demand is really in, and that is where we sign up shopkeepers first. Leave your email on a point's page to hear when it opens.</p>
      `.trim(),
    },
  ],
};
