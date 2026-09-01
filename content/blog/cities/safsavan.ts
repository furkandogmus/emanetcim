import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "safsavan",
  posts: [
    {
      locale: "tr",
      slug: "sefsavan-otobus-terminali-yokus-valiz",
      title: "Şefşaven'de Otobüsten İnince Medinaya Kadar Yokuş Var",
      excerpt:
        "Terminal aşağıda, mavi medina yukarıda. Aradaki bir buçuk kilometre bavulla yapılan en dik yürüyüş.",
      cover: "sefsavan-sokak",
      body: `
<p>Şefşaven'e otobüsle geliniyor. Tanca'dan iki buçuk, Fes'ten dört saat kadar; başka pratik bir yol yok, şehrin havalimanı ya da tren istasyonu bulunmuyor.</p>

<p>Otobüsler şehrin aşağısındaki terminale varıyor. Mavi boyalı medina ise yukarıda, Rif dağlarının eteğinde. Aradaki mesafe bir buçuk kilometre kadar ama önemli olan mesafe değil, eğim.</p>

{{img:sefsavan-medina}}

<h2>O yokuş bavulla çıkılmıyor</h2>

<p>Terminalden medinaya giden yol sürekli yukarı. Taksiler var ve ucuz, ama taksi de sizi medina kapısında bırakıyor — içeride araç yok. Kaldığınız yer medinanın içindeyse son bölüm yine yürüyerek ve yine yokuş.</p>

<p>Şehrin tamamı basamaklı zaten. Sokaklar merdivenle bağlanıyor ve tekerlekli valiz burada işlevini tamamen kaybediyor.</p>

{{img:sefsavan-sokak}}

<h2>Çoğu insan burada gecelemiyor</h2>

<p>Şefşaven, Tanca ya da Fes'ten günübirlik gelinen bir yer. Sabah otobüsüyle gelip akşam otobüsüyle dönenler çoğunlukta ve bu, şehirde geçirilen altı yedi saatin tamamının otelsiz geçmesi demek.</p>

<p>Bir gece kalanlarda da tablo değişmiyor: çıkış saati öğlen, dönüş otobüsü akşamüstü. Arada yine birkaç saat var.</p>

<h2>İspanyol Camii'ne çıkmak yarım saat</h2>

<p>Şehrin klasik seyir noktası, karşı yamaçtaki İspanyol Camii. Gün batımı için buraya çıkılıyor ve yürüyüş yaklaşık yarım saat, toprak patikadan ve dik.</p>

<p>Bu yürüyüşü bavulla yapmak mümkün değil. Zaten yukarıda bir şey bırakacak yer de yok.</p>

<h2>Akchour şelaleleri günübirlik</h2>

<p>Akchour, Şefşaven'e yaklaşık kırk kilometre ve grand taxi ile gidiliyor. Şelalelere yürüyüş iki üç saat sürüyor, patika taşlı ve nehir geçişleri var. Bu bir doğa yürüyüşü, bavul taşıma alanı değil.</p>

<h2>Meydan ve çarşı akşam kalabalık</h2>

<p>Outa el-Hammam meydanı medinanın merkezi; kasba ve büyük camii burada. Akşamüstü kafeler doluyor ve meydana açılan sokaklar dar. Elleriniz boşken oturup şehri seyretmek Şefşaven'in asıl yaptığı şey.</p>

<h2>Otobüs saatleri seyrek</h2>

<p>Şefşaven'e ve buradan diğer şehirlere giden otobüsler günde birkaç sefer. CTM biletleri özellikle hafta sonu doluyor ve bir sonraki sefer birkaç saat sonra olabiliyor.</p>

<p>Bu seyreklik, terminalde beklenen sürenin uzamasına yol açıyor. O sürenin terminalde mi yoksa medinada mı geçtiği tamamen bavulun nerede olduğuna bağlı.</p>

<h2>Yağmur ve rakım</h2>

<p>Şefşaven altı yüz metre rakımda ve Rif dağlarının eteğinde. Kışın yağmur alıyor, basamaklar ıslanınca kayganlaşıyor. Yazın da öğlen saatleri sıcak, gölge dar sokaklarda kalıyor.</p>

<p>Her iki durumda da yüklü yürümek istemeyeceğiniz bir zemin çıkıyor karşınıza.</p>

<p>Bavulunuzu aşağıda ya da medina girişinde bırakabilmek, o yokuşu bir kez ve boş elle çıkmanız demek.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "chefchaouen-luggage-storage-uphill-medina",
      title: "In Chefchaouen It's Uphill From the Bus Station to the Medina",
      excerpt:
        "The terminal is below, the blue medina above. That kilometre and a half is the steepest walk you'll do with a bag.",
      cover: "sefsavan-sokak",
      body: `
<p>You come to Chefchaouen by bus. Two and a half hours from Tangier, about four from Fes; there is no practical alternative, since the town has neither an airport nor a railway station.</p>

<p>The buses arrive at the terminal down in the lower town. The blue medina is above it, on the flank of the Rif mountains. The distance is about a kilometre and a half — but the distance isn't the point, the gradient is.</p>

{{img:sefsavan-medina}}

<h2>That hill is not a walk you do with a suitcase</h2>

<p>The road from the terminal to the medina climbs the whole way. Taxis exist and are cheap, but a taxi also leaves you at the medina gate — no vehicles go inside. If you're staying within the walls, the last stretch is on foot and still uphill.</p>

<p>The whole town is stepped anyway. The lanes connect by staircases, and a wheeled case loses its purpose entirely here.</p>

{{img:sefsavan-sokak}}

<h2>Most people don't sleep here</h2>

<p>Chefchaouen is mostly visited as a day trip from Tangier or Fes. Arriving on a morning bus and leaving on an evening one is the norm, which means the entire six or seven hours in town are spent without a room.</p>

<p>An overnight stay doesn't change the shape of it: checkout at noon, the bus back in the late afternoon. There are still hours in between.</p>

<h2>The Spanish Mosque is half an hour uphill</h2>

<p>The town's classic viewpoint is the Spanish Mosque on the opposite slope. People climb it for sunset, about half an hour on a dirt path, and steep.</p>

<p>Doing that walk with a case isn't possible, and there's nowhere to leave one at the top.</p>

<h2>The Akchour waterfalls are a day out</h2>

<p>Akchour is about forty kilometres away, reached by grand taxi. The walk to the falls takes two or three hours over stony paths with river crossings. It is a hike, not somewhere to carry luggage.</p>

<h2>The square fills up in the evening</h2>

<p>Outa el-Hammam is the medina's central square, with the kasbah and the great mosque on it. The cafés fill in the late afternoon and the lanes leading into it are narrow. Sitting there watching the town with your hands free is what Chefchaouen is actually for.</p>

<p>Leaving the bag below, or at the medina gate, means climbing that hill once and climbing it empty-handed.</p>
`.trim(),
    },
  ],
};
