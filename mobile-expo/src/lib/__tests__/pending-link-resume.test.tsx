/**
 * Gercek expo-router yigininda: girissiz acilan rezervasyon baglantisi giristen sonra
 * hedefte biter (korumali yiginin kendi yonlendirmesinden SONRA); giristen vazgecilirse
 * hedef silinir ve sonra giren baska hesap oraya dusmez.
 */
import { Pressable, Text } from "react-native";
import { Redirect, Stack } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import DeepLinkScreen from "@/app/link";
import "@/lib/i18n";
import { takePendingLink } from "@/lib/deep-link-target";
import { usePendingLinkResume } from "@/lib/use-pending-link";

jest.mock("expo-secure-store", () => ({}));

type MockState = { status: "signedIn"; user: { id: string; role: "GUEST" } } | { status: "signedOut" };
type AuthMock = { useAuthState: () => MockState; setAuthState: (s: MockState) => void };

// Oturum durumu disaridan degistirilebilir; ekranlar `useAuth` ile ayni kaynagi okur.
jest.mock("@/lib/auth", () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import("react")>("react");
  let state: MockState = { status: "signedOut" };
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  };
  const useAuthState = () => useSyncExternalStore(subscribe, () => state);
  return {
    useAuthState,
    setAuthState: (next: MockState) => {
      state = next;
      listeners.forEach((l) => l());
    },
    useAuth: () => ({ state: useAuthState(), signOut: async () => undefined, impersonating: null }),
  };
});
const { useAuthState, setAuthState } = jest.requireMock<AuthMock>("@/lib/auth");

const BK = "0f8fad5b-d9cb-469f-a165-70867728950e";

function Layout() {
  const state = useAuthState();
  usePendingLinkResume(state.status, false);
  const role = state.status === "signedIn" ? state.user.role : null;
  // Uygulamadaki korumali yigin duzeninin ozeti (`app/_layout.tsx`).
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="link" />
      <Stack.Protected guard={state.status === "signedOut"}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={role === "GUEST" || state.status === "signedOut"}>
        <Stack.Screen name="home" />
        <Stack.Screen name="bookings/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

function Login() {
  return (
    <Pressable onPress={() => setAuthState({ status: "signedIn", user: { id: "u-b", role: "GUEST" } })}>
      <Text>sign-in</Text>
    </Pressable>
  );
}

const routes = {
  _layout: Layout,
  // Uygulamadaki gibi capa rota role gore yonlendirir.
  index: () => <Redirect href="/home" />,
  home: () => <Text>home</Text>,
  link: DeepLinkScreen,
  login: Login,
  "bookings/[id]": () => <Text>booking</Text>,
};

beforeEach(() => {
  setAuthState({ status: "signedOut" });
  takePendingLink();
});

describe("usePendingLinkResume", () => {
  it("girissiz acilan rezervasyon giristen sonra acilir", async () => {
    // renderRouter ayni nesnede hem bekleme hem getPathname verir.
    const r = renderRouter(routes, { initialUrl: `/link?kind=booking&id=${BK}` });
    await r;
    expect(await screen.findByText("sign-in")).toBeTruthy();
    expect(r.getPathname()).toBe("/login");

    await fireEvent.press(screen.getByText("sign-in"));
    expect(await screen.findByText("booking")).toBeTruthy();
    expect(r.getPathname()).toBe(`/bookings/${BK}`);
  });

  it("giristen vazgecilirse hedef silinir; sonra giren hesap ana ekranda kalir", async () => {
    const { router } = jest.requireActual<typeof import("expo-router")>("expo-router");
    // renderRouter ayni nesnede hem bekleme hem getPathname verir.
    const r = renderRouter(routes, { initialUrl: `/link?kind=booking&id=${BK}` });
    await r;
    expect(await screen.findByText("sign-in")).toBeTruthy();

    await act(async () => router.replace("/home"));
    expect(await screen.findByText("home")).toBeTruthy();

    await act(async () => setAuthState({ status: "signedIn", user: { id: "u-b", role: "GUEST" } }));
    expect(r.getPathname()).toBe("/home");
    expect(screen.queryByText("booking")).toBeNull();
  });
});
