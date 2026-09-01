import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "meksiko",
  posts: [
    {
      locale: "tr",
      slug: "meksiko-dort-otogar-rakim-metro-valiz",
      title: "Meksiko'da Dört Otogar Var ve Hangisi Olduğunu Yön Belirliyor",
      excerpt:
        "Kuzey, güney, doğu, batı — otobüs terminali gideceğiniz yöne göre değişiyor. Üstüne şehir iki bin iki yüz metre rakımda.",
      cover: "meksiko-zocalo",
      body: `
<p>Meksiko'da otobüs terminalleri pusulaya göre düzenlenmiş: Terminal Norte kuzeye, Terminal Sur güneye, TAPO doğuya, Poniente batıya giden hatlara hizmet veriyor.</p>

<p>Bu sistem mantıklı ama ilk gelenler için şaşırtıcı. Teotihuacán'a gitmek Terminal Norte'den, Puebla'ya TAPO'dan, Cuernavaca'ya Terminal Sur'dan kalkmak demek.</p>

<p>Terminaller birbirinden onlarca kilometre uzakta. Yanlış terminale gitmek burada yarım günü yiyor.</p>

{{img:meksiko-zocalo}}

<h2>Rakım taşımayı zorlaştırıyor</h2>

<p>Şehir iki bin iki yüz kırk metre yükseklikte. Bu, ilk günlerde merdiven çıkarken nefesin çabuk daralması demek — ve elinizde bavul varsa bu belirgin biçimde hissediliyor.</p>

<p>Metro istasyonlarının çoğuna merdivenle iniliyor ve aktarmalar uzun koridorlardan geçiyor.</p>

<h2>Yağmur mevsimi öğleden sonra</h2>

<p>Mayıs ile ekim arasında sağanaklar neredeyse her gün öğleden sonra başlıyor ve sokaklar hızla su tutuyor. Alt geçitler ve metro girişleri sular altında kalabiliyor.</p>

<p>Bavulla o saatlerde dışarıda olmak, sığınacak yer aramakla geçen bir saat demek.</p>

<h2>Metro çok ucuz ama çok kalabalık</h2>

<p>Meksiko metrosu dünyanın en ucuzlarından ve her yere gidiyor. Ama yoğun saatlerde vagonlar tıklım tıklım oluyor ve büyük bagajla binmek pratikte mümkün değil.</p>

<p>Bazı hatlarda hacimli eşyayla seyahat konusunda kısıtlar da uygulanıyor.</p>

<h2>Centro Histórico yaya bölgesi</h2>

<p>Zócalo çevresindeki caddelerin bir kısmı trafiğe kapalı ve gün boyu kalabalık. Madero caddesi baştan sona yaya ve seyyar satıcılar iki yandan geçidi daraltıyor.</p>

{{img:meksiko-katedral}}

<p>Katedral ve Templo Mayor girişlerinde çanta kontrolü var.</p>

<h2>Teotihuacán yarım günden fazla</h2>

<p>Piramitler şehre elli kilometre ve otobüsle bir saat. Alanda yürüyerek gezilen mesafeler uzun ve piramitlere tırmanılıyor.</p>

<p>Otobüste bagaj bölmesi var ama alanda bırakacak yer yok.</p>

<h2>Chapultepec parkı ve müzeler</h2>

<p>Chapultepec Ormanı şehrin en büyük parkı ve içinde Antropoloji Müzesi ile şato var. Müzeyi gezmek üç saat sürüyor ve girişte çanta kontrolü uygulanıyor.</p>

<p>Park geniş; girişten müzeye yürümek on beş dakika ve gölge sınırlı.</p>

<h2>Roma ve Condesa yürüyerek</h2>

<p>Roma ve Condesa mahalleleri ağaçlı sokaklar ve kafelerle dolu; merkeze metroyla on beş dakika. Kaldırımlar geniş ama ağaç kökleriyle kabarmış.</p>

<h2>Xochimilco ve Coyoacán güneyde</h2>

<p>Xochimilco'nun kanalları ve Coyoacán'ın meydanı şehrin güneyinde ve merkeze metroyla bir saat. İkisi de yarım günlük duraklar.</p>

<p>Xochimilco'da trajinera denen düz tabanlı teknelere biniliyor; güverte açık ve bagaj için ayrılmış yer yok.</p>

<h2>Havalimanı yakın ama trafik ağır</h2>

<p>Benito Juárez Havalimanı merkeze beş kilometre. Mesafe kısa ama trafik yoğun; yol yarım saati aşabiliyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "mexico-city-luggage-storage-four-bus-terminals",
      title: "Mexico City Has Four Bus Terminals, and Your Direction Picks One",
      excerpt:
        "North, south, east, west — the terminal depends on where you're going. And the city sits at 2,240 metres.",
      cover: "meksiko-zocalo",
      body: `
<p>Mexico City's bus terminals are organised by compass point: Terminal Norte serves the north, Terminal Sur the south, TAPO the east, Poniente the west.</p>

<p>The system is logical but catches first-timers out. Teotihuacán goes from Terminal Norte, Puebla from TAPO, Cuernavaca from Terminal Sur.</p>

<p>The terminals are tens of kilometres apart. Going to the wrong one costs half a day here.</p>

{{img:meksiko-zocalo}}

<h2>The altitude makes carrying harder</h2>

<p>The city sits at 2,240 metres. In the first days that means getting out of breath on stairs — and with a bag in hand you notice it distinctly.</p>

<p>Most metro stations are reached by stairs, and the interchanges run through long corridors.</p>

<h2>The metro is very cheap and very crowded</h2>

<p>Mexico City's metro is among the cheapest in the world and it goes everywhere. But at peak times the carriages are packed solid, and boarding with large luggage isn't realistic.</p>

<p>Some lines also restrict bulky items outright.</p>

<h2>The Centro Histórico is pedestrianised</h2>

<p>Several streets around the Zócalo are closed to traffic and busy all day. Calle Madero is pedestrian end to end, with street vendors narrowing it from both sides.</p>

{{img:meksiko-katedral}}

<p>The cathedral and the Templo Mayor check bags at the entrance.</p>

<h2>Teotihuacán is more than half a day</h2>

<p>The pyramids are fifty kilometres out, an hour by bus. The distances inside the site are long and walked, and you climb the pyramids.</p>

<p>The bus has a luggage hold, but there's nowhere to leave anything at the site.</p>

<h2>Roma and Condesa are walked</h2>

<p>The Roma and Condesa neighbourhoods are tree-lined streets full of cafés, fifteen minutes from the centre on the metro. The pavements are wide but lifted by tree roots.</p>

<h2>Xochimilco and Coyoacán are in the south</h2>

<p>The canals at Xochimilco and the square at Coyoacán are in the south of the city, an hour from the centre by metro. Both are half-day stops.</p>

<p>At Xochimilco you board the flat-bottomed trajinera boats; the deck is open and there's no space set aside for luggage.</p>

<h2>The airport is close, the traffic isn't</h2>

<p>Benito Juárez airport is five kilometres from the centre. Short in distance, but the traffic is heavy and the drive can exceed half an hour.</p>
`.trim(),
    },
  ],
};
