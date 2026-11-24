import { describe, expect, it } from "@jest/globals";

import {
  clearPendingLink,
  deepLinkHref,
  parseDeepLink,
  resolveDeepLink,
  savePendingLink,
  takePendingLink,
  type DeepLink,
} from "@/lib/deep-link-target";
import type { Role } from "@/lib/types/user";

const BK = "0f8fad5b-d9cb-469f-a165-70867728950e";
const booking: DeepLink = { kind: "booking", id: BK };
const partnerBooking: DeepLink = { kind: "partner-booking", id: BK };

describe("resolveDeepLink", () => {
  it.each<[DeepLink, Role | null, ReturnType<typeof resolveDeepLink>]>([
    [booking, "GUEST", { type: "go", href: `/bookings/${BK}` }],
    [booking, "PARTNER", { type: "go", href: `/partner/${BK}` }],
    [booking, "ADMIN", { type: "go", href: `/admin/booking/${BK}` }],
    [booking, null, { type: "login" }],
    [partnerBooking, "PARTNER", { type: "go", href: `/partner/${BK}` }],
    [partnerBooking, "ADMIN", { type: "go", href: `/admin/booking/${BK}` }],
    [partnerBooking, "GUEST", { type: "mismatch", need: "partner" }],
    [partnerBooking, null, { type: "login" }],
    [{ kind: "affiliate" }, "GUEST", { type: "go", href: "/affiliate" }],
    [{ kind: "affiliate" }, "PARTNER", { type: "go", href: "/affiliate" }],
    [{ kind: "affiliate" }, null, { type: "login" }],
    [{ kind: "register" }, null, { type: "go", href: "/login" }],
    [{ kind: "register" }, "GUEST", { type: "go", href: "/" }],
    [{ kind: "partner-invite", id: "ABCD2345" }, null, { type: "web", path: "register?role=PARTNER&ref=ABCD2345" }],
    [{ kind: "partner-invite" }, "GUEST", { type: "web", path: "register?role=PARTNER" }],
  ])("%j / %s", (link, role, outcome) => {
    expect(resolveDeepLink(link, role)).toEqual(outcome);
  });
});

describe("parseDeepLink", () => {
  it("bilinmeyen tur, kimliksiz rezervasyon ve bozuk kimlik reddedilir", () => {
    expect(parseDeepLink({ kind: "admin" })).toBeNull();
    expect(parseDeepLink({ kind: "booking" })).toBeNull();
    expect(parseDeepLink({ kind: "booking", id: "../x" })).toBeNull();
    expect(parseDeepLink({ kind: ["booking"], id: BK })).toBeNull();
    expect(parseDeepLink({ kind: "booking", id: "settings" })).toBeNull();
    expect(parseDeepLink({ kind: "partner-booking", id: "modify" })).toBeNull();
  });

  it("href ile ayni baglantiya geri doner", () => {
    const href = deepLinkHref(booking);
    expect(href).toBe(`/link?kind=booking&id=${BK}`);
    const q = new URL(href, "https://x.test").searchParams;
    expect(parseDeepLink({ kind: q.get("kind"), id: q.get("id") })).toEqual(booking);
  });
});

describe("pending link", () => {
  it("silinen hedef devam ettirilmez", () => {
    savePendingLink(booking, 0);
    clearPendingLink();
    expect(takePendingLink(1)).toBeNull();
  });

  it("giristen sonra bir kez devam eder", () => {
    savePendingLink(partnerBooking, 1_000);
    expect(takePendingLink(2_000)).toEqual(partnerBooking);
    expect(takePendingLink(3_000)).toBeNull();
  });

  it("15 dakikadan eskisi devam ettirilmez", () => {
    savePendingLink(booking, 0);
    expect(takePendingLink(16 * 60_000)).toBeNull();
  });
});
