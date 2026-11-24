/**
 * Yonetim dugmelerinin kapilari: ne zaman gorunur, ne zaman acilir. Her test, kapisi
 * kaldirilirsa kirilacak sekilde kurulu.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { AdminBookingActions } from "@/components/AdminBookingActions";
import { ExpiredBookingActions } from "@/components/ExpiredBookingActions";
import { PartnerBookingActions } from "@/components/PartnerBookingActions";
import i18n from "@/lib/i18n";
import type { BookingDetail, BookingStatus } from "@/lib/types";

// Dosyanin ilk render'i RN + RNTL modullerini soguk yukler; CI makinesinde
// varsayilan 5 sn'yi asip kararsiz kiriliyordu (2026-11-22). Assert'ler ayni.
jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }), router: { push: jest.fn() } }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const idle = () => ({ mutate: jest.fn(), isPending: false });
// Panodaki dukkan yetkisi; personel testi `access: "staff"` verir.
let mockDashboard: unknown = undefined;
jest.mock("@/lib/queries", () => ({
  usePartnerShop: () => ({ data: undefined }),
  usePartnerDashboard: () => ({ data: mockDashboard }),
  usePartnerCancel: () => idle(),
  usePartnerNoShow: () => idle(),
  usePartnerLateHold: () => idle(),
  useAdminBookingAction: () => idle(),
  useBagPhotos: () => ({ data: undefined }),
  useUploadBagPhoto: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteBagPhoto: () => ({ mutate: jest.fn(), isPending: false }),
}));

const NOW = Date.parse("2026-11-22T09:00:00Z"); // 12:00 TRT

function booking(over: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: "b1",
    shopId: "s1",
    shopName: "Dukkan",
    checkInTime: "2026-11-22T09:00:00Z",
    checkOutTime: "2026-11-22T15:00:00Z",
    bagCountS: 1,
    bagCountM: 0,
    bagCountXl: 0,
    totalPrice: 100,
    status: "PAID",
    qrCodeToken: null,
    guestName: "Misafir",
    latitude: null,
    longitude: null,
    shopPhone: "",
    seals: [],
    ...over,
  };
}

function withClient(ui: ReactElement) {
  return <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;
}

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});

describe("esnaf: Misafir gelmedi", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("noShowAvailableAt yoksa (eski sunucu) ya da null ise gorunmez", async () => {
    await render(withClient(<PartnerBookingActions booking={booking()} />));
    expect(screen.queryByRole("button", { name: "Misafir gelmedi" })).toBeNull();
    await screen.rerender(withClient(<PartnerBookingActions booking={booking({ noShowAvailableAt: null })} />));
    expect(screen.queryByRole("button", { name: "Misafir gelmedi" })).toBeNull();
  });

  it("zamani gelmeden kapali ve saati yazar; ekran acikken esik gecince acilir", async () => {
    const at = new Date(NOW + 30 * 60_000).toISOString(); // 12:30 TRT
    await render(withClient(<PartnerBookingActions booking={booking({ noShowAvailableAt: at })} />));
    expect(screen.getByRole("button", { name: "Misafir gelmedi" })).toBeDisabled();
    expect(screen.getByText("12:30 sonra kullanılabilir")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(29 * 60_000);
    });
    expect(screen.getByRole("button", { name: "Misafir gelmedi" })).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(2 * 60_000);
    });
    expect(screen.getByRole("button", { name: "Misafir gelmedi" })).toBeEnabled();
    expect(screen.queryByText("12:30 sonra kullanılabilir")).toBeNull();
  });
});

describe("esnaf: iptal", () => {
  it("teslim almadan once var, valiz dukkandayken (CHECKED_IN) yok", async () => {
    await render(withClient(<PartnerBookingActions booking={booking({ status: "APPROVED" })} />));
    expect(screen.getByRole("button", { name: "Rezervasyonu iptal et" })).toBeTruthy();
    await screen.rerender(withClient(<PartnerBookingActions booking={booking({ status: "CHECKED_IN" })} />));
    expect(screen.queryByRole("button", { name: "Rezervasyonu iptal et" })).toBeNull();
  });

  it("dukkan personeli iptal dugmesini gormez (iptal sahibin isi)", async () => {
    const b = booking({ status: "APPROVED" });
    mockDashboard = { shops: [{ id: b.shopId, name: "D", access: "staff" }] };
    try {
      await render(withClient(<PartnerBookingActions booking={b} />));
      expect(screen.queryByRole("button", { name: "Rezervasyonu iptal et" })).toBeNull();
    } finally {
      mockDashboard = undefined;
    }
  });
});

describe("yonetici: neden notu", () => {
  it("onay en az 5 karakterlik not olmadan kapali", async () => {
    await render(<AdminBookingActions booking={{ id: "b1", status: "PAID" }} />);
    await fireEvent.press(screen.getByRole("button", { name: "Rezervasyonu iptal et" }));
    const confirm = () => screen.getByRole("button", { name: "İptal et" });
    expect(confirm()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Neden"), "  abcd  ");
    expect(confirm()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Neden"), "abcde");
    expect(confirm()).toBeEnabled();
  });
});

describe("misafir: suresi dolan rezervasyonu kapat", () => {
  const renderExpired = (status: BookingStatus, expired: boolean) =>
    render(
      <ExpiredBookingActions
        booking={{ status, checkOutTime: "2026-11-22T15:00:00Z", expired }}
        onRebook={jest.fn()}
        onClose={jest.fn()}
        closing={false}
      />,
    );

  it("suresi dolmus ve valiz birakilmamissa gorunur", async () => {
    await renderExpired("APPROVED", true);
    expect(screen.getByRole("button", { name: "Rezervasyonu kapat" })).toBeTruthy();
  });

  it("suresi dolmamissa gorunmez", async () => {
    await renderExpired("APPROVED", false);
    expect(screen.queryByRole("button", { name: "Rezervasyonu kapat" })).toBeNull();
  });

  it("iptal edilemeyen durumda (valiz dukkanda) gorunmez", async () => {
    await renderExpired("CHECKED_IN", true);
    expect(screen.queryByRole("button", { name: "Rezervasyonu kapat" })).toBeNull();
  });
});

describe("esnaf: gec birakma (Misafiri bekle)", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: Date.parse("2026-11-22T09:20:00Z") });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("lateCloseAt yoksa (eski sunucu) gorunmez", async () => {
    await render(withClient(<PartnerBookingActions booking={booking()} />));
    expect(screen.queryByRole("button", { name: "Misafiri bekle (+30 dk)" })).toBeNull();
  });

  it("birakma saati gectiyse kapanis saatini ve bekle dugmesini gosterir", async () => {
    await render(withClient(<PartnerBookingActions booking={booking({ lateCloseAt: "2026-11-22T10:00:00Z" })} />));
    expect(screen.getByText(/Otomatik kapanış: 13:00/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Misafiri bekle (+30 dk)" })).toBeEnabled();
  });

  it("kapanis alma saatine dayandiysa dugme kapali ve nedenini yazar", async () => {
    await render(
      withClient(
        <PartnerBookingActions
          booking={booking({ lateCloseAt: "2026-11-22T15:00:00Z", lateHoldUntil: "2026-11-22T15:00:00Z" })}
        />,
      ),
    );
    expect(screen.getByRole("button", { name: "Misafiri bekle (+30 dk)" })).toBeDisabled();
    expect(screen.getByText("Alma saatine ulaşıldı, daha fazla beklenemez.")).toBeTruthy();
  });

  it("odemesiz niyette (PENDING) bekle blogu ve tavan yazisi hic gorunmez", async () => {
    await render(
      withClient(<PartnerBookingActions booking={booking({ status: "PENDING", lateCloseAt: "2026-11-22T10:00:00Z" })} />),
    );
    expect(screen.queryByRole("button", { name: "Misafiri bekle (+30 dk)" })).toBeNull();
    expect(screen.queryByText("Alma saatine ulaşıldı, daha fazla beklenemez.")).toBeNull();
  });
});
