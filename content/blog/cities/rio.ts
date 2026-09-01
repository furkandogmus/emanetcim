import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "rio",
  posts: [
    {
      locale: "tr",
      slug: "rio-plaj-dolabi-yok-teleferik-kabini-valiz",
      title: "Rio'da Plajda Dolap Yok, Teleferikte de Yer Yok",
      excerpt:
        "Copacabana ve Ipanema'da kumsal boyunca hiçbir yapı yok. Şeker Somunu ve Corcovado'ya da bavulla çıkılmıyor.",
      cover: "rio-copacabana",
      body: `
<p>Rio'nun programı iki şey etrafında dönüyor: plajlar ve tepeler. İkisi de bavulla yapılamayan şeyler.</p>

<p>Copacabana ve Ipanema kumsalları kilometrelerce uzanıyor ve üzerlerinde cankurtaran kuleleri dışında yapı yok. Şezlong ve şemsiye kiralanıyor ama emanet dolabı bulunmuyor.</p>

{{img:rio-copacabana}}

<h2>Kumda bavulun başında beklemek bir plan değil</h2>

<p>Sahilde eşya bırakmak zaten önerilmiyor; suya girerken birinin kalması gerekiyor. Bir valizle bu daha da belirgin bir sorun.</p>

<h2>Şeker Somunu iki teleferikle çıkılıyor</h2>

<p>Pão de Açúcar'a iki aşamalı teleferikle çıkılıyor: önce Urca tepesine, sonra zirveye. Kabinler kalabalık ve bagaj için ayrılmış yer yok.</p>

{{img:rio-seker-somunu}}

<p>Corcovado'daki Kurtarıcı İsa heykeline ise dişli trenle ya da minibüsle çıkılıyor; ikisi de saatli ve dolu geliyor. Zirvede son bölüm merdivenle ya da yürüyen merdivenle.</p>

<h2>Sahil yolu sabahları kapanıyor</h2>

<p>Pazar günleri ve tatillerde Copacabana ile Ipanema'nın sahil şeridi araç trafiğine kapanıyor ve koşucular, bisikletliler yolu dolduruyor.</p>

<p>Bu şehrin en güzel saatleri — ama o akışın içinde bavulla yürümek ters yöne gitmek gibi.</p>

<h2>Merkez ile plaj bölgesi ayrı</h2>

<p>Tarihi merkez Centro kuzeyde; Copacabana ve Ipanema güneyde, tünellerin öbür tarafında. Aralarında metroyla yirmi dakika var.</p>

<p>Yani bir günde ikisini birden görmek şehri kat etmek demek ve her geçiş bir metro yolculuğu.</p>

<h2>Botanik bahçesi ve Lage Parkı yürüyerek</h2>

<p>Jardim Botânico ve yanındaki Parque Lage merkezle plaj bölgesinin arasında ve yürüyerek geziliyor. Alan geniş, patikalar toprak ve gölgeli.</p>

<p>İkisinde de girişte kontrol var ve bagaj bırakılacak yer yok.</p>

<h2>Metro turnikeleri dar</h2>

<p>Rio metrosu temiz ve düzenli ama turnikeler dar ve istasyonların bir kısmında yalnızca merdiven var. Yoğun saatlerde vagonlar doluyor.</p>

<h2>Lapa ve Selarón akşam kalabalık</h2>

<p>Merkezdeki Lapa mahallesi akşamları müzik mekânlarıyla doluyor ve kemerlerin çevresi kalabalıklaşıyor. Selarón merdivenleri de hemen yanında ve gün boyu ziyaretçi alıyor.</p>

<p>Merdivenler dar ve iki yönlü kullanılıyor; bavulla çıkmak akışı tamamen durduruyor.</p>

<h2>Havalimanları iki ayrı yerde</h2>

<p>Galeão uluslararası uçuşlara hizmet veriyor ve merkeze yirmi kilometre kuzeyde; Santos Dumont ise iç hatlar için ve merkezin tam içinde.</p>

<p>İki havalimanı arasında aktarma yapan biri için trafik yine belirleyici oluyor.</p>

<h2>Santa Teresa yamaçta ve tramvaylı</h2>

<p>Merkezin üstündeki Santa Teresa mahallesine tarihi bir tramvayla çıkılıyor ve sokaklar dik, taş döşeli. Selarón merdivenleri de o yamacın eteğinde.</p>

<p>Tramvay vagonları açık yanlı ve dar; bagaj için yer yok. Merdivenlerde ise zaten durulacak yer bulunmuyor.</p>

<h2>Karnaval döneminde şehir kapanıyor</h2>

<p>Şubattaki karnavalda sokak geçitleri caddeleri kapatıyor ve ulaşım kesintiye uğruyor. Kalabalık gün boyu sokakta ve otel bulmak zorlaşıyor.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "rio-luggage-storage-beach-cable-car",
      title: "There Are No Lockers on Rio's Beaches, and No Room in the Cable Car",
      excerpt:
        "Nothing stands on the sand at Copacabana or Ipanema. And you don't go up Sugarloaf or Corcovado with a suitcase.",
      cover: "rio-copacabana",
      body: `
<p>Rio revolves around two things: the beaches and the hills. Neither works with a bag.</p>

<p>The sands of Copacabana and Ipanema run for kilometres with nothing on them but lifeguard posts. Loungers and umbrellas are hired out, but there's no storage.</p>

{{img:rio-copacabana}}

<h2>Guarding a suitcase on the sand is not a plan</h2>

<p>Leaving belongings on the beach isn't advised as it is; someone stays behind when the rest go in. With a suitcase the problem is only more obvious.</p>

<h2>Sugarloaf takes two cable cars</h2>

<p>Pão de Açúcar is reached in two stages: first to Urca hill, then to the summit. The cabins are crowded with no space set aside for luggage.</p>

{{img:rio-seker-somunu}}

<p>Christ the Redeemer on Corcovado is reached by cog train or minibus, both timed and both arriving full. The final stretch at the top is stairs or escalators.</p>

<h2>The centre and the beaches are separate</h2>

<p>The historic Centro is to the north; Copacabana and Ipanema are south, through the tunnels. Twenty minutes apart on the metro.</p>

<p>Seeing both in a day means crossing the city, and every crossing is a metro ride.</p>

<h2>The metro turnstiles are narrow</h2>

<p>Rio's metro is clean and orderly, but the turnstiles are narrow and some stations have stairs only. The carriages fill at peak hours.</p>

<h2>Lapa and the Selarón steps fill in the evening</h2>

<p>Lapa in the centre fills with music venues after dark and the area around the arches gets busy. The Selarón steps are right beside it and take visitors all day.</p>

<p>The steps are narrow and used in both directions; going up with a bag stops the flow entirely.</p>

<h2>The two airports are in different places</h2>

<p>Galeão handles international flights and sits twenty kilometres north of the centre; Santos Dumont serves domestic routes from right inside it.</p>

<p>For anyone connecting between them, the traffic decides how long it takes.</p>

<h2>Santa Teresa is on a hill, reached by tram</h2>

<p>The Santa Teresa neighbourhood above the centre is reached by a historic tram, and its streets are steep and cobbled. The Selarón steps are at the foot of the same slope.</p>

<p>The tram cars are open-sided and narrow, with no luggage space. And on the steps there's nowhere to stand still anyway.</p>

<h2>Carnival closes the city</h2>

<p>During February's carnival the street parades close the avenues and transport is disrupted. The crowds are out all day and rooms are hard to find.</p>
`.trim(),
    },
  ],
};
