import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "auckland",
  posts: [
    {
      locale: "tr",
      slug: "auckland-queen-street-yokus-feribot-valiz",
      title: "Auckland'da Queen Street Limandan Yukarı Doğru Tırmanıyor",
      excerpt:
        "Cadde limanla merkez arasında sürekli yokuş. Adalara feribotlar da o limandan kalkıyor.",
      cover: "auckland-queen-street",
      body: `
<p>Auckland'ın ana caddesi Queen Street limandan başlayıp güneye doğru tırmanıyor. Kot farkı belirgin: alt uçtan üst uca çıkmak yürüyerek yirmi dakika ve baştan sona yokuş.</p>

<p>Şehir zaten volkanik tepelerin üstüne kurulu; yan sokaklar da eğimli ve bazılarında kaldırım basamaklı.</p>

{{img:auckland-queen-street}}

<h2>Bavulla o yokuşu çıkmak günün ilk işi</h2>

<p>Otellerin bir kısmı caddenin üst ucunda; feribot terminali ise en altta. Yeni Zelanda'ya uzun bir uçuşla gelen biri için bu yokuş, varış sabahının ilk sınavı oluyor.</p>

<h2>Adalara feribotlar limandan</h2>

<p>Waiheke ve Rangitoto adalarına feribotlar merkezdeki terminalden kalkıyor. Waiheke'ye kırk dakika, Rangitoto'ya yirmi beş.</p>

{{img:auckland-liman}}

<p>Rangitoto bir volkan konisi ve zirveye yürüyerek çıkılıyor; patika volkanik kaya üzerinde ve bir saat sürüyor. Adada bagaj bırakılacak yer yok.</p>

<h2>Havalimanı yirmi kilometre ve tren yok</h2>

<p>Auckland Havalimanı merkeze yirmi kilometre ve şehre tren bağlantısı bulunmuyor; otobüs ya da taksi kullanılıyor. Yol yarım saat ile bir saat arası.</p>

<p>Uzun mesafe uçuşları gece kalkıyor ya da sabah erken iniyor. İki durumda da otel saatiyle çakışıyor.</p>

<h2>Ponsonby ve Devonport ayrı taraflar</h2>

<p>Ponsonby merkezin batısında, kafeleri ve dükkânlarıyla yürüyerek geziliyor; Devonport ise limanın karşı yakasında ve feribotla on iki dakika.</p>

<p>İkisi de birer yarım günlük durak ve ikisine de bavulla gitmenin anlamı yok.</p>

<h2>Sky Tower ve müzelerde kontrol var</h2>

<p>Sky Tower'ın gözlem katına asansörle çıkılıyor ve girişte kontrol yapılıyor; büyük bagaj kabul edilmiyor. Savaş Anıtı Müzesi de Domain parkının ortasında ve yürüyerek gidiliyor.</p>

<h2>Mount Eden ve volkan konileri yürüyerek</h2>

<p>Şehrin içindeki volkan konileri — Mount Eden, One Tree Hill — yürüyerek çıkılıyor ve zirveden şehir görünüyor. Patikalar çimen ve eğimli.</p>

<p>Merkeze birkaç kilometre ve otobüsle gidiliyor; yukarıda bagaj bırakılacak yer yok.</p>

<h2>Kuzey ve güney günübirlik</h2>

<p>Kuzeydeki Bay of Islands'a araçla üç saat, güneydeki Hobbiton ve Rotorua'ya iki buçuk saat. Turlar sabah yedide kalkıyor ve akşam geç dönüyor.</p>

<p>Bu turlarda bavul için yer yok ve dönüş saati sabit değil.</p>

<h2>Britomart merkezde ama hatlar sınırlı</h2>

<p>Britomart merkezdeki tren istasyonu ve banliyö hatları oradan kalkıyor. Ama ağ sınırlı ve pek çok mahalleye otobüsle gidiliyor.</p>

<p>İstasyon yer altında ve peronlara yürüyen merdivenle iniliyor; yoğun saatte kalabalık oluyor.</p>

<h2>Yağmur her mevsim mümkün</h2>

<p>Auckland'da hava gün içinde birkaç kez değişiyor ve yağmur her mevsim mümkün. Şemsiyeden çok mont tercih ediliyor.</p>

<p>Bavulla o havada dışarıda beklemek, bavulun da ıslanması demek.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "auckland-luggage-storage-queen-street-hill",
      title: "Queen Street in Auckland Climbs Away From the Harbour",
      excerpt:
        "The street rises the whole way from the waterfront to the top of town. And the island ferries leave from that harbour.",
      cover: "auckland-queen-street",
      body: `
<p>Auckland's main street, Queen Street, starts at the harbour and climbs south. The change in level is noticeable: twenty minutes on foot from bottom to top, uphill all the way.</p>

<p>The city is built over volcanic hills anyway; the side streets slope and some have stepped pavements.</p>

{{img:auckland-queen-street}}

<h2>That climb with a bag is the first job of the day</h2>

<p>Some of the hotels are at the top of the street; the ferry terminal is at the very bottom. After a long flight to New Zealand, that hill is the first test of arrival morning.</p>

<h2>The island ferries go from the harbour</h2>

<p>Ferries to Waiheke and Rangitoto leave the terminal in the centre — forty minutes to Waiheke, twenty-five to Rangitoto.</p>

{{img:auckland-liman}}

<p>Rangitoto is a volcanic cone climbed on foot; the path crosses volcanic rock and takes an hour. There's nowhere on the island to leave a bag.</p>

<h2>The airport is twenty kilometres out with no train</h2>

<p>Auckland airport is twenty kilometres from the centre with no rail link; you take a bus or a taxi. Half an hour to an hour.</p>

<p>Long-haul flights leave at night or land early in the morning. Either way it collides with hotel hours.</p>

<h2>The Sky Tower and museums screen bags</h2>

<p>The Sky Tower observation deck is reached by lift, with screening at the entrance; large luggage isn't admitted. The War Memorial Museum sits in the middle of the Domain and is reached on foot.</p>

<h2>North and south are day trips</h2>

<p>The Bay of Islands is three hours north by road; Hobbiton and Rotorua two and a half south. The tours leave at seven and return late.</p>

<p>They have no room for luggage, and the return time isn't fixed.</p>

<h2>Britomart is central but the network is limited</h2>

<p>Britomart is the downtown railway station and the suburban lines run from it. But the network is limited and most neighbourhoods are reached by bus.</p>

<p>The station is underground, reached by escalators, and it gets busy at peak.</p>

<h2>Rain is possible in every season</h2>

<p>Auckland's weather changes several times a day and rain is possible year-round. People wear jackets rather than carry umbrellas.</p>

<p>Waiting in it with a bag means the bag gets soaked too.</p>
`.trim(),
    },
  ],
};
