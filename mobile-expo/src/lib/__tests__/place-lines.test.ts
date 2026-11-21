import { describe, expect, it } from "@jest/globals";

import { placeLines } from "@/lib/place-lines";

describe("placeLines", () => {
  it("sunucu baslik/alt baslik verdiyse onlari kullanir", () => {
    expect(placeLines({ label: "x", title: "Hotel", subtitle: "Sisli, Istanbul", latitude: 1, longitude: 2 })).toEqual({
      title: "Hotel",
      subtitle: "Sisli, Istanbul",
    });
  });

  it("eski sunucuda kapi numarasi etiket olmaz", () => {
    const r = placeLines({ label: "Hotel, 2, Cadde, Sisli", latitude: 1, longitude: 2 });
    expect(r.title).toBe("Hotel, Cadde");
  });
});
