/** `partner/earnings/stats` icindeki `insights` (`toMobilePartnerInsights`). Eski sunucu gondermez. */
export type PartnerEarningsInsights = {
  /** Eskiden yeniye 6 ay `YYYY-MM`; sonuncusu bu ay. Tutar esnaf payi. */
  months: { month: string; net: number; count: number }[];
  /** 24 saat, "HH:00"; dukkanin saatinde birakis adedi. */
  peakHours: { hour: string; count: number }[];
  avgStayHours: number;
  conversionPct: number;
  avgRating: number | null;
};

/** `GET partner/poster` (`toMobilePosterLink`): tarayicida acilan 15 dk'lik afis bagi. */
export type PartnerPosterLink = { url: string; expiresAt: string };

/** `PUT partner/phone` yaniti. */
export type PartnerPhoneResult = { success: true; phone: string | null };
