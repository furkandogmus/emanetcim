import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "san-francisco",
  posts: [
    {
      locale: "tr",
      slug: "san-francisco-yokuslar-cable-car-alcatraz-valiz",
      title: "San Francisco'da Her Yol Ya Yokuş Yukarı Ya Yokuş Aşağı",
      excerpt:
        "Şehir kırk küsur tepenin üstüne kurulu ve bazı kaldırımlar basamaklı. Tekerlekli valiz burada işlevini kaybediyor.",
      cover: "sf-cable-car",
      body: `
<p>San Francisco'nun ilk fark edilen özelliği eğim. Şehir onlarca tepenin üstüne kurulu ve caddeler bu tepeleri dolaşmak yerine doğrudan tırmanıyor.</p>

<p>Bazı sokaklarda kaldırımın kendisi basamaklı; yürüyen insan için bile bir çaba. Tekerlekli bir valizle o eğimlerde ilerlemek pratik olarak mümkün değil — bavul ya sizi çekiyor ya siz onu.</p>

{{img:sf-cable-car}}

<h2>Cable car'da bagaj yeri yok</h2>

<p>Şehrin simgesi cable car'lar yokuşları çıkmak için tasarlanmış ama içleri küçük. Yoğun saatlerde yolcular basamakta ayakta gidiyor ve tutunmak gerekiyor.</p>

<p>Bir valizle binmek hem sizin hem diğer yolcuların işini zorlaştırıyor; ayrıca duraklarda kuyruk uzun.</p>

<h2>Alcatraz bileti saatli ve çanta kuralı var</h2>

<p>Alcatraz'a feribotlar Pier 33'ten kalkıyor, biletler saatli ve haftalar öncesinden tükeniyor. Adaya çıkarken taşınabilecek eşya sınırlı; büyük çanta kabul edilmiyor.</p>

<p>Ada turu iki buçuk üç saat sürüyor ve adada bagaj bırakılacak yer yok. Yani o gün bavulunuz şehirde kalmak zorunda.</p>

<h2>Ferry Building ve körfez tarafı</h2>

<p>Embarcadero boyunca uzanan sahil yolu düz ve geniş; Ferry Building'deki pazar hafta içi de açık. Buradan Fisherman's Wharf'a yürümek yarım saat.</p>

<p>Yol düz olduğu için bavulla yürünebilir — ama şehirdeki tek düz güzergâh bu ve geri kalan her yön yokuş.</p>

<h2>Fisherman's Wharf ve iskeleler yürüyerek</h2>

<p>Fisherman's Wharf, Pier 39 ve Aquatic Park sahil boyunca birbirine yakın ve yürüyerek geziliyor. Zemin düz — şehirdeki nadir düz bölgelerden biri.</p>

{{img:sf-fishermans-wharf}}

<p>Ama oradan Union Square'e ya da Chinatown'a çıkmak yeniden yokuş demek.</p>

<h2>Chinatown ve North Beach dar sokaklar</h2>

<p>Chinatown'un yan sokakları dar ve tezgâhlarla dolu; North Beach'in kaldırımları da kafe masalarıyla daralıyor. İki mahalle birbirine bitişik ve yürüyerek geziliyor.</p>

<p>Ama ikisi de yamaçta; Union Square'den Chinatown'a çıkmak baştan sona yokuş.</p>

<h2>SFO ve BART bağlantısı</h2>

<p>SFO şehre yaklaşık yirmi kilometre ve BART ile yarım saat. İstasyonlarda asansör var ama turnikelerden geniş kapı kullanmak gerekiyor.</p>

<p>Uçuşların çoğu akşam; otel çıkışı on iki. Aradaki saatler yine açıkta.</p>

<h2>Kablo tramvayının dönüş noktasında kuyruk</h2>

<p>Powell Sokağı'ndaki dönüş noktasında yaz aylarında kuyruk yarım saati bulabiliyor. Kuyruk kaldırımda oluşuyor ve gölge yok.</p>

<p>O kuyrukta bavulla beklemek hem yorucu hem de sıranın akışını yavaşlatıyor.</p>

<h2>Golden Gate köprüsü yürüyüşü</h2>

<p>Köprünün üzerinden yürümek yaklaşık iki buçuk kilometre ve rüzgârlı. Köprü girişine ulaşmak da otobüsle ya da yokuş yukarı yürüyerek oluyor.</p>

<h2>Sis ve rüzgâr yaz aylarında da var</h2>

<p>San Francisco'da yaz sabahları sisli ve serin; rüzgâr körfezden geliyor. Şehirde bavulla dışarıda beklemek yılın hiçbir zamanı keyifli değil.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "san-francisco-luggage-storage-hills",
      title: "In San Francisco Every Street Is Either Up or Down",
      excerpt:
        "The city sits on more than forty hills and some pavements are stepped. A wheeled case loses its purpose here.",
      cover: "sf-cable-car",
      body: `
<p>The first thing you notice about San Francisco is the gradient. The city is built over dozens of hills, and the streets climb them straight rather than going round.</p>

<p>On some blocks the pavement itself is stepped — an effort even on foot. Getting a wheeled case up or down those slopes isn't realistic: either it pulls you or you pull it.</p>

{{img:sf-cable-car}}

<h2>There's no luggage space on a cable car</h2>

<p>The cable cars were built to climb those hills, but they're small inside. At busy times passengers ride standing on the running board, holding on.</p>

<p>Boarding with a suitcase makes it harder for you and everyone else — and the queues at the turnarounds are long.</p>

<h2>Alcatraz is a timed ticket with a bag rule</h2>

<p>Ferries to Alcatraz leave from Pier 33 on timed tickets that sell out weeks ahead. What you can bring onto the island is limited, and large bags aren't allowed.</p>

<p>The visit takes two and a half to three hours, and there's nowhere on the island to leave anything. So on that day the bag has to stay in the city.</p>

<h2>Fisherman's Wharf and the piers are walked</h2>

<p>Fisherman's Wharf, Pier 39 and Aquatic Park sit close together along the shore and are walked. The ground is flat — one of the rare flat stretches in town.</p>

{{img:sf-fishermans-wharf}}

<p>But heading from there up to Union Square or Chinatown means climbing again.</p>

<h2>SFO and the BART link</h2>

<p>SFO is about twenty kilometres out, half an hour on BART. The stations have lifts, but you'll need the wide gate rather than the turnstile.</p>

<p>Most flights are in the evening and checkout is at noon. Those hours are exposed again.</p>

<h2>The cable car queue at the turnaround</h2>

<p>At the Powell Street turnaround the summer queue can reach half an hour. It forms on the pavement, in the sun.</p>

<p>Waiting in it with a bag is tiring and slows the line behind you.</p>

<h2>Walking the Golden Gate</h2>

<p>Crossing the bridge on foot is about two and a half kilometres and windy. Getting to the bridge approach means a bus, or a walk uphill.</p>

<h2>The fog and wind don't stop for summer</h2>

<p>Summer mornings here are foggy and cool, with wind off the bay. Waiting outside with a bag isn't pleasant at any time of year.</p>
`.trim(),
    },
  ],
};
