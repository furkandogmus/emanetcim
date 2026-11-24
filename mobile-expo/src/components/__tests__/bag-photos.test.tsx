/**
 * Valiz fotografi bolumu: eski sunucuda (uc yok) ve bos/kilitliyken hic cizilmez; ekleme ve
 * silme dugmeleri yalniz sunucunun `canUpload` / `canDelete` dediginde gorunur.
 */
import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { BagPhotos } from "@/components/BagPhotos";
import i18n from "@/lib/i18n";
import type { BagPhotoList } from "@/lib/types";

jest.setTimeout(20_000);
jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

let mockData: BagPhotoList | undefined;
jest.mock("@/lib/queries", () => ({
  useBagPhotos: () => ({ data: mockData, refetch: jest.fn() }),
  useUploadBagPhoto: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteBagPhoto: () => ({ mutate: jest.fn(), isPending: false }),
}));

const photo = { id: "p1", url: "https://s3.test/x?sig", createdAt: "2026-11-25T10:00:00Z", expiresAt: "2026-11-25T10:05:00Z" };
const list = (over: Partial<BagPhotoList>): BagPhotoList => ({
  photos: [],
  canUpload: false,
  canDelete: false,
  maxPhotos: 3,
  storageReady: true,
  ...over,
});

describe("BagPhotos", () => {
  beforeAll(() => void i18n.changeLanguage("tr"));

  it("uc yoksa (eski sunucu) hic cizilmez", async () => {
    mockData = undefined;
    await render(<BagPhotos bookingId="b1" audience="operator" />);
    expect(screen.queryByText(i18n.t("bagPhotos.operatorTitle"))).toBeNull();
  });

  it("bos ve eklenemiyorsa misafirde de operatorde de cizilmez", async () => {
    mockData = list({});
    await render(<BagPhotos bookingId="b1" audience="guest" />);
    expect(screen.queryByText(i18n.t("bagPhotos.title"))).toBeNull();
    await render(<BagPhotos bookingId="b1" audience="operator" />);
    expect(screen.queryByText(i18n.t("bagPhotos.operatorTitle"))).toBeNull();
  });

  it("operator pencere acikken ekleme dugmesini gorur", async () => {
    mockData = list({ canUpload: true, canDelete: true });
    await render(<BagPhotos bookingId="b1" audience="operator" />);
    expect(screen.getByText(i18n.t("bagPhotos.add"))).toBeTruthy();
  });

  it("misafir fotografi gorur ama silemez, ekleyemez", async () => {
    mockData = list({ photos: [photo] });
    await render(<BagPhotos bookingId="b1" audience="guest" />);
    expect(screen.getByLabelText(i18n.t("bagPhotos.openPhoto", { n: 1 }))).toBeTruthy();
    expect(screen.queryByLabelText(i18n.t("bagPhotos.deletePhoto", { n: 1 }))).toBeNull();
    expect(screen.queryByText(i18n.t("bagPhotos.add"))).toBeNull();
  });

  it("sinira ulasinca ekleme dugmesi kaybolur", async () => {
    mockData = list({ photos: [photo, { ...photo, id: "p2" }, { ...photo, id: "p3" }], canUpload: true, canDelete: true });
    await render(<BagPhotos bookingId="b1" audience="operator" />);
    expect(screen.queryByText(/Fotoğraf ekle/)).toBeNull();
    expect(screen.getByLabelText(i18n.t("bagPhotos.deletePhoto", { n: 3 }))).toBeTruthy();
  });
});
