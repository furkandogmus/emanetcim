import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  trackPlausibleEvent,
  hasAnalyticsConsent,
  PLAUSIBLE_EVENTS,
} from "./plausible-events";

describe("plausible-events", () => {
  const plausible = vi.fn();
  const getItem = vi.fn();

  beforeEach(() => {
    plausible.mockClear();
    getItem.mockReset();
    vi.stubGlobal(
      "window",
      {
        localStorage: { getItem },
        plausible,
      } as unknown as Window & typeof globalThis,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not call plausible without analytics consent", () => {
    getItem.mockReturnValue(null);
    trackPlausibleEvent("Foo");
    expect(plausible).not.toHaveBeenCalled();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("does not call plausible when only essential cookies accepted", () => {
    getItem.mockReturnValue("essential");
    trackPlausibleEvent("Foo");
    expect(plausible).not.toHaveBeenCalled();
  });

  it("calls plausible with stringified props when consent is all", () => {
    getItem.mockReturnValue("all");
    trackPlausibleEvent("SearchSubmitted", { bags: 2, tab: "nearby" });
    expect(plausible).toHaveBeenCalledWith("SearchSubmitted", {
      props: { bags: "2", tab: "nearby" },
    });
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("calls plausible without props object when no props passed", () => {
    getItem.mockReturnValue("all");
    trackPlausibleEvent("ShopViewed");
    expect(plausible).toHaveBeenCalledWith("ShopViewed");
  });

  it("exports stable funnel event names", () => {
    expect(PLAUSIBLE_EVENTS.PaymentSucceeded).toBe("PaymentSucceeded");
  });
});
