import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "johannesburg",
  posts: [
    {
      locale: "tr",
      slug: "johannesburg-aktarma-sehri-gautrain-sandton-valiz",
      title: "Johannesburg Çoğu Kişi İçin Bir Aktarma Şehri",
      excerpt:
        "Cape Town'a, safariye ya da Victoria Şelaleleri'ne giden herkes buradan geçiyor. Aktarmalar da uzun.",
      cover: "johannesburg-sandton",
      body: `
<p>Güney Afrika'ya gelen uçuşların büyük bölümü OR Tambo'ya iniyor. Ama gelenlerin çoğu Johannesburg'da kalmıyor: Cape Town'a, Kruger'e ya da Victoria Şelaleleri'ne bağlanıyor.</p>

<p>Bu bağlantılar her zaman aynı gün olmuyor. Uzun aktarmalar ve bir gecelik konaklamalar yaygın; yani şehirde geçirilen süre çoğu zaman otelsiz.</p>

{{img:johannesburg-sandton}}

<h2>Uzun aktarma havalimanında geçmek zorunda değil</h2>

<p>OR Tambo büyük bir terminal ve içinde oturacak yer var, ama sekiz on saatlik bir bekleme orada geçirilecek bir süre değil. Sandton on beş dakika uzakta.</p>

<p>Tek şart bavulun yanınızda olmaması: tren turnikeli ve alışveriş merkezlerinde girişte kontrol var.</p>

<h2>Gautrain havalimanını Sandton'a bağlıyor</h2>

<p>Gautrain hızlı tren hattı OR Tambo'dan Sandton'a on beş dakikada gidiyor. Bu, Afrika'daki en pratik havalimanı bağlantılarından biri.</p>

<p>Ama tren belirli saatlerde çalışıyor ve istasyonlar turnikeli. Bir valizle geçmek mümkün ama yoğun saatte vagonlar doluyor.</p>

<h2>Sandton ile merkez ayrı dünyalar</h2>

<p>Otellerin ve iş merkezlerinin bulunduğu Sandton kuzeyde; tarihi merkez ve Maboneng gibi mahalleler on beş kilometre güneyde. Aralarında araçla yarım saat var.</p>

{{img:johannesburg-sehir}}

<p>Şehirde yürüyerek gezilen bir merkez yok; her hareket araçla oluyor.</p>

<h2>Constitution Hill ve Maboneng merkezde</h2>

<p>Constitution Hill eski bir hapishane ve bugün anayasa mahkemesinin bulunduğu alan; Maboneng ise dönüştürülmüş depo binalarından oluşan bir mahalle. İkisi de merkezde ve yürüyerek geziliyor.</p>

<p>Girişlerde kontrol var ve büyük çanta kabul edilmiyor.</p>

<h2>Apartheid Müzesi ve Soweto yarım gün</h2>

<p>Apartheid Müzesi şehrin güneyinde ve gezmek üç saat sürüyor; Soweto turları ise yarım günlük. İkisinde de girişte kontrol var ve bagaj kabul edilmiyor.</p>

<p>Turlar sabah kalkıyor ve minibüsler dolu geliyor.</p>

<h2>Kruger'e giden uçuşlar sabah</h2>

<p>Kruger bölgesindeki küçük havaalanlarına iç hat uçuşları sabah erken kalkıyor. Safariye çıkanlar için de ayrı bir kural var: küçük uçaklarda yumuşak çanta zorunlu ve ağırlık sınırı düşük.</p>

<p>Yani sert kabuklu valizle safariye gidilmiyor; o valiz Johannesburg'da kalıyor.</p>

<h2>Pretoria kırk beş kilometre kuzeyde</h2>

<p>Başkent Pretoria Johannesburg'a kırk beş kilometre ve Gautrain ile kırk dakika. Union Buildings ve Voortrekker Anıtı yarım günlük duraklar.</p>

<p>İki şehir arasında gidip gelmek olağan ama her geçiş bir tren ya da araç yolculuğu — ve trenin sonunda yine bir taksi var.</p>

<h2>Yürünecek merkez yok</h2>

<p>Johannesburg'da alışveriş merkezleri kapalı ve klimalı, sokaklar ise araç için. Maboneng ve Braamfontein gibi birkaç mahalle dışında yürüyerek gezilen bir alan yok.</p>

<p>Yani bavulla vakit geçirmek için bile bir kapalı alana girmek gerekiyor.</p>

<h2>Havalimanı merkeze yirmi beş kilometre</h2>

<p>OR Tambo merkeze yirmi beş kilometre. Uzun mesafe uçuşları gece kalkıyor ve otel çıkışı öğlen; arada yine bir gün var.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "johannesburg-luggage-storage-transit-city",
      title: "For Most People Johannesburg Is a Connection",
      excerpt:
        "Everyone heading to Cape Town, a safari or Victoria Falls passes through. And the connections are long.",
      cover: "johannesburg-sandton",
      body: `
<p>Most flights into South Africa land at OR Tambo. But most arrivals don't stay in Johannesburg: they connect on to Cape Town, Kruger or Victoria Falls.</p>

<p>Those connections aren't always the same day. Long layovers and single overnights are common, so time in the city is usually spent without a room.</p>

{{img:johannesburg-sandton}}

<h2>The Gautrain links the airport to Sandton</h2>

<p>The Gautrain reaches Sandton from OR Tambo in fifteen minutes — one of the most practical airport connections in Africa.</p>

<p>But it runs to set hours and the stations have turnstiles. You can get a suitcase through, though the carriages fill at peak times.</p>

<h2>Sandton and the centre are different worlds</h2>

<p>Sandton, where the hotels and offices are, is in the north; the historic centre and districts like Maboneng are fifteen kilometres south, half an hour by road.</p>

{{img:johannesburg-sehir}}

<p>There's no walkable centre here; every move is by vehicle.</p>

<h2>The Apartheid Museum and Soweto are half a day</h2>

<p>The Apartheid Museum is in the south and takes three hours; Soweto tours run half a day. Both screen at the entrance and don't take luggage.</p>

<p>The tours leave in the morning and the minibuses arrive full.</p>

<h2>The Kruger flights go early</h2>

<p>Domestic flights to the small airstrips near Kruger leave early. And safari travel has its own rule: the light aircraft require soft bags and set a low weight limit.</p>

<p>So you don't go on safari with a hard-shell suitcase — that case stays in Johannesburg.</p>

<h2>Pretoria is forty-five kilometres north</h2>

<p>Pretoria, the capital, is forty-five kilometres away and forty minutes on the Gautrain. The Union Buildings and the Voortrekker Monument are half-day stops.</p>

<p>Travelling between the two cities is normal, but every crossing is a train or a drive — with a taxi at the end of the train.</p>

<h2>There's no walkable centre</h2>

<p>Johannesburg's malls are enclosed and air-conditioned; the streets are for vehicles. Beyond a few districts like Maboneng and Braamfontein there's no area you walk.</p>

<p>So even filling time with a bag means going indoors somewhere.</p>

<h2>The airport is twenty-five kilometres out</h2>

<p>OR Tambo is twenty-five kilometres from the centre. Long-haul flights leave at night and checkout is at noon; there's a day in between again.</p>
`.trim(),
    },
  ],
};
