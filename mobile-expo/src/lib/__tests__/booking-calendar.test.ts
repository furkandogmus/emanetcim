import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("expo", () => ({ requireOptionalNativeModule: jest.fn(() => ({})) }));
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: (k: string) => Promise.resolve(store.get(k) ?? null),
    setItemAsync: (k: string, v: string) => Promise.resolve(void store.set(k, v)),
  };
});
type Ev = { title: string; startDate: Date; endDate: Date; alarms: { relativeOffset: number }[]; location?: string };
const mockCreateEvent = jest.fn((e: Ev) => Promise.resolve({ id: `ev-${e.title}` }));
const mockRequest = jest.fn(() => Promise.resolve({ granted: true }));
jest.mock("expo-calendar", () => ({
  requestCalendarPermissions: () => mockRequest(),
  getDefaultCalendarSync: () => ({ createEvent: mockCreateEvent }),
  getCalendars: () => Promise.resolve([{ allowsModifications: false }, { allowsModifications: true, isPrimary: true, createEvent: mockCreateEvent }]),
}));

// eslint-disable-next-line import/first
import { addBookingToCalendar, calendarAvailable, isInCalendar } from "@/lib/booking-calendar";

const booking = {
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  checkInTime: "2026-12-01T09:00:00.000Z",
  checkOutTime: "2026-12-01T18:00:00.000Z",
  shopAddress: "Ornek Cad. 1",
};
const copy = { dropOffTitle: "drop", pickUpTitle: "pick", notes: "n" };

describe("booking-calendar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("izin reddinde etkinlik yazmaz", async () => {
    mockRequest.mockResolvedValueOnce({ granted: false });
    await expect(addBookingToCalendar(booking, copy)).resolves.toBe("denied");
    expect(mockCreateEvent).not.toHaveBeenCalled();
    await expect(isInCalendar(booking)).resolves.toBe(false);
  });

  it("iki etkinlik, 30 dk alarm, adres; sonra cift kayit algilanir", async () => {
    await expect(addBookingToCalendar(booking, copy)).resolves.toBe("added");
    expect(mockCreateEvent).toHaveBeenCalledTimes(2);
    const [drop, pick] = mockCreateEvent.mock.calls.map((c) => c[0]);
    expect(drop.title).toBe("drop");
    expect(drop.startDate.toISOString()).toBe(booking.checkInTime);
    expect(pick.startDate.toISOString()).toBe(booking.checkOutTime);
    expect(drop.alarms).toEqual([{ relativeOffset: -30 }]);
    expect(drop.location).toBe("Ornek Cad. 1");
    await expect(isInCalendar(booking)).resolves.toBe(true);
  });

  it("saat degisince eski kayit sayilmaz", async () => {
    await expect(isInCalendar({ ...booking, checkOutTime: "2026-12-01T20:00:00.000Z" })).resolves.toBe(false);
  });

  it("yerel modul yoksa kullanilamaz", () => {
    const expo = jest.requireMock<{ requireOptionalNativeModule: jest.Mock }>("expo");
    expo.requireOptionalNativeModule.mockReturnValueOnce(null);
    expect(calendarAvailable()).toBe(false);
  });
});
