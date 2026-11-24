export type Shop = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  pricePerDay: number;
  capacity: number;
  rating: number | null;
  openingTime: string | null;
  closingTime: string | null;
  open247: boolean;
  hasRestroom: boolean;
  isActive: boolean;
  isVerified: boolean;
  /** Talep testi noktasi: haritada gorunur ama rezervasyon ALINMAZ. */
  isPrelaunch: boolean;
  /** Olanaklar (rozet + suzgec). Eski sunucu gondermez: rozet cizilmez. */
  hasCctv?: boolean;
  hasClimateControl?: boolean;
  acceptsLargeItems?: boolean;
};

export type NearbyShop = Shop & {
  distanceKm: number;
  /** Yalnizca tarih filtresiyle aranirsa gelir. */
  bagsAvailable?: number;
  /** Kucuk-buyuk valiz gunluk fiyati. Eski sunucu gondermez: o zaman `pricePerDay`. */
  /** `medium`: orta boy valizin gunlugu; liste ve pinde gosterilen tek fiyat (eski sunucuda yok). */
  priceRange?: { min: number; max: number; medium?: number };
  /**
   * Aranan kalis ve valiz karisiminin sunucu toplami (`checkout/quote`un kodsuz toplamiyla ayni).
   * Yalnizca boy adetleriyle aranan, rezervasyon alabilen dukkanda gelir; eski sunucuda yok.
   */
  stayQuote?: { total: number; days: number; bags: number };
  /** Secilen saat dukkanin saatine oturtulduysa (ornegin alis kapanisa cekildi). */
  hoursNotice?: HoursNotice | null;
  /**
   * `false`: secilen saatte rezervasyon acilamaz (kapali gun, kapanistan sonra). Alan
   * yoksa (eski sunucu) rezervasyon alinabilir demektir. Yalnizca `includeClosed=1` ile gelir.
   */
  bookable?: boolean;
  /** Kapali dukkanin sonraki gercek acilisi (Istanbul gunu `YYYY-MM-DD` + `HH:mm`); bulunamazsa null. */
  nextOpen?: { date: string; at: string } | null;
};

export type HoursAdjustment = { at: string; reason: "opens" | "closes" };

export type HoursNotice = { drop: HoursAdjustment | null; pickup: HoursAdjustment | null };

export type ShopDetail = Shop & {
  /** Kapak (`image`) disindaki fotograflar, sirali. */
  gallery?: string[];
  weeklyHours?: { weekday: number; isClosed: boolean; openingTime: string; closingTime: string }[];
  closures?: { startDate: string; endDate: string }[];
  /** Boyut basina gunluk fiyat, sunucu yuvarlamasiyla. Eski sunucuda yok. */
  priceBySize?: { s: number; m: number; xl: number };
  /** Talep testi noktasinda "N kisi istedi"; isletilen dukkanda `null`, eski sunucuda yok. */
  prelaunchWantCount?: number | null;
  pricing: {
    bagMultiplierS: number;
    bagMultiplierM: number;
    bagMultiplierXl: number;
    insuranceFeeTry: number;
  };
};


export type ShopGalleryImage = { id: string; url: string };

/** `POST /prelaunch/want` yaniti. `subscribed`: girisliyken "acilinca haber ver" kaydi. */
export type PrelaunchWantResponse = {
  count: number;
  alreadyCounted: boolean;
  subscribed: "new" | "already" | null;
};
