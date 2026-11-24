/**
 * Google Takvim "etkinlik olustur" baglantisi (TEMPLATE). Web `BookingDetailActions`
 * ile ayni alanlar: baslik, UTC `dates`, aciklama, konum. Hesap ya da takvim izni
 * istemez; baglanti tarayicida / Google Takvim uygulamasinda acilir.
 */
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function googleCalendarUrl(e: {
  title: string;
  details: string;
  location?: string | null;
  start: Date | string;
  end: Date | string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${utcStamp(new Date(e.start))}/${utcStamp(new Date(e.end))}`,
    details: e.details,
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
