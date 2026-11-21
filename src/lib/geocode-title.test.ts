import { describe, it, expect } from "vitest";
import { placeTitleSubtitle } from "@/lib/geocode";

describe("placeTitleSubtitle", () => {
  it("kapi numarasi baslik olmaz; ad + ilce/sehir", () => {
    const r = placeTitleSubtitle(
      {
        name: "Example Hotel",
        display_name: "Example Hotel, 2, Example Caddesi, Sisli, Istanbul, Marmara Bolgesi, 34000, Turkiye",
        address: { road: "Example Caddesi", suburb: "Sisli", province: "Istanbul" },
      },
      "q",
    );
    expect(r).toEqual({ title: "Example Hotel", subtitle: "Sisli, Istanbul" });
  });

  it("adres alani yoksa sayisal parcalari atip display_name'e duser", () => {
    const r = placeTitleSubtitle({ display_name: "12, Ornek Sokak, Kadikoy, Istanbul" }, "q");
    expect(r.title).toBe("Ornek Sokak");
    expect(r.subtitle).toBe("Kadikoy, Istanbul");
  });

  it("mahalle (suburb) ilcenin onune gecmez", () => {
    const r = placeTitleSubtitle(
      {
        name: "Example Cafe",
        display_name: "Example Cafe, Ornek Mahallesi, Kadikoy, Istanbul",
        address: { suburb: "Ornek Mahallesi", town: "Kadikoy", province: "Istanbul" },
      },
      "q",
    );
    expect(r.subtitle).toBe("Kadikoy, Istanbul");
  });
});
