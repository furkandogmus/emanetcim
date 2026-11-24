/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PosterTokenScrub from "@/components/app-promo/PosterTokenScrub";

describe("PosterTokenScrub", () => {
  it("adres cubugundan `t`yi siler, digerlerini korur", () => {
    window.history.replaceState(null, "", "/tr/poster?t=abc.def.ghi&x=1#a");
    render(<PosterTokenScrub />);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/tr/poster?x=1#a");
  });
});
