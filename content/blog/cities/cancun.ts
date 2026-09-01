import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "cancun",
  posts: [
    {
      locale: "tr",
      slug: "cancun-otel-bolgesi-merkez-otobus-terminali-valiz",
      title: "Cancún'da Otobüsler Otel Bölgesinden Değil, Merkezden Kalkıyor",
      excerpt:
        "Tulum, Playa ve Chichén Itzá otobüsleri Centro'daki terminalden hareket ediyor. Otel bölgesine on kilometre var.",
      cover: "cancun-otel-bolgesi",
      body: `
<p>Cancún iki ayrı yerden oluşuyor. Zona Hotelera, yirmi iki kilometrelik bir kum şeridi üzerine dizilmiş oteller; Centro ise anakarada, on kilometre içeride.</p>

<p>Ziyaretçilerin çoğu otel bölgesinde kalıyor. Ama şehirlerarası otobüsler orada durmuyor: Tulum, Playa del Carmen, Mérida ve Chichén Itzá seferleri Centro'daki ADO terminalinden kalkıyor.</p>

{{img:cancun-otel-bolgesi}}

<h2>Yani her gezi merkezden başlıyor</h2>

<p>Otel bölgesinden Centro'ya otobüsle yarım saat, taksiyle yirmi dakika. Bir tura ya da otobüse yetişmek için o yolu sabah erken yapmak gerekiyor.</p>

<p>Chichén Itzá turları sabah yedide kalkıyor ve akşam yediye doğru dönüyor. Yani çıkış gününde bu turu yapan biri bavuluyla iki kez şehir değiştirmiş oluyor.</p>

<h2>Otel bölgesi bir şerit</h2>

<p>Zona Hotelera tek bir bulvar üzerinde uzanıyor ve numaralarla adreslenmiş. Bir uçtan diğerine yirmi iki kilometre var; otobüsler bu hat boyunca sürekli çalışıyor.</p>

<p>Otobüslerde bagaj bölmesi yok ve koridor dar. Bir valizle binmek, ayakta duran yolcuların yerini almak demek.</p>

<h2>Taksilerde sabit tarife yok</h2>

<p>Cancún'da taksiler taksimetre kullanmıyor; fiyat binmeden önce konuşuluyor ve otel bölgesiyle merkez arasında ciddi biçimde değişiyor.</p>

<p>Bavul sayısı da pazarlığa giriyor: iki valizle daha büyük araç isteniyor ve fiyat yükseliyor.</p>

<h2>Havalimanı otel bölgesine yirmi kilometre</h2>

<p>Cancún Havalimanı şeridin güneyinde ve otel bölgesine yaklaşık yirmi kilometre, Centro'ya on beş. Uçuşların çoğu öğleden sonra ve akşam; otel çıkışı on iki.</p>

<h2>Cenote ve Tulum turları sabah</h2>

<p>Riviera Maya boyunca uzanan cenoteler ve Tulum kalıntıları günübirlik gidilen yerler; turlar sabah yedi sekizde kalkıyor. Cenotelerde suya giriliyor ve eşyalar kıyıda bırakılıyor.</p>

<p>Bu turların hiçbirinde valiz için yer yok; minibüsler dolu geliyor.</p>

<h2>Isla Mujeres feribotu Puerto Juárez'den</h2>

<p>Isla Mujeres'e feribotlar merkeze yakın Puerto Juárez'den ve otel bölgesindeki birkaç iskeleden kalkıyor. Yolculuk yirmi dakika.</p>

<p>Adada araç yok; golf arabası kiralanıyor ve bavul için yer bulunmuyor.</p>

<h2>Merkez tarafı bambaşka</h2>

<p>Centro'daki Mercado 28 ve çevresindeki sokaklar otel bölgesiyle hiç ilgisi olmayan bir yer: tezgâhlar, yerel lokantalar, taksi durakları.</p>

{{img:cancun-mercado}}

<p>Buraya gelen ziyaretçi az ama otobüsünü bekleyen biri için mantıklı bir durak — elleriniz boşsa.</p>

<h2>Otel plajlarında dolap yok</h2>

<p>Kum şeridi boyunca uzanan plajların büyük bölümü halka açık ama otellerin arkasında kalıyor. Şezlong ve şemsiye otellere ait; dolap hizmeti sunulmuyor.</p>

<p>Çıkış yapmış biri için bu, kumda bavulun başında beklemekten başka seçenek kalmaması demek.</p>

<h2>Sargazo mevsimi plajı değiştiriyor</h2>

<p>Bahar ve yaz aylarında kıyıya sargazo yosunu vuruyor ve bazı plajlar kullanılamaz hale geliyor. O günlerde program değişiyor ve şehirde ya da adalarda vakit geçiriliyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "cancun-luggage-storage-bus-terminal-downtown",
      title: "In Cancun the Buses Leave From Downtown, Not the Hotel Zone",
      excerpt:
        "Tulum, Playa and Chichén Itzá all go from the ADO terminal in Centro — ten kilometres from where you're staying.",
      cover: "cancun-otel-bolgesi",
      body: `
<p>Cancun is two separate places. The Zona Hotelera is a twenty-two kilometre strip of sand lined with resorts; Centro is on the mainland, ten kilometres inland.</p>

<p>Most visitors stay in the hotel zone. But the intercity buses don't stop there: services to Tulum, Playa del Carmen, Mérida and Chichén Itzá leave from the ADO terminal in Centro.</p>

{{img:cancun-otel-bolgesi}}

<h2>So every trip starts downtown</h2>

<p>Hotel zone to Centro is half an hour by bus, twenty minutes by taxi. Catching a tour or a coach means making that trip early in the morning.</p>

<p>The Chichén Itzá tours leave at seven and get back around seven in the evening. Doing that on your checkout day means crossing the city twice with your luggage.</p>

<h2>The hotel zone is a single strip</h2>

<p>The Zona Hotelera runs along one boulevard and is addressed by kilometre markers. Twenty-two kilometres end to end, with buses running the length of it constantly.</p>

<p>Those buses have no luggage compartment and a narrow aisle. Boarding with a suitcase takes the space of the passengers standing.</p>

<h2>The airport is twenty kilometres from the hotel zone</h2>

<p>Cancun airport is south of the strip, about twenty kilometres from the hotel zone and fifteen from Centro. Most flights are in the afternoon and evening; checkout is at noon.</p>

<h2>The Isla Mujeres ferry goes from Puerto Juárez</h2>

<p>Ferries to Isla Mujeres leave from Puerto Juárez near the centre and from a few piers in the hotel zone. The crossing is twenty minutes.</p>

<p>There are no cars on the island; you hire a golf cart, and there's no space on one for luggage.</p>

<h2>Downtown is a different world</h2>

<p>Mercado 28 and the streets around it in Centro have nothing to do with the hotel zone: market stalls, local kitchens, taxi ranks.</p>

{{img:cancun-mercado}}

<p>Few visitors come, but for someone waiting on a bus it's a sensible stop — with your hands free.</p>

<h2>There are no lockers on the hotel beaches</h2>

<p>Most of the sand along the strip is public but sits behind the resorts. The loungers and umbrellas belong to the hotels, and none of them offers storage.</p>

<p>For someone who has checked out, that leaves sitting on the sand guarding a case.</p>

<h2>Sargassum season changes the plan</h2>

<p>In spring and summer sargassum seaweed washes ashore and some beaches become unusable. On those days the plan shifts to the town or the islands instead.</p>
`.trim(),
    },
  ],
};
