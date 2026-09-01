import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "miami",
  posts: [
    {
      locale: "tr",
      slug: "miami-south-beach-downtown-arasi-koprusu-valiz",
      title: "Miami'de South Beach ile Downtown Arasında Bir Körfez Var",
      excerpt:
        "İki bölge arası köprüyle bağlı ve raylı sistem yok. Plajda da dolap yok — o yüzden bavul bir yerde durmak zorunda.",
      cover: "miami-ocean-drive",
      body: `
<p>Miami tek bir şehir gibi anılıyor ama iki ayrı yerden oluşuyor. Miami Beach — yani South Beach ve Ocean Drive — bir adada; Downtown ve Brickell ise anakarada.</p>

<p>İkisi arasında körfez var ve bağlantı köprülerle sağlanıyor. Araçla yirmi dakika, trafik varsa daha uzun. Aralarında metro ya da tramvay bağlantısı yok; şehrin Metromover hattı yalnızca Downtown'un içinde dönüyor.</p>

{{img:miami-ocean-drive}}

<h2>Yani her geçiş bir araç yolculuğu</h2>

<p>Bir günde hem art deco mahallesini hem Downtown'u görmek isteyen biri bu köprüyü iki kez geçiyor. Bavul da o iki yolculukta bagajda gidip geliyor.</p>

<h2>Plajda emanet dolabı yok</h2>

<p>South Beach'in kumsalı kilometrelerce uzanıyor ve cankurtaran kuleleri dışında bir yapı yok. Şezlong ve şemsiye kiralanıyor ama dolap hizmeti bulunmuyor.</p>

{{img:miami-plaj}}

<p>Yani kumda bavulun başında oturmak dışında bir seçenek kalmıyor — ki bu bir plaj günü değil.</p>

<h2>Liman gemi günlerinde kalabalık</h2>

<p>Miami dünyanın en yoğun yolcu gemisi limanlarından biri ve gemiler genelde aynı gün, sabah erken yolcularını indiriyor. O sabahlar şehirde binlerce kişi bavuluyla dolaşıyor.</p>

<p>Uçuşları akşam olanlar için gün baştan sona açıkta geçiyor.</p>

<h2>Art deco mahallesi yürüyerek geziliyor</h2>

<p>Ocean Drive ve arkasındaki Collins ile Washington caddeleri boyunca art deco cepheler sıralanıyor. Rota birkaç kilometre ve tamamı yaya.</p>

<p>Kaldırımlar kalabalık, kafelerin masaları kaldırıma taşmış durumda. Bavulla ilerlemek yavaş.</p>

<h2>Wynwood ve Little Havana da ayrı duraklar</h2>

<p>Duvar resimleriyle bilinen Wynwood Downtown'un kuzeyinde; Little Havana ise batısında. İkisi de yürüyerek geziliyor ama birbirine ve merkeze uzak.</p>

<p>Yani Miami'de bir gün, üç dört ayrı araç yolculuğu demek — ve bavul hepsine biniyor.</p>

<h2>Havalimanı iki bölgeye de uzak</h2>

<p>Miami Havalimanı Downtown'a on üç kilometre, South Beach'e yirmi kilometre. Uçuşların çoğu akşam ve gece; otel çıkışı ise on bir.</p>

<h2>Everglades ve Key West turları sabah</h2>

<p>Everglades yarım günlük, Key West tam günlük tur. Key West'e yol tek yönde üç buçuk saat ve turlar sabah yedide kalkıyor.</p>

<p>Bu turlarda bavul için yer yok ve dönüş akşamı buluyor.</p>

<h2>Lincoln Road yaya caddesi</h2>

<p>South Beach'in ortasındaki Lincoln Road trafiğe kapalı ve iki yanı mağaza, kafe. Akşamüstü en kalabalık noktalardan biri.</p>

<p>Cadde geniş ve düz — bavulla yürünebilir. Ama masalar ortadaki geçidi daraltıyor ve oturacak bir yer bulmak kolay değil.</p>

<h2>Yağmur mevsiminde öğleden sonra sağanak</h2>

<p>Mayıs ile ekim arasında öğleden sonra sağanakları neredeyse günlük. Kısa sürüyor ama şiddetli; açıkta kalmak bavulun da ıslanması demek.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "miami-luggage-storage-south-beach-downtown",
      title: "There's a Bay Between South Beach and Downtown Miami",
      excerpt:
        "The two are joined by causeways and there's no rail link. There are no lockers on the beach either.",
      cover: "miami-ocean-drive",
      body: `
<p>Miami gets talked about as one city, but it's two separate places. Miami Beach — South Beach and Ocean Drive — is on an island; Downtown and Brickell are on the mainland.</p>

<p>A bay lies between them, crossed by causeways. Twenty minutes by car, longer in traffic. There's no metro or tram between them; the city's Metromover loops only within Downtown.</p>

{{img:miami-ocean-drive}}

<h2>So every crossing is a drive</h2>

<p>Anyone wanting to see both the art deco district and Downtown in a day crosses that causeway twice. And the bag rides in the boot both times.</p>

<h2>There are no lockers on the beach</h2>

<p>The sand at South Beach runs for kilometres with nothing on it but lifeguard towers. Loungers and umbrellas are hired out, but there's no storage.</p>

{{img:miami-plaj}}

<p>Which leaves sitting on the sand guarding your suitcase — not a beach day.</p>

<h2>The art deco district is walked</h2>

<p>Art deco facades line Ocean Drive and the Collins and Washington avenues behind it. The route is a few kilometres and entirely on foot.</p>

<p>The pavements are busy and café tables spill onto them. Progress with a bag is slow.</p>

<h2>Wynwood and Little Havana are separate stops too</h2>

<p>Wynwood, known for its murals, is north of Downtown; Little Havana is west. Both are walked once you're there, but neither is near the other or the centre.</p>

<p>So a day in Miami means three or four separate drives — and the bag comes on all of them.</p>

<h2>The airport is far from both</h2>

<p>Miami airport is thirteen kilometres from Downtown and twenty from South Beach. Most flights are in the evening or at night; checkout is at eleven.</p>

<h2>The Everglades and Key West trips leave in the morning</h2>

<p>The Everglades is a half day, Key West a full one. Key West is three and a half hours each way and the tours leave at seven.</p>

<p>Neither has room for luggage, and both get back in the evening.</p>

<h2>Afternoon downpours in the wet season</h2>

<p>Between May and October, afternoon storms are almost daily. They're short but heavy; being caught out means the bag gets soaked too.</p>
`.trim(),
    },
  ],
};
