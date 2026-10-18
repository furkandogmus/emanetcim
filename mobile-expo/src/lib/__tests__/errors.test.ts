import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { ApiError } from "../api";
import { errorMessage } from "../errors";
import i18n from "../i18n";

jest.mock("expo-secure-store", () => ({}));

describe("errorMessage", () => {
  beforeAll(() => i18n.changeLanguage("tr"));

  it("ag hatasini ag mesajina cevirir", () => {
    expect(errorMessage(new ApiError(0, "network"))).toBe(i18n.t("common.networkError"));
  });

  it("ad alaninda cevirisi olan kodu cevirir", () => {
    i18n.addResource("tr", "translation", "testNs.errors.insufficient_capacity", "Yer kalmadi");
    expect(errorMessage(new ApiError(409, "insufficient_capacity"), "testNs")).toBe("Yer kalmadi");
  });

  it("bilinmeyen kod ve ham hata genel mesaja duser, ham metin gosterilmez", () => {
    const generic = i18n.t("common.genericError");
    expect(errorMessage(new ApiError(500, "Shop not found."), "testNs")).toBe(generic);
    expect(errorMessage(new Error("prisma P2025 ..."))).toBe(generic);
    expect(errorMessage("string hata")).toBe(generic);
  });
});
