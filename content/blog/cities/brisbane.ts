import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "brisbane",
  posts: [
    {
      locale: "tr",
      slug: "brisbane-citycat-feribot-nehir-valiz",
      title: "Brisbane'in Ulaşımı Nehirde ve Feribotta Bagaj Yeri Yok",
      excerpt:
        "CityCat feribotları şehrin omurgası. Ama iskelelerde rampalar dar ve güvertede valiz için yer bulunmuyor.",
      cover: "brisbane-south-bank",
      body: `
<p>Brisbane bir nehrin iki yakasına kurulu ve o nehir şehri ikiye bölmekle kalmıyor, kıvrılarak birkaç kez geri dönüyor. Bu yüzden bir noktadan diğerine karadan gitmek çoğu zaman uzun oluyor.</p>

<p>Şehir bu sorunu feribotla çözmüş: CityCat adı verilen hızlı katamaranlar nehir boyunca iskeleleri birbirine bağlıyor ve toplu taşımanın parçası.</p>

{{img:brisbane-citycat}}

<h2>İskeleler yüzer ve rampalı</h2>

<p>Feribot iskeleleri suyun üstünde yüzüyor ve kıyıya rampayla bağlanıyor. Gelgite göre rampanın eğimi değişiyor; alçak suda dik oluyor.</p>

<p>Bir valizle o rampadan inip tekneye geçmek, hem eğim hem de teknenin hareketi nedeniyle zor. Güvertede bagaj için ayrılmış yer de yok.</p>

<h2>South Bank yürüyerek geziliyor</h2>

<p>Nehrin güney yakasındaki South Bank parkları, yapay plajı ve müzeleriyle şehrin en çok kullanılan alanı. Bir uçtan diğerine yürümek yarım saat.</p>

{{img:brisbane-south-bank}}

<p>Müzelerde girişte kontrol var ve yapay plajda dolap bulunmuyor.</p>

<h2>Merkez kompakt ama nehir dolambaçlı</h2>

<p>Brisbane'in iş merkezi nehrin bir kıvrımının içinde ve yürüyerek yirmi dakikada kat ediliyor. Ama o kıvrım nedeniyle karşı yakadaki bir nokta haritada yakın görünüp yürüyerek uzak kalabiliyor.</p>

<p>Bu yüzden feribot çoğu zaman en kısa yol oluyor — ve bavulla en zor yol.</p>

<h2>Queen Street yaya çarşısı</h2>

<p>Merkezdeki Queen Street Mall trafiğe kapalı ve gün boyu kalabalık. Sokak sanatçıları ve tezgâhlar geçidi daraltıyor.</p>

<p>Bavulla o çarşıdan geçmek yavaş; alışveriş merkezlerinde de girişte kontrol var.</p>

<h2>Lone Pine ve koala merkezi yarım gün</h2>

<p>Lone Pine koala parkına nehir üzerinden tekneyle ya da otobüsle gidiliyor; yol yarım saat ve ziyaret iki saat sürüyor.</p>

<p>Teknede bagaj için yer yok ve parkta bırakılacak bir nokta bulunmuyor.</p>

<h2>Havalimanı on beş kilometre</h2>

<p>Brisbane Havalimanı merkeze on beş kilometre ve Airtrain ile yirmi dakika. Tren aynı hatla Gold Coast'a da gidiyor.</p>

<p>Uzun mesafe uçuşları gece; otel çıkışı on. Aradaki saatler yine açıkta.</p>

<h2>Gold Coast ve Sunshine Coast trenle</h2>

<p>Gold Coast'a trenle bir saat, Sunshine Coast'a bir buçuk saat. İkisi de günübirlik gidiliyor ve trenler Roma Street ile Central'dan kalkıyor.</p>

<h2>Nehrin iki yakası köprülerle bağlı</h2>

<p>Merkez ile South Bank arasında yaya köprüleri var ve karşıya geçmek beş dakika sürüyor. Ama köprülere çıkmak rampalarla ve bazı yerlerde merdivenle oluyor.</p>

<p>Bavulla o rampaları çıkmak, kısa mesafeyi uzatıyor.</p>

<h2>Yaz nemli ve öğleden sonra fırtınalı</h2>

<p>Aralık ile mart arasında nem yüksek ve öğleden sonra fırtınaları ani. Nehir kıyısında gölge var ama açık alanlarda yok.</p>

<p>Bavulla o havada dışarıda beklemek zor; kapalı alan aramak gerekiyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "brisbane-luggage-storage-citycat-ferries",
      title: "Brisbane Runs on the River, and the Ferries Have No Luggage Space",
      excerpt:
        "The CityCats are the city's backbone. But the pontoon ramps are narrow and there's nowhere on deck for a case.",
      cover: "brisbane-south-bank",
      body: `
<p>Brisbane sits on both banks of a river, and that river doesn't just divide the city — it loops back on itself several times. Getting from one point to another by road is often a long way round.</p>

<p>The city solved that with ferries: the fast catamarans called CityCats link the terminals along the river as part of public transport.</p>

{{img:brisbane-citycat}}

<h2>The terminals float and are reached by ramp</h2>

<p>The ferry terminals float on the water, joined to the bank by a ramp. The gradient changes with the tide and gets steep at low water.</p>

<p>Getting down that ramp and onto a moving boat with a suitcase is hard work. And there's no space set aside for luggage on deck.</p>

<h2>South Bank is walked</h2>

<p>The South Bank parklands on the south side, with their artificial beach and museums, are the most-used space in the city. Half an hour from end to end.</p>

{{img:brisbane-south-bank}}

<p>The museums screen at the door, and the artificial beach has no lockers.</p>

<h2>Queen Street is a pedestrian mall</h2>

<p>The Queen Street Mall in the centre is closed to traffic and busy all day, with buskers and stalls narrowing the way.</p>

<p>Getting through with a bag is slow, and the shopping centres screen at their entrances too.</p>

<h2>The airport is fifteen kilometres out</h2>

<p>Brisbane airport is fifteen kilometres from the centre, twenty minutes on the Airtrain — the same line that continues to the Gold Coast.</p>

<p>Long-haul flights leave at night; checkout is at ten. Those hours are exposed again.</p>

<h2>The Gold Coast and Sunshine Coast are on the train</h2>

<p>The Gold Coast is an hour by rail, the Sunshine Coast an hour and a half. Both are day trips, from Roma Street and Central.</p>

<h2>Footbridges join the two banks</h2>

<p>Pedestrian bridges link the centre to South Bank and the crossing takes five minutes. But you reach them by ramps, and in places by stairs.</p>

<p>Going up those with a bag stretches a short distance out.</p>

<h2>Humid summers with afternoon storms</h2>

<p>Between December and March the humidity is high and afternoon storms arrive suddenly. There's shade along the river, none in the open spaces.</p>

<p>Waiting outside in that with a bag is hard; you end up hunting for somewhere indoors.</p>
`.trim(),
    },
  ],
};
