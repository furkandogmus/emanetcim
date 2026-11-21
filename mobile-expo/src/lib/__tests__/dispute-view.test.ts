import { describe, expect, it } from "@jest/globals";

import { disputeStatusView } from "@/lib/dispute-view";
import en from "@/locales/en.json";

describe("disputeStatusView", () => {
  it("sonuclanan bildirim inceleme metninde takili kalmaz", () => {
    expect(disputeStatusView("RESOLVED").key).toBe("dispute.statusText.resolved");
    expect(disputeStatusView("CLOSED").key).toBe("dispute.statusText.closed");
  });

  it("acik, incelenen ya da bilinmeyen durum inceleme metnini gosterir", () => {
    for (const s of ["OPEN", "IN_REVIEW", null, undefined] as const) {
      expect(disputeStatusView(s).key).toBe("dispute.statusText.reviewing");
    }
  });

  it("her anahtarin metni var", () => {
    const texts = en.dispute.statusText as Record<string, string>;
    for (const s of ["OPEN", "RESOLVED", "CLOSED"] as const) {
      const leaf = disputeStatusView(s).key.split(".").pop() as string;
      expect(texts[leaf]).toBeTruthy();
    }
  });
});
