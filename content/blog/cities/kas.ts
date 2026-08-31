import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "kas",
  posts: [
    {
      locale: "tr",
      slug: "kas-kekova-teknesi-kalkan-valiz",
      title: "Kaş'ta Otobüs Öğlen, Tekne Sabah: Aradaki Saatlerde Bavul Nerede?",
      excerpt:
        "Kekova turu, Meis feribotu ve Kalkan'ın merdivenli sokakları — Kaş'ta valiz nereye bırakılır?",
      cover: "kas-merkez",
      body: `
<p>Kaş'a uçakla gelinmiyor. En yakın havalimanları Dalaman ve Antalya ve ikisi de üç buçuk saatlik yolda. Yani buraya gelenlerin neredeyse hepsi otobüsle geliyor ve otobüsle gidiyor — çoğu zaman gece kalkan bir otobüsle.</p>

<p>Bu da şu demek: otelden çıkışla otobüs saati arasında koca bir gün var ve o gün genellikle bir tekne turuyla dolduruluyor.</p>

<h2>Kekova turu sabah kalkıyor</h2>

<p>Kaş limanından kalkan Kekova turları sabah dokuz–on gibi çıkıyor ve akşamüstü dönüyor. Batık şehir, Simena kalesi, birkaç koyda yüzme molası. Teknelerde bagaj bölmesi yok; güverte minderle döşeli ve valiz koyacak yer yok.</p>

{{img:kas-merkez}}

<p>Simena'ya çıkacaksanız iş daha da netleşiyor: iskeleden kaleye kadar dik bir patika ve basamaklar var. O tırmanışı bir valizle yapmak diye bir şey yok.</p>

<h2>Meis'e geçmek yirmi dakika ama pasaportlu</h2>

<p>Kaş'tan Meis Adası'na feribot yirmi dakika sürüyor ve iki yönde de pasaport kontrolü var. Günübirlik geçenlerin büyük bavulla gitmesi anlamsız: ada küçük, kıyı boyunca yürünüyor ve gümrükte sıra bekliyorsunuz.</p>

<h2>Kaş merkezi yokuş, Kalkan daha da yokuş</h2>

<p>Kaş bir yamaca kurulmuş: eski mahallenin sokakları dar, taş döşeli ve çoğu basamaklı. Yukarıdaki Likya kaya mezarlarına çıkmak da merdiven demek. Ana caddeden aşağı limana inmek kolay, geri çıkmak değil.</p>

<p>Kalkan ise bu konuda daha da uç: yirmi yedi kilometre batıda, tamamen bir yamaca yaslanmış ve sokaklarının çoğu merdiven. Otellerin kapısına araç gelmiyor; taksi sizi üst yolda bırakıyor ve gerisini basamaklardan iniyorsunuz.</p>

{{img:kas-kalkan}}

<h2>Otogar merkezde, bu iyi haber</h2>

<p>Kaş Otogarı merkezde ve limana yürüme mesafesinde — çoğu tatil kasabasında olmayan bir kolaylık. Ama otogarın merkezde olması, bavulunuzu gün boyu orada bırakabileceğiniz anlamına gelmiyor; otobüs firmalarının emanet gibi bir yükümlülüğü yok ve yazın peronlar zaten dolu.</p>

<p>Dalış merkezine gidecekseniz hesap ayrı: ekipman zaten hacimli ve tekneye bir de valiz eklemek mümkün değil.</p>

<h2>BagajPark Kaş'ta ne yapacak?</h2>

<p>BagajPark bavulu otogara değil semte götürüyor: mahalledeki kafe, otel ve dükkanlarla anlaşıp emanet noktasına çeviriyoruz. Kaş'ta merkez ve Kalkan için noktalar hazırlıyoruz — yani tekneye binmeden önce ve merdivenlere inmeden önce uğrayabileceğiniz yerler.</p>

<p>İşleyiş şöyle: rezervasyonu telefondan yapıyorsunuz, bavulu bırakırken esnaf üzerine numaralı bir plastik mühür takıp fotoğraflıyor. Mühür kırılmadan çanta açılmıyor; siz alırken numarayı karşılaştırıyorsunuz. Ücret bavul başına ve günlük — tekne geç dönerse sayaç işlemiyor.</p>

<p>Kaş noktaları henüz açık değil. Aramada görüyorsanız sebebi bu: talebi ölçüyoruz ve esnafla önce en çok denenen noktada anlaşıyoruz. Açılınca haber almak isterseniz nokta sayfasından e-postanızı bırakın.</p>
      `.trim(),
    },
    {
      locale: "en",
      slug: "kas-kekova-boat-kalkan-luggage",
      title: "In Kas the Boat Leaves at Nine and the Coach at Midnight. Where Is the Bag in Between?",
      excerpt:
        "The Kekova trip, the ferry to Meis and the stepped lanes of Kalkan — where the suitcase goes in Kas.",
      cover: "kas-merkez",
      body: `
<p>You do not fly to Kas. The nearest airports are Dalaman and Antalya, both about three and a half hours away. So nearly everyone arrives and leaves by coach — very often a coach that goes at night.</p>

<p>Which means there is a whole day between checkout and departure, and that day usually gets filled with a boat trip.</p>

<h2>The Kekova trip leaves in the morning</h2>

<p>Boats out of Kas harbour to Kekova leave around nine or ten and come back in the late afternoon. The sunken city, the castle at Simena, a few swimming stops. The boats have no hold; the deck is laid with cushions and there is nowhere to put a suitcase.</p>

{{img:kas-merkez}}

<p>If you go up to Simena it gets clearer still: it is a steep path and steps from the jetty to the castle. That climb does not happen with a suitcase.</p>

<h2>Meis is twenty minutes away, with passport control</h2>

<p>The ferry from Kas to the Greek island of Meis takes twenty minutes and there is passport control in both directions. Going across for the day with a large bag makes no sense: the island is small, you walk along the shore, and you queue at customs.</p>

<h2>Kas is on a slope and Kalkan is on a steeper one</h2>

<p>Kas is built into a hillside: the old quarter's lanes are narrow, cobbled and mostly stepped. Getting up to the Lycian rock tombs above the town means stairs too. Walking down from the main street to the harbour is easy; walking back up is not.</p>

<p>Kalkan takes this further. Twenty-seven kilometres west, it clings to a slope and most of its lanes are staircases. Vehicles do not reach hotel doors; the taxi leaves you on the upper road and you go down the steps.</p>

{{img:kas-kalkan}}

<h2>The coach station is central, which is good news</h2>

<p>Kas's coach station is in the middle of town, walkable from the harbour — a convenience most resort towns lack. But its being central does not mean you can leave a bag there all day; coach companies have no obligation to store anything, and in summer the bays are full anyway.</p>

<p>If you are diving, the arithmetic is separate: the kit is bulky enough, and adding a suitcase to the boat is not possible.</p>

<h2>What BagajPark will do in Kas</h2>

<p>BagajPark moves storage out of the coach station and into the neighbourhood: we partner with local cafes, hotels and shops and turn them into drop-off points. In Kas we are preparing points in the centre and in Kalkan — before the boat, and before the steps.</p>

<p>It works like this. You book from your phone. When you hand the bag over, the shopkeeper fits a numbered plastic seal to it and photographs it. It cannot be opened without breaking the seal, and you check the number when you collect. Pricing is per bag and per day, so a boat that comes back late costs you nothing.</p>

<p>The Kas points are not open yet. That is why you may see them in search: we are measuring the demand and signing up shopkeepers where people actually try to leave bags. Leave your email on a point's page to hear when it opens.</p>
      `.trim(),
    },
  ],
};
