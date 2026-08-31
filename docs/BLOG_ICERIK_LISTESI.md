# Talep testi şehirleri için blog içeriği — durum listesi

**Son durum: 2026-09-01.** Talep testi (`isPrelaunch`) noktası koyduğumuz **265
şehrin** her biri için TR + EN bir blog yazısı yazılıyor. Yazılar kodda durur
(`content/blog/cities/<anahtar>.ts`), görseller depoda
(`public/images/blog/*.webp`), veritabanına `scripts/blog-city-posts.ts` yazar.

| | |
|---|---|
| Yazısı olan şehir | **3 / 265** (aşağıdaki tablo) |
| Yayına yazma | `npx tsx scripts/blog-city-posts.ts --apply` (kuru çalışma varsayılan) |
| Denetim | `npx tsx scripts/blog-city-posts.ts --verify` + `npx tsx scripts/blog-images.ts --verify` |
| Eksik listesi | `npx tsx scripts/blog-city-posts.ts --coverage` |
| Bu tabloyu üret | `npx tsx scripts/blog-city-posts.ts --list-md` |

## Neden bu iş var

Talep testi noktaları aramada ve haritada görünüyor
(`src/lib/public-shop-filter.ts`), yani bir misafir "Ankara valiz emanet" arayıp
noktaya geliyor — ve arkasında okuyacak hiçbir şey bulamıyordu. Yazı iki işi
birden yapıyor: o şehre gelen insana gerçekten işe yarar bilgi veriyor (hangi
müze valizi içeri almıyor, terminal emaneti kaçta kapanıyor, hangi semtte
bavulla yürünmez) ve nokta sayfasına organik giriş üretiyor.

## Kurallar

1. **Şehir başına iki yazı: TR ve EN.** `--verify` eksik dili sayar.
2. **Her yazıda en az iki görsel** (kapak + gövdede en az bir `{{img:...}}`).
3. **Görsel o şehrin görseli olmak zorunda.** Manifestteki `cityKey` yazının
   şehriyle eşleşmiyorsa `--verify` `ILGISIZ GORSEL` der ve düşer. Görseller
   Wikimedia Commons'tan indiriliyor; kaynak URL, fotoğrafçı ve lisans manifeste
   yazılıyor ve künye yazının sonunda otomatik basılıyor (çoğu CC BY-SA, atıfsız
   kullanım ihlal).
4. **Ticari kullanıma kapalı lisans reddedilir** (`NonCommercial`,
   `NoDerivatives`) — `scripts/blog-images.ts` indirmeden önce durdurur.
5. **Yazı en az 350 kelime** ve o şehre özgü somut bilgi taşımalı. Şehir adı
   değiştirilince hâlâ doğru olan bir metin, hiçbir şey anlatmıyor demektir.
6. **Kapanış paragrafı dürüst olmalı:** nokta henüz açık değil, talep ölçülüyor,
   e-posta bırakılabilir. Açık gibi anlatmak yalan olurdu.

## Görsel eklemek

```bash
npx tsx scripts/blog-images.ts --search "Izmir Konak clock tower"

npx tsx scripts/blog-images.ts --add izmir-saat-kulesi \
  --file "File:Izmir Saat Kulesi.jpg" --city izmir \
  --alt-tr "..." --alt-en "..." \
  --caption-tr "..." --caption-en "..."
```

İndirilen dosya 1400px genişliğe küçültülüp WebP'ye çevrilir (tipik 80–150 KB).
`--verify` 400 KB üstünü ve manifestte karşılığı olmayan dosyayı yakalar.
**İndirdiğiniz her görseli açıp bakın** — Commons'ta başlık doğru, fotoğraf
alakasız olabilir.

## Şehir tablosu

<!-- Aşağısı üretilmiştir: npx tsx scripts/blog-city-posts.ts --list-md -->
<!-- URETILDI: npx tsx scripts/blog-city-posts.ts --list-md -->
<!-- 3/265 sehir -->

| # | Ülke | Şehir | Anahtar | Nokta | Durum | TR slug | EN slug |
|---|---|---|---|---|---|---|---|
| 1 | TR | İstanbul | `istanbul` | 10 | — |  |  |
| 2 | TR | Ankara | `ankara` | 6 | yayında | ankara-valiz-birakma-noktalari | ankara-luggage-storage-guide |
| 3 | TR | İzmir | `izmir` | 5 | yayında | izmir-valiz-emanet-konak-alsancak | izmir-luggage-storage-guide |
| 4 | TR | Antalya | `antalya` | 5 | yayında | antalya-son-gun-valiz-nereye | antalya-luggage-storage-last-day |
| 5 | TR | Bodrum | `bodrum` | 5 | — |  |  |
| 6 | TR | Bursa | `bursa` | 4 | — |  |  |
| 7 | TR | Adana | `adana` | 2 | — |  |  |
| 8 | TR | Gaziantep | `gaziantep` | 2 | — |  |  |
| 9 | TR | Konya | `konya` | 2 | — |  |  |
| 10 | TR | Trabzon | `trabzon` | 3 | — |  |  |
| 11 | TR | Kayseri | `kayseri` | 2 | — |  |  |
| 12 | TR | Eskişehir | `eskisehir` | 2 | — |  |  |
| 13 | TR | Samsun | `samsun` | 1 | — |  |  |
| 14 | TR | Şanlıurfa | `sanliurfa` | 2 | — |  |  |
| 15 | TR | Diyarbakır | `diyarbakir` | 1 | — |  |  |
| 16 | TR | Mersin | `mersin` | 2 | — |  |  |
| 17 | TR | Kapadokya | `kapadokya` | 4 | — |  |  |
| 18 | TR | Denizli | `pamukkale` | 2 | — |  |  |
| 19 | TR | Selçuk | `selcuk` | 2 | — |  |  |
| 20 | TR | Kuşadası | `kusadasi` | 2 | — |  |  |
| 21 | TR | Çeşme | `cesme` | 3 | — |  |  |
| 22 | TR | Fethiye | `fethiye` | 3 | — |  |  |
| 23 | TR | Marmaris | `marmaris` | 2 | — |  |  |
| 24 | TR | Kaş | `kas` | 2 | — |  |  |
| 25 | TR | Alanya | `alanya` | 2 | — |  |  |
| 26 | TR | Side | `side` | 2 | — |  |  |
| 27 | TR | Kemer | `kemer` | 1 | — |  |  |
| 28 | TR | Didim | `didim` | 1 | — |  |  |
| 29 | TR | Safranbolu | `safranbolu` | 1 | — |  |  |
| 30 | TR | Ayvalık | `ayvalik` | 2 | — |  |  |
| 31 | TR | Çanakkale | `canakkale` | 4 | — |  |  |
| 32 | TR | Bergama | `bergama` | 1 | — |  |  |
| 33 | TR | Mardin | `mardin` | 1 | — |  |  |
| 34 | TR | Van | `van` | 2 | — |  |  |
| 35 | TR | Kars | `kars` | 2 | — |  |  |
| 36 | TR | Rize | `rize` | 2 | — |  |  |
| 37 | TR | Amasya | `amasya` | 1 | — |  |  |
| 38 | TR | Adıyaman | `adiyaman` | 1 | — |  |  |
| 39 | TR | Datça | `datca` | 1 | — |  |  |
| 40 | GB | London | `londra` | 9 | — |  |  |
| 41 | NL | Amsterdam | `amsterdam` | 7 | — |  |  |
| 42 | ES | Madrid | `madrid` | 5 | — |  |  |
| 43 | FR | Paris | `paris` | 9 | — |  |  |
| 44 | ES | Barcelona | `barcelona` | 6 | — |  |  |
| 45 | IT | Roma | `roma` | 7 | — |  |  |
| 46 | DE | Berlin | `berlin` | 7 | — |  |  |
| 47 | IT | Milano | `milano` | 3 | — |  |  |
| 48 | IT | Venezia | `venedik` | 3 | — |  |  |
| 49 | IT | Firenze | `floransa` | 3 | — |  |  |
| 50 | IT | Napoli | `napoli` | 2 | — |  |  |
| 51 | IT | Pisa | `pisa` | 1 | — |  |  |
| 52 | IT | Verona | `verona` | 1 | — |  |  |
| 53 | IT | Bologna | `bologna` | 1 | — |  |  |
| 54 | IT | Torino | `torino` | 1 | — |  |  |
| 55 | IT | Palermo | `palermo` | 1 | — |  |  |
| 56 | PT | Lisboa | `lizbon` | 6 | — |  |  |
| 57 | PT | Porto | `porto` | 2 | — |  |  |
| 58 | ES | Sevilla | `sevilla` | 2 | — |  |  |
| 59 | ES | Granada | `granada` | 2 | — |  |  |
| 60 | ES | València | `valensiya` | 2 | — |  |  |
| 61 | ES | Málaga | `malaga` | 2 | — |  |  |
| 62 | ES | Bilbao | `bilbao` | 1 | — |  |  |
| 63 | ES | San Sebastián | `san-sebastian` | 1 | — |  |  |
| 64 | ES | Palma | `mallorca` | 1 | — |  |  |
| 65 | ES | Eivissa | `ibiza` | 1 | — |  |  |
| 66 | AT | Wien | `viyana` | 3 | — |  |  |
| 67 | AT | Salzburg | `salzburg` | 1 | — |  |  |
| 68 | AT | Innsbruck | `innsbruck` | 1 | — |  |  |
| 69 | CZ | Praha | `prag` | 3 | — |  |  |
| 70 | HU | Budapest | `budapeste` | 3 | — |  |  |
| 71 | DE | München | `munih` | 2 | — |  |  |
| 72 | DE | Frankfurt | `frankfurt` | 2 | — |  |  |
| 73 | DE | Hamburg | `hamburg` | 2 | — |  |  |
| 74 | DE | Köln | `koln` | 1 | — |  |  |
| 75 | DE | Düsseldorf | `dusseldorf` | 1 | — |  |  |
| 76 | BE | Bruxelles | `bruksel` | 2 | — |  |  |
| 77 | BE | Brugge | `brugge` | 1 | — |  |  |
| 78 | BE | Antwerpen | `anvers` | 1 | — |  |  |
| 79 | NL | Rotterdam | `rotterdam` | 1 | — |  |  |
| 80 | NL | Den Haag | `lahey` | 1 | — |  |  |
| 81 | DK | København | `kopenhag` | 2 | — |  |  |
| 82 | SE | Stockholm | `stockholm` | 2 | — |  |  |
| 83 | NO | Oslo | `oslo` | 1 | — |  |  |
| 84 | FI | Helsinki | `helsinki` | 1 | — |  |  |
| 85 | IS | Reykjavík | `reykjavik` | 1 | — |  |  |
| 86 | IE | Dublin | `dublin` | 2 | — |  |  |
| 87 | GB | Edinburgh | `edinburgh` | 2 | — |  |  |
| 88 | GB | Manchester | `manchester` | 1 | — |  |  |
| 89 | GB | Liverpool | `liverpool` | 1 | — |  |  |
| 90 | CH | Zürich | `zurih` | 1 | — |  |  |
| 91 | CH | Genève | `cenevre` | 1 | — |  |  |
| 92 | CH | Luzern | `luzern` | 1 | — |  |  |
| 93 | CH | Interlaken | `interlaken` | 1 | — |  |  |
| 94 | PL | Warszawa | `varsova` | 2 | — |  |  |
| 95 | PL | Kraków | `krakov` | 2 | — |  |  |
| 96 | PL | Gdańsk | `gdansk` | 1 | — |  |  |
| 97 | PL | Wrocław | `wroclaw` | 1 | — |  |  |
| 98 | GR | Athens | `atina` | 4 | — |  |  |
| 99 | GR | Thessaloniki | `selanik` | 2 | — |  |  |
| 100 | GR | Santorini | `santorini` | 2 | — |  |  |
| 101 | GR | Mykonos | `mykonos` | 1 | — |  |  |
| 102 | GR | Crete | `girit` | 2 | — |  |  |
| 103 | GR | Rhodes | `rodos` | 1 | — |  |  |
| 104 | HR | Dubrovnik | `dubrovnik` | 1 | — |  |  |
| 105 | HR | Split | `split` | 2 | — |  |  |
| 106 | HR | Zagreb | `zagreb` | 1 | — |  |  |
| 107 | SI | Ljubljana | `ljubljana` | 1 | — |  |  |
| 108 | SK | Bratislava | `bratislava` | 1 | — |  |  |
| 109 | RO | București | `bukres` | 2 | — |  |  |
| 110 | RO | Brașov | `brasov` | 1 | — |  |  |
| 111 | BG | Sofia | `sofya` | 2 | — |  |  |
| 112 | BG | Plovdiv | `plovdiv` | 1 | — |  |  |
| 113 | RS | Beograd | `belgrad` | 1 | — |  |  |
| 114 | BA | Sarajevo | `saraybosna` | 1 | — |  |  |
| 115 | BA | Mostar | `mostar` | 1 | — |  |  |
| 116 | MK | Skopje | `uskup` | 1 | — |  |  |
| 117 | MK | Ohrid | `ohrid` | 1 | — |  |  |
| 118 | AL | Tiranë | `tiran` | 1 | — |  |  |
| 119 | ME | Budva | `budva` | 1 | — |  |  |
| 120 | ME | Kotor | `kotor` | 1 | — |  |  |
| 121 | LV | Riga | `riga` | 1 | — |  |  |
| 122 | LT | Vilnius | `vilnius` | 1 | — |  |  |
| 123 | EE | Tallinn | `tallinn` | 1 | — |  |  |
| 124 | FR | Nice | `nice` | 2 | — |  |  |
| 125 | FR | Marseille | `marsilya` | 2 | — |  |  |
| 126 | FR | Lyon | `lyon` | 2 | — |  |  |
| 127 | FR | Bordeaux | `bordeaux` | 1 | — |  |  |
| 128 | FR | Strasbourg | `strasbourg` | 1 | — |  |  |
| 129 | FR | Cannes | `cannes` | 1 | — |  |  |
| 130 | MC | Monako | `monako` | 1 | — |  |  |
| 131 | GE | Batumi | `batum` | 1 | — |  |  |
| 132 | GE | Tbilisi | `tiflis` | 2 | — |  |  |
| 133 | AM | Yerevan | `erivan` | 1 | — |  |  |
| 134 | AZ | Bakı | `baku` | 1 | — |  |  |
| 135 | SA | Makkah | `mekke` | 5 | — |  |  |
| 136 | SA | Madinah | `medine` | 5 | — |  |  |
| 137 | SA | Jeddah | `cidde` | 2 | — |  |  |
| 138 | SA | Riyadh | `riyad` | 2 | — |  |  |
| 139 | AE | Dubai | `dubai` | 6 | — |  |  |
| 140 | AE | Abu Dhabi | `abu-dabi` | 2 | — |  |  |
| 141 | AE | Sharjah | `sarja` | 1 | — |  |  |
| 142 | QA | Doha | `doha` | 2 | — |  |  |
| 143 | KW | Kuwait City | `kuveyt` | 1 | — |  |  |
| 144 | BH | Manama | `manama` | 1 | — |  |  |
| 145 | OM | Muscat | `maskat` | 1 | — |  |  |
| 146 | JO | Amman | `amman` | 2 | — |  |  |
| 147 | JO | Wadi Musa | `petra` | 1 | — |  |  |
| 148 | JO | Aqaba | `akabe` | 1 | — |  |  |
| 149 | LB | Beirut | `beyrut` | 2 | — |  |  |
| 150 | EG | Cairo | `kahire` | 3 | — |  |  |
| 151 | EG | Alexandria | `iskenderiye` | 1 | — |  |  |
| 152 | EG | Luxor | `luksor` | 1 | — |  |  |
| 153 | EG | Hurghada | `hurgada` | 1 | — |  |  |
| 154 | EG | Sharm El Sheikh | `sarm-el-seyh` | 1 | — |  |  |
| 155 | MA | Marrakech | `marakes` | 2 | — |  |  |
| 156 | MA | Casablanca | `kazablanka` | 1 | — |  |  |
| 157 | MA | Fès | `fes` | 1 | — |  |  |
| 158 | MA | Tanger | `tanca` | 1 | — |  |  |
| 159 | MA | Chefchaouen | `safsavan` | 1 | — |  |  |
| 160 | TN | Tunis | `tunus` | 1 | — |  |  |
| 161 | JP | Tokyo | `tokyo` | 5 | — |  |  |
| 162 | JP | Osaka | `osaka` | 3 | — |  |  |
| 163 | JP | Kyoto | `kyoto` | 3 | — |  |  |
| 164 | JP | Hiroshima | `hirosima` | 1 | — |  |  |
| 165 | JP | Nara | `nara` | 1 | — |  |  |
| 166 | JP | Sapporo | `sapporo` | 1 | — |  |  |
| 167 | JP | Fukuoka | `fukuoka` | 1 | — |  |  |
| 168 | KR | Seoul | `seul` | 4 | — |  |  |
| 169 | KR | Busan | `busan` | 2 | — |  |  |
| 170 | CN | Beijing | `pekin` | 3 | — |  |  |
| 171 | CN | Shanghai | `sanghay` | 3 | — |  |  |
| 172 | CN | Xi'an | `xian` | 1 | — |  |  |
| 173 | TW | Taipei | `taipei` | 3 | — |  |  |
| 174 | TH | Bangkok | `bangkok` | 4 | — |  |  |
| 175 | TH | Chiang Mai | `chiang-mai` | 1 | — |  |  |
| 176 | TH | Phuket | `phuket` | 2 | — |  |  |
| 177 | TH | Pattaya | `pattaya` | 1 | — |  |  |
| 178 | SG | Singapur | `singapur` | 3 | — |  |  |
| 179 | MY | Kuala Lumpur | `kuala-lumpur` | 3 | — |  |  |
| 180 | MY | Penang | `penang` | 1 | — |  |  |
| 181 | ID | Bali | `bali` | 3 | — |  |  |
| 182 | ID | Jakarta | `cakarta` | 1 | — |  |  |
| 183 | ID | Yogyakarta | `yogyakarta` | 1 | — |  |  |
| 184 | VN | Hanoi | `hanoi` | 2 | — |  |  |
| 185 | VN | Ho Chi Minh | `ho-chi-minh` | 2 | — |  |  |
| 186 | VN | Da Nang | `da-nang` | 2 | — |  |  |
| 187 | KH | Siem Reap | `siem-reap` | 1 | — |  |  |
| 188 | KH | Phnom Penh | `phnom-penh` | 1 | — |  |  |
| 189 | LA | Luang Prabang | `luang-prabang` | 1 | — |  |  |
| 190 | NP | Katmandu | `katmandu` | 1 | — |  |  |
| 191 | NP | Pokhara | `pokhara` | 1 | — |  |  |
| 192 | IN | Delhi | `delhi` | 2 | — |  |  |
| 193 | IN | Agra | `agra` | 1 | — |  |  |
| 194 | IN | Jaipur | `jaipur` | 1 | — |  |  |
| 195 | IN | Mumbai | `mumbai` | 2 | — |  |  |
| 196 | IN | Goa | `goa` | 1 | — |  |  |
| 197 | IN | Varanasi | `varanasi` | 1 | — |  |  |
| 198 | LK | Kolombo | `kolombo` | 1 | — |  |  |
| 199 | LK | Kandy | `kandy` | 1 | — |  |  |
| 200 | MV | Male | `male` | 1 | — |  |  |
| 201 | UZ | Toshkent | `taskent` | 1 | — |  |  |
| 202 | UZ | Samarqand | `semerkant` | 1 | — |  |  |
| 203 | UZ | Buxoro | `buhara` | 1 | — |  |  |
| 204 | KZ | Almaty | `almati` | 1 | — |  |  |
| 205 | KG | Bishkek | `biskek` | 1 | — |  |  |
| 206 | PH | Manila | `manila` | 1 | — |  |  |
| 207 | PH | Cebu | `cebu` | 1 | — |  |  |
| 208 | US | New York | `new-york` | 7 | — |  |  |
| 209 | US | Washington DC | `washington` | 2 | — |  |  |
| 210 | US | Boston | `boston` | 2 | — |  |  |
| 211 | US | Chicago | `chicago` | 2 | — |  |  |
| 212 | US | Los Angeles | `los-angeles` | 5 | — |  |  |
| 213 | US | San Francisco | `san-francisco` | 2 | — |  |  |
| 214 | US | Las Vegas | `las-vegas` | 1 | — |  |  |
| 215 | US | Miami | `miami` | 2 | — |  |  |
| 216 | US | Orlando | `orlando` | 1 | — |  |  |
| 217 | US | Seattle | `seattle` | 1 | — |  |  |
| 218 | US | New Orleans | `new-orleans` | 1 | — |  |  |
| 219 | US | San Diego | `san-diego` | 1 | — |  |  |
| 220 | US | Philadelphia | `philadelphia` | 1 | — |  |  |
| 221 | CA | Toronto | `toronto` | 2 | — |  |  |
| 222 | CA | Montreal | `montreal` | 1 | — |  |  |
| 223 | CA | Vancouver | `vancouver` | 1 | — |  |  |
| 224 | MX | Ciudad de México | `meksiko` | 2 | — |  |  |
| 225 | MX | Cancun | `cancun` | 2 | — |  |  |
| 226 | MX | Playa del Carmen | `playa-del-carmen` | 1 | — |  |  |
| 227 | CU | La Habana | `havana` | 1 | — |  |  |
| 228 | DO | Punta Cana | `punta-cana` | 1 | — |  |  |
| 229 | CO | Bogota | `bogota` | 1 | — |  |  |
| 230 | CO | Cartagena | `cartagena` | 1 | — |  |  |
| 231 | CO | Medellin | `medellin` | 1 | — |  |  |
| 232 | PE | Lima | `lima` | 1 | — |  |  |
| 233 | PE | Cusco | `cusco` | 1 | — |  |  |
| 234 | EC | Quito | `quito` | 1 | — |  |  |
| 235 | CL | Santiago | `santiago` | 1 | — |  |  |
| 236 | AR | Buenos Aires | `buenos-aires` | 3 | — |  |  |
| 237 | BR | Rio de Janeiro | `rio` | 2 | — |  |  |
| 238 | BR | São Paulo | `sao-paulo` | 1 | — |  |  |
| 239 | UY | Montevideo | `montevideo` | 1 | — |  |  |
| 240 | ZA | Cape Town | `cape-town` | 2 | — |  |  |
| 241 | ZA | Johannesburg | `johannesburg` | 1 | — |  |  |
| 242 | KE | Nairobi | `nairobi` | 1 | — |  |  |
| 243 | TZ | Zanzibar | `zanzibar` | 1 | — |  |  |
| 244 | AU | Sydney | `sidney` | 3 | — |  |  |
| 245 | AU | Melbourne | `melbourne` | 2 | — |  |  |
| 246 | AU | Brisbane | `brisbane` | 1 | — |  |  |
| 247 | AU | Gold Coast | `gold-coast` | 1 | — |  |  |
| 248 | NZ | Auckland | `auckland` | 1 | — |  |  |
| 249 | NZ | Queenstown | `queenstown` | 1 | — |  |  |
| 250 | RU | Moscow | `moskova` | 4 | — |  |  |
| 251 | RU | Saint Petersburg | `st-petersburg` | 3 | — |  |  |
| 252 | IL | Tel Aviv | `tel-aviv` | 3 | — |  |  |
| 253 | IR | Tehran | `tahran` | 3 | — |  |  |
| 254 | IR | Isfahan | `isfahan` | 2 | — |  |  |
| 255 | IR | Shiraz | `siraz` | 2 | — |  |  |
| 256 | IN | Kolkata | `kalkuta` | 3 | — |  |  |
| 257 | IN | Chennai | `chennai` | 3 | — |  |  |
| 258 | IN | Bengaluru | `bengaluru` | 3 | — |  |  |
| 259 | CN | Guangzhou | `guangzhou` | 3 | — |  |  |
| 260 | CN | Shenzhen | `shenzhen` | 2 | — |  |  |
| 261 | CN | Chengdu | `chengdu` | 2 | — |  |  |
| 262 | UA | Kyiv | `kiev` | 3 | — |  |  |
| 263 | US | Houston | `houston` | 2 | — |  |  |
| 264 | US | Dallas | `dallas` | 2 | — |  |  |
| 265 | US | Atlanta | `atlanta` | 2 | — |  |  |
