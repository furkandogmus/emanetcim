/** Kilit kimseyi disari kilitlemez: iptal kilit ekraninda birakir, orada yeniden dene ve cikis var. */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Text } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import "@/lib/i18n";
import { AppLockGate } from "@/components/AppLockGate";

const mockSignOut = jest.fn(async () => undefined);
let mockRole = "ADMIN";
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ state: { status: "signedIn", user: { id: "u1", role: mockRole } }, impersonating: null, signOut: mockSignOut }),
}));
const mockAuthenticate = jest.fn(async () => false);
const mockCanLock = jest.fn(async () => true);
jest.mock("@/lib/app-lock", () => {
  const real = jest.requireActual<typeof import("@/lib/app-lock")>("@/lib/app-lock");
  return {
    ...real,
    deviceCanLock: () => mockCanLock(),
    authenticate: () => mockAuthenticate(),
    readLockPref: async () => null,
    writeLockPref: async () => undefined,
  };
});
jest.mock("lucide-react-native", () => ({ LockKeyhole: () => null }));
jest.mock("expo-secure-store", () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined }));

function ui() {
  return render(
    <AppLockGate>
      <Text>icerik</Text>
    </AppLockGate>,
  );
}

describe("AppLockGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = "ADMIN";
  });

  it("yonetici soguk acilista kilitli; iptal kilit ekraninda birakir, cikis calisir", async () => {
    ui();
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Unlock")).toBeTruthy();
    fireEvent.press(screen.getByText("Sign out"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("dogrulama basarili olunca kilit kalkar", async () => {
    mockAuthenticate.mockResolvedValueOnce(true);
    ui();
    await waitFor(() => expect(screen.queryByText("Unlock")).toBeNull());
    expect(screen.getByText("icerik")).toBeTruthy();
  });

  it("misafir ve kayitli kimlik dogrulamasi olmayan cihaz kilitlenmez", async () => {
    mockRole = "GUEST";
    ui();
    await waitFor(() => expect(screen.getByText("icerik")).toBeTruthy());
    expect(screen.queryByText("Unlock")).toBeNull();
    mockRole = "ADMIN";
    mockCanLock.mockResolvedValueOnce(false);
    ui();
    await waitFor(() => expect(mockCanLock).toHaveBeenCalled());
    expect(screen.queryByText("Unlock")).toBeNull();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
