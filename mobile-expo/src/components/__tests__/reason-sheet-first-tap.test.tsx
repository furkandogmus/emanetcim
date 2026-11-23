/**
 * Neden panelinde klavye acikken onaya ilk dokunus islemi calistirmali. RN'de Modal'daki
 * dokunus React agacindaki ata ScrollView'lardan da gecer; `keyboardShouldPersistTaps`
 * "never" (varsayilan) olan bir ata, klavye acikken dokunusu yakalayip yalnizca klavyeyi
 * kapatir (ScrollView._handleStartShouldSetResponderCapture). `pressWithKeyboardOpen`
 * bu kurali uygular; test-renderer basisi dogrudan onPress'e verdigi icin gerekli.
 */
import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { Keyboard } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";

import AdminBookingScreen from "@/app/(admin)/admin/booking/[id]";
import { BookingDetailView } from "@/components/BookingDetailView";
import i18n from "@/lib/i18n";
import type { AdminBookingDetail } from "@/lib/types";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "b1" }),
  useRouter: () => ({ push: jest.fn() }),
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/components/BookingTicket", () => ({ BookingTicket: () => null }));
jest.mock("@/components/StaleQueryBanner", () => ({ StaleQueryBanner: () => null }));
jest.mock("@/lib/use-view-as", () => ({ useViewAs: () => jest.fn() }));

const mockMutate = jest.fn();
const booking = {
  id: "b1",
  status: "PAID",
  checkOutTime: "2099-01-01T12:00:00Z",
  guestName: "Misafir",
  shopName: "Dukkan",
  disputeStatus: null,
  checkInTime: "2098-12-31T12:00:00Z",
  totalPrice: 100,
  createdAt: "2098-12-01T12:00:00Z",
  shop: { name: "Dukkan", address: "", phone: "", ownerName: "", latitude: null, longitude: null },
  guest: { name: "Misafir", email: "", phone: "" },
  seals: [],
  events: [],
  checkedInAt: null,
  checkedOutAt: null,
  couponCode: null,
  paymentStatus: null,
} as unknown as AdminBookingDetail;
const partnerBooking = {
  id: "b2",
  shopId: "s1",
  shopName: "Dukkan",
  checkInTime: "2099-01-01T09:00:00Z",
  checkOutTime: "2099-01-01T15:00:00Z",
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  totalPrice: 100,
  status: "APPROVED",
  qrCodeToken: null,
  guestName: "Misafir",
  latitude: null,
  longitude: null,
  shopPhone: "",
  seals: [],
};
jest.mock("@/lib/queries", () => ({
  useAdminBooking: () => ({ isLoading: false, data: booking }),
  useAdminBookingAction: () => ({ mutate: mockMutate, isPending: false }),
  useBooking: () => ({ isLoading: false, isRefetching: false, data: partnerBooking, refetch: jest.fn() }),
  useOnlinePayments: () => false,
  isActiveBooking: () => true,
  usePartnerShop: () => ({ data: undefined }),
  usePartnerCancel: () => ({ mutate: mockMutate, isPending: false }),
  usePartnerNoShow: () => ({ mutate: jest.fn(), isPending: false }),
  usePartnerLateHold: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/lib/search", () => ({ useSearch: () => ({}), defaultWindow: () => ({}) }));
jest.mock("@/lib/offline-tickets", () => ({
  loadOfflineTicket: async () => null,
  saveOfflineTicket: async () => undefined,
}));
jest.mock("@/components/BagRevisionCard", () => ({ BagRevisionCard: () => null }));

type Node = { type: unknown; props: Record<string, unknown>; parent: Node | null };

/** Klavye acik ve odak metin kutusundayken cihazdaki ilk dokunus: atalardan biri yutarsa yalnizca klavye kapanir. */
async function pressWithKeyboardOpen(target: Node) {
  for (let n: Node | null = target.parent; n; n = n.parent) {
    if (n.type === "RCTScrollView") {
      const persist = n.props.keyboardShouldPersistTaps;
      if (!persist || persist === "never") {
        Keyboard.dismiss();
        return;
      }
    }
  }
  await fireEvent.press(target as never);
}

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});

describe("neden paneli: klavye acikken onay", () => {
  it("yonetici iptalinde ilk dokunus islemi calistirir, klavyeyi sonra kapatir", async () => {
    const order: string[] = [];
    mockMutate.mockImplementation(() => void order.push("mutate"));
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => void order.push("dismiss"));

    await render(<AdminBookingScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Rezervasyonu iptal et" }));
    const note = screen.getByLabelText("Neden");
    await fireEvent(note, "focus");
    await fireEvent.changeText(note, "misafir istedi");

    await pressWithKeyboardOpen(screen.getByRole("button", { name: "İptal et" }) as unknown as Node);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["mutate", "dismiss"]);
    dismiss.mockRestore();
  });

  it("esnaf iptalinde (rezervasyon detayi) ilk dokunus islemi calistirir, klavyeyi sonra kapatir", async () => {
    const order: string[] = [];
    mockMutate.mockReset();
    mockMutate.mockImplementation(() => void order.push("mutate"));
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => void order.push("dismiss"));

    await render(
      <QueryClientProvider client={new QueryClient()}>
        <BookingDetailView id="b2" mode="partner" />
      </QueryClientProvider>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Rezervasyonu iptal et" }));
    await fireEvent.press(screen.getAllByRole("radio")[0]);
    const note = screen.getByLabelText("Açıklama");
    await fireEvent(note, "focus");
    await fireEvent.changeText(note, "dukkan kapali");

    await pressWithKeyboardOpen(screen.getByRole("button", { name: "İptal et" }) as unknown as Node);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["mutate", "dismiss"]);
    dismiss.mockRestore();
  });
});
