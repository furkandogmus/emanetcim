import { describe, expect, it } from "@jest/globals";

import { googleCalendarUrl } from "../calendar-link";

describe("googleCalendarUrl", () => {
  it("web ile ayni TEMPLATE alanlari, UTC damgalari", () => {
    const url = googleCalendarUrl({
      title: "Luggage storage: Shop",
      details: "BagajPark booking AB12CD34: Shop",
      location: "Street 1",
      start: "2030-05-01T10:00:00.000Z",
      end: "2030-05-01T14:30:00.000Z",
    });
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    const q = new URLSearchParams(url.split("?")[1]);
    expect(q.get("action")).toBe("TEMPLATE");
    expect(q.get("text")).toBe("Luggage storage: Shop");
    expect(q.get("dates")).toBe("20300501T100000Z/20300501T143000Z");
    expect(q.get("location")).toBe("Street 1");
  });

  it("adres yoksa konum bos", () => {
    const url = googleCalendarUrl({ title: "x", details: "y", start: new Date(0), end: new Date(3600_000) });
    expect(new URLSearchParams(url.split("?")[1]).get("location")).toBe("");
  });
});
