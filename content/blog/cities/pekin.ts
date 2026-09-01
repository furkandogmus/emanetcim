import type { CityBlogEntry } from "../types";

export const entry: CityBlogEntry = {
  cityKey: "pekin",
  posts: [
    {
      locale: "tr",
      slug: "pekin-yasak-sehir-tek-yon-metro-kontrol-valiz",
      title: "Yasak Şehir'e Güneyden Girip Kuzeyden Çıkıyorsunuz",
      excerpt:
        "Geri dönüş yok: içeri girdiğiniz kapıdan çıkamıyorsunuz. Bavulunuzu girişte bıraktıysanız bir sorununuz var.",
      cover: "pekin-yasak-sehir",
      body: `
<p>Yasak Şehir tek yönlü geziliyor. Güneydeki Meridyen Kapısı'ndan giriliyor, saray boyunca kuzeye doğru ilerleniyor ve kuzey kapısından çıkılıyor. Aradaki mesafe bir kilometreden fazla.</p>

<p>Bu detayı bilmeden gelen çok kişi var ve sonuç hep aynı: çıktığınız yer girdiğiniz yerden bir kilometre uzakta. Bavulunuzu güney tarafında bir yere bıraktıysanız onu almak için şehrin etrafından dolaşmanız gerekiyor.</p>

{{img:pekin-yasak-sehir}}

<h2>Meydana ve saraya büyük çantayla girilmiyor</h2>

<p>Tiananmen Meydanı'na giriş kimlik kontrolü ve güvenlik taramasıyla yapılıyor. Yasak Şehir girişinde de tarama var ve büyük bagaj kabul edilmiyor.</p>

<p>Yani bu iki noktayı görmek isteyen birinin bavulu şehirde başka bir yerde durmak zorunda. Bunu önceden planlamayan, kapıya kadar gelip geri dönüyor.</p>

<h2>Metroda her girişte tarama var</h2>

<p>Pekin metrosunda her istasyon girişinde çantalar X-ray cihazından geçiyor. Küçük bir sırt çantası için bu birkaç saniye. Ama büyük bir valizle her aktarmada bunu tekrarlamak günün ritmini bozuyor.</p>

<p>Yoğun saatlerde tarama noktalarında kuyruk oluşuyor ve bavullu yolcular akışı yavaşlatıyor.</p>

<h2>Üç büyük gar, üç ayrı yer</h2>

<p>Pekin'de Beijing (merkez), Beijing South ve Beijing West garları var ve birbirlerinden kilometrelerce uzaktalar. Şangay'a giden hızlı trenler Beijing South'tan, bazı hatlar West'ten kalkıyor.</p>

<p>Yanlış gara gitmek burada yarım saatten fazla kaybettiriyor; metroda tarama kuyruklarıyla birlikte daha da uzuyor.</p>

<h2>Çin Seddi günübirlik</h2>

<p>Mutianyu ve Badaling'e gidiş bir buçuk iki saat sürüyor ve turlar sabah erken kalkıyor. Duvarda yürümek basamaklı ve dik; teleferik olsa bile bavulla çıkılmıyor.</p>

<p>Turlar akşam dönüyor. Yani çıkış gününde Sedde gitmek isteyen biri bavulunu şehirde bırakmak zorunda.</p>

{{img:pekin-wangfujing}}

<h2>Wangfujing ve hutonglar</h2>

<p>Wangfujing yaya caddesi geniş ve düz — bavulla yürünebilir. Ama eski mahalleleri oluşturan hutonglar öyle değil: tek şeritlik sokaklar, bisikletler, üç tekerlekli araçlar ve avlulu evler.</p>

<p>Pekin'in gerçek dokusu o dar sokaklarda ve oralara elleriniz boşken girmek gerekiyor.</p>

<h2>Cennet Tapınağı parkın içinde</h2>

<p>Cennet Tapınağı geniş bir parkın ortasında ve kapıdan yapıya kadar yürümek on beş dakika sürüyor. Park sabahları mahalleli tarafından kullanılıyor; insanlar tai chi yapıyor, dans ediyor, kart oynuyor.</p>

<p>Burası gezilecek bir yerden çok oturulacak bir yer — ama bavulla oturmak da bir dinlenme sayılmıyor.</p>

<h2>Şehir büyük, mesafeler uzun</h2>

<p>Pekin çok geniş bir şehir ve görülecek yerler birbirine yakın değil. Yasak Şehir ile Cennet Tapınağı arası metroyla yarım saat, Yaz Sarayı ise şehrin kuzeybatısında.</p>

<p>Yani bir gün içinde birkaç noktayı görmek çok sayıda metro yolculuğu demek — ve her yolculuk bir tarama noktası.</p>
`.trim(),
    },
    {
      locale: "en",
      slug: "beijing-luggage-storage-forbidden-city-one-way",
      title: "You Enter the Forbidden City from the South and Leave from the North",
      excerpt:
        "There's no going back: you can't leave by the gate you came in. If your bag is at the entrance, you have a problem.",
      cover: "pekin-yasak-sehir",
      body: `
<p>The Forbidden City is visited one way. You go in through the Meridian Gate in the south, work north through the palace, and come out at the north gate. That is more than a kilometre apart.</p>

<p>Plenty of people arrive without knowing that, and the result is always the same: you exit a kilometre from where you started. If you left your bag somewhere on the south side, retrieving it means walking around the whole complex.</p>

{{img:pekin-yasak-sehir}}

<h2>Large bags don't get into the square or the palace</h2>

<p>Entry to Tiananmen Square involves an ID check and a security screening. There is screening at the Forbidden City entrance too, and large luggage isn't admitted.</p>

<p>So anyone who wants to see both has to have the bag elsewhere in the city. Those who don't plan for it walk to the gate and turn around.</p>

<h2>Every subway entrance has a scanner</h2>

<p>In the Beijing subway, bags go through an X-ray machine at every station entrance. With a daypack that's a few seconds. With a large case, repeating it at every transfer breaks the rhythm of the day.</p>

<p>At peak hours queues form at the screening points, and passengers with luggage slow the flow.</p>

<h2>Three main stations, three separate places</h2>

<p>Beijing has Beijing (central), Beijing South and Beijing West stations, kilometres apart. The high-speed trains to Shanghai leave from Beijing South, some lines from West.</p>

<p>Going to the wrong one costs more than half an hour here — longer once you add the screening queues on the subway.</p>

<h2>The Great Wall is a day trip</h2>

<p>Mutianyu and Badaling are an hour and a half to two hours out, and the tours leave early. Walking the wall is steep and stepped; even with a cable car you don't do it with a suitcase.</p>

<p>The tours return in the evening. So visiting the Wall on your checkout day means leaving the bag in the city.</p>

{{img:pekin-wangfujing}}

<h2>Wangfujing and the hutongs</h2>

<p>Wangfujing pedestrian street is wide and flat — walkable with a bag. The hutongs that make up the old neighbourhoods are not: single-lane alleys, bicycles, three-wheelers and courtyard houses.</p>

<p>Beijing's real texture is in those alleys, and you want to walk into them with your hands free.</p>
`.trim(),
    },
  ],
};
