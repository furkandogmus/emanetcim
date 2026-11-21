import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { router } from "expo-router";

import { goBackOr } from "@/lib/navigation";

jest.mock("expo-router", () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const mockRouter = router as unknown as Record<"canGoBack" | "back" | "replace", jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("goBackOr", () => {
  it("gecmis varsa geri doner", () => {
    mockRouter.canGoBack.mockReturnValue(true);
    goBackOr();
    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("uygulama baglantisindan acilista (yigin tek ekran) ana sayfaya gider", () => {
    mockRouter.canGoBack.mockReturnValue(false);
    goBackOr();
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
