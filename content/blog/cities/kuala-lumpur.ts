import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "kuala-lumpur",
  posts: [
    {
      locale: "tr",
      slug: "kuala-lumpur-kl-sentral-batu-magaralari-valiz",
      title: "Kuala Lumpur'da Her Şey KL Sentral'den Geçiyor",
      excerpt:
        "Havalimanı treni, şehir metrosu, banliyö hatları ve otobüsler aynı binada. Ama bavulla o binadan çıkmak da bir mesele.",
      cover: "kl-petronas",
      body: `
<p>Kuala Lumpur'da ulaşımın merkezi KL Sentral. Havalimanı ekspresi, LRT ve MRT hatları, banliyö trenleri ve şehirlerarası otobüsler aynı yapıda buluşuyor.</p>

<p>Bu, şehri kolay gezilir yapıyor. Ama KL Sentral aynı zamanda çok katlı ve büyük bir bina; hatlar arasında geçiş uzun koridorlar ve yürüyen merdivenler demek.</p>

{{img:kl-sentral}}

<h2>Havalimanı elli beş kilometre güneyde</h2>

<p>KLIA şehir merkezine elli beş kilometre. KLIA Ekspres KL Sentral'e yaklaşık yarım saatte geliyor; otobüs bir saatten fazla sürüyor.</p>

<p>Bu mesafe, uçuş gününde havalimanına erken gitmeyi cazip kılıyor ama terminalde beş saat beklemek de günü harcamak oluyor.</p>

<h2>Batu Mağaraları'na iki yüz yetmiş iki basamak</h2>

<p>Batu Mağaraları şehrin kuzeyinde ve banliyö treniyle yarım saat. Mağaraya çıkmak için iki yüz yetmiş iki renkli basamağı tırmanmak gerekiyor.</p>

<p>Bu merdivende bavul taşımak diye bir şey yok. Üstelik tepede maymunlar var ve ellerinde bir şey gördükleri kişiye yaklaşıyorlar.</p>

<h2>KLCC ile Bukit Bintang arası kapalı geçit</h2>

<p>Petronas Kuleleri'nin olduğu KLCC ile alışveriş bölgesi Bukit Bintang arasında bir kilometreden uzun, üstü kapalı ve klimalı bir yaya geçidi var.</p>

{{img:kl-petronas}}

<p>Bu geçit sıcaktan ve ani sağanaklardan koruyor. Ama iki ucunda da merdiven ve yürüyen merdiven var; bavulla geçmek mümkün ama rahat değil.</p>

<h2>Kulelerin gökyüzü köprüsü saatli biletli</h2>

<p>Petronas'ın gökyüzü köprüsü ve gözlem katı için belirli saatlere bilet alınıyor ve kontenjan sınırlı. Girişte güvenlik kontrolü var ve büyük bagajla girilmiyor.</p>

<h2>Merkez düz değil</h2>

<p>Kuala Lumpur haritada kompakt görünüyor ama arazi tepeli ve caddeler arasında kot farkı var. Üst geçitler, alt geçitler ve merdivenler yürüyüşün bir parçası.</p>

<p>Kaldırımlar da her yerde sürekli değil; bazı noktalarda karşıya geçmek için üst geçide çıkmak gerekiyor. Bavulla o merdivenler günde birkaç kez tekrarlanıyor.</p>

<h2>Yağmur her gün mümkün</h2>

<p>Kuala Lumpur'da öğleden sonra sağanakları yılın büyük bölümünde olağan. Yağmur başladığında sokakta yürümek birkaç dakika içinde imkânsızlaşıyor.</p>

<p>Bavulla o yağmura yakalanmak, bir yere sığınıp beklemek anlamına geliyor — ve bavulla sığınacak yer bulmak zor.</p>

<h2>Chinatown ve Merdeka Meydanı</h2>

<p>Petaling Sokağı'ndaki Chinatown çarşısı üstü kapalı ve tezgâhlar iki yandan geçidi daraltıyor. Merdeka Meydanı ve çevresindeki sömürge dönemi binaları ise açık alanda ve yürüyerek geziliyor.</p>

<p>İkisi arası bir kilometre kadar ama arada ana caddeler ve üst geçitler var; bavulla o geçitlerde merdiven çıkmak gerekiyor.</p>

<h2>Melaka ve Cameron Highlands günübirlik</h2>

<p>Melaka'ya otobüsle iki saat, Cameron Highlands'e dört saat. İkisi de günübirlik ya da bir gecelik gidiliyor ve otobüsler TBS terminalinden kalkıyor.</p>

<p>Bavulunuz merkezde bir yerde durduğunda Batu Mağaraları da kuleler de aynı güne sığıyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "kuala-lumpur-luggage-storage-kl-sentral",
      title: "In Kuala Lumpur Everything Runs Through KL Sentral",
      excerpt:
        "Airport train, city metro, commuter lines and coaches in one building. Getting out of that building with a bag is its own exercise.",
      cover: "kl-petronas",
      body: `
<p>KL Sentral is the centre of transport in Kuala Lumpur. The airport express, the LRT and MRT lines, the commuter trains and the intercity coaches all meet in the same structure.</p>

<p>That makes the city easy to get around. But KL Sentral is also a large, multi-level building; moving between lines means long corridors and escalators.</p>

{{img:kl-sentral}}

<h2>The airport is fifty-five kilometres south</h2>

<p>KLIA is fifty-five kilometres from the centre. The KLIA Ekspres reaches KL Sentral in about half an hour; the bus takes over an hour.</p>

<p>That distance makes going out to the airport early tempting — but five hours in a terminal is still a day spent.</p>

<h2>Batu Caves is two hundred and seventy-two steps</h2>

<p>Batu Caves lies north of the city, half an hour on the commuter train. Reaching the cave means climbing two hundred and seventy-two coloured steps.</p>

<p>Carrying a suitcase up them isn't a thing. And there are macaques at the top, which approach anyone holding something.</p>

<h2>A covered walkway links KLCC and Bukit Bintang</h2>

<p>Between KLCC, where the Petronas Towers stand, and the Bukit Bintang shopping district runs a covered, air-conditioned pedestrian link more than a kilometre long.</p>

{{img:kl-petronas}}

<p>It shelters you from the heat and the sudden downpours. But there are stairs and escalators at both ends; passable with a bag, comfortable it is not.</p>

<h2>The skybridge is a timed ticket</h2>

<p>Tickets for the Petronas skybridge and observation deck are for fixed time slots with limited capacity. There's a security check at the entrance and large luggage isn't admitted.</p>

<h2>Rain is possible any day</h2>

<p>Afternoon downpours are normal in Kuala Lumpur for much of the year. Once it starts, walking the street becomes impossible within minutes.</p>

<p>Getting caught in that with a bag means finding shelter and waiting — and finding shelter with a suitcase is harder than it sounds.</p>

<h2>Melaka and the Cameron Highlands are day trips</h2>

<p>Melaka is two hours by coach, the Cameron Highlands four. Both are done as a day or an overnight, and the coaches leave from the TBS terminal.</p>

<p>With the bag left somewhere central, Batu Caves and the towers both fit into one day.</p>
`.trim(),
    },
  ],
};
