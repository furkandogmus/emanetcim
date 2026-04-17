import { describe, expect, it } from "vitest";
import {
  buildAddressPartsFromNominatimAddress,
  composeAddress,
  parseAddressParts,
} from "@/components/partner/LocationPicker";

describe("LocationPicker address helpers", () => {
  it("maps Nominatim parts into correct fields", () => {
    const parts = buildAddressPartsFromNominatimAddress({
      road: "Sevenler Sokak",
      neighbourhood: "Ufuktepe Mahallesi",
      house_number: "5",
    });

    expect(parts).toEqual({
      street: "Sevenler Sokak",
      neighborhood: "Ufuktepe",
      buildingNo: "5",
      doorNo: "",
    });
  });

  it("parses address with No and Daire without polluting street", () => {
    const parts = parseAddressParts(
      "Sevenler Sokak, Ufuktepe Mahallesi, No:5 Daire:30"
    );

    expect(parts.street).toBe("Sevenler Sokak");
    expect(parts.neighborhood).toBe("Ufuktepe");
    expect(parts.buildingNo).toBe("5");
    expect(parts.doorNo).toBe("30");
  });

  it("cleans spaced postal codes from parsed street/neighborhood", () => {
    const parts = parseAddressParts(
      "Sevenler Sokak Ufuktepe Mahallesi 0 5 9 8 0 No:5 Daire:30"
    );

    expect(parts.street).toBe("Sevenler Sokak");
    expect(parts.neighborhood).toBe("Ufuktepe");
    expect(parts.buildingNo).toBe("5");
    expect(parts.doorNo).toBe("30");
  });

  it("composes final address without postal code", () => {
    const full = composeAddress({
      street: "Sevenler Sokak",
      neighborhood: "Ufuktepe",
      buildingNo: "5",
      doorNo: "30",
    });

    expect(full).toBe("Sevenler Sokak Ufuktepe No:5 Daire:30");
  });
});
