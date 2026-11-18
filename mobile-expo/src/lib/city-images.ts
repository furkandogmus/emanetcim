import type { ImageSourcePropType } from "react-native";

/**
 * Populer sehir fotograflari: web'in blog arsivinden (`content/blog/images.json`) 480x600
 * kirpilip kucultuldu. Cogu CC BY-SA:
 * atif zorunlu, yazar/lisans/kaynak burada tutulur. Fotograf degisirse bunlar da degismeli.
 */
export type CityImage = {
  source: ImageSourcePropType;
  author: string;
  license: string;
  url: string;
};

export const CITY_IMAGES: Record<string, CityImage> = {
  Antalya: {
    source: require("../../assets/cities/antalya.jpg"),
    author: "REHBER0770",
    license: "CC BY-SA 4.0",
    url: "https://commons.wikimedia.org/wiki/File:Antalya_kalei%C3%A7i_2.jpg",
  },
  Ankara: {
    source: require("../../assets/cities/ankara.jpg"),
    author: "Bernard Gagnon",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Ankara_Castle.jpg",
  },
  Bodrum: {
    source: require("../../assets/cities/bodrum.jpg"),
    author: "Horvat",
    license: "Public domain",
    url: "https://commons.wikimedia.org/wiki/File:TurkeyBodrumCastle.jpg",
  },
  Fethiye: {
    source: require("../../assets/cities/fethiye.jpg"),
    author: "allen watkin",
    license: "CC BY-SA 2.0",
    url: "https://commons.wikimedia.org/wiki/File:The_Blue_Lagoon_(1105270821).jpg",
  },
  // Il geneli: Datca limani (Bodrum ve Fethiye kendi fotografini kullanir).
  Muğla: {
    source: require("../../assets/cities/mugla.jpg"),
    author: "Nevit Dilmen",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Datca_1410417_Nevit.jpg",
  },
  İstanbul: {
    source: require("../../assets/cities/istanbul.jpg"),
    author: "Helge Høifødt",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Hagia_Sophia_from_the_Sultanameht_Square_(Hippodrome).JPG",
  },
  İzmir: {
    source: require("../../assets/cities/izmir.jpg"),
    author: "LWY",
    license: "CC BY 2.0",
    url: "https://commons.wikimedia.org/wiki/File:%C4%B0zmir_Konak_saat_kulesi_ve_Konak_meydan%C4%B1.jpg",
  },
};
