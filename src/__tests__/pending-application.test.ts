import { describe, it, expect } from "vitest";
import { PENDING_APPLICATION_WHERE } from "@/lib/pending-application";

describe("bekleyen başvuru tanımı", () => {
  it("onaylanmamış, pasif ve rezervasyonsuz dükkanı kapsar", () => {
    // Pasife alinmis canli dukkan listeye dusup "Reddet" ile silinmesin.
    expect(PENDING_APPLICATION_WHERE).toEqual({
      isActive: false,
      approvedAt: null,
      bookings: { none: {} },
    });
  });
});
