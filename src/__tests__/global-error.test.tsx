/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import GlobalError from "@/app/global-error";

/**
 * Kardeş sınır `[locale]/error.tsx` yakaladığı hatayı `console.error` ile
 * loglar (teşhis izi için — kullanıcıya yine de genel bir mesaj gösterilir).
 * Kök sınır `global-error.tsx` (layout hatalarını da yakalayan SON çare) bunu
 * yapmıyordu: en kritik çökmede hiçbir teşhis izi kalmıyordu.
 */
describe("GlobalError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("yakaladığı hatayı console.error ile loglar", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("layout patladı"), { digest: "abc123" });

    render(<GlobalError error={error} reset={() => {}} />);

    expect(spy).toHaveBeenCalledWith(error);
  });
});
