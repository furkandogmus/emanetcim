/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Giriş ve kayıt formları: görünür etiket (placeholder değil), kimlik alanında
 * klavye düzeltmesi kapalı, hata alan düzeyinde (aria-invalid + describedby,
 * odak geçersiz alana) ve özet role="alert" yerinde.
 */

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  getSession: vi.fn(),
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/actions/password-reset", () => ({ resetPasswordWithTokenAction: vi.fn() }));
vi.mock("next-intl", () => {
  const t = Object.assign((key: string) => key, { has: () => true });
  return { useTranslations: () => t };
});
const registerGuestAction = vi.fn();
vi.mock("@/actions/register", () => ({
  registerGuestAction: (...a: unknown[]) => registerGuestAction(...a),
  registerPartnerApplicationAction: vi.fn(),
}));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  // Animasyon ozniteliklerini DOM'a sizdirmadan duz eleman cizer.
  const strip = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>(function M(
      { initial: _i, animate: _a, exit: _e, transition: _t, ...rest },
      ref,
    ) {
      return React.createElement(tag, { ...rest, ref });
    });
  return {
    motion: { div: strip("div"), form: strip("form") },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import LoginClient from "@/app/[locale]/login/LoginClient";
import RegisterClient from "@/app/[locale]/register/RegisterClient";
import NewPasswordClient from "@/app/[locale]/auth/new-password/NewPasswordClient";
import ManageLookupForm from "@/app/[locale]/bookings/lookup/ManageLookupForm";

beforeEach(() => {
  signIn.mockReset();
  registerGuestAction.mockReset();
});

describe("LoginClient", () => {
  it("kimlik ve şifre görünür etikete bağlı, kimlik alanı düzeltmesiz", () => {
    render(<LoginClient />);
    const identity = screen.getByLabelText("emailOrPhone");
    expect(identity).toHaveAttribute("autocomplete", "username");
    expect(identity).toHaveAttribute("autocapitalize", "none");
    expect(identity).toHaveAttribute("autocorrect", "off");
    expect(identity).toHaveAttribute("spellcheck", "false");
    expect(identity).not.toHaveAttribute("aria-label");
    expect(identity).not.toHaveAttribute("placeholder");
    expect(screen.getByLabelText("password")).toHaveAttribute("autocomplete", "current-password");
  });

  it("hatalı girişte kimlik alanı geçersiz, özete bağlı ve odakta", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", code: "credentials" });
    render(<LoginClient />);
    const identity = screen.getByLabelText("emailOrPhone");
    fireEvent.change(identity, { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "x" } });
    fireEvent.submit(identity.closest("form")!);
    await waitFor(() => expect(identity).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByRole("alert")).toHaveTextContent("invalidCredentials");
    expect(identity).toHaveAccessibleDescription("invalidCredentials");
    expect(document.activeElement).toBe(identity);
  });
  it.each([
    ["tooManyRequests", "tooManyAttempts"],
    ["UserBanned", "UserBanned"],
])("%s alan hatası değil: kimlik işaretlenmez, özet gösterilir", async (code, text) => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", code });
    render(<LoginClient />);
    const identity = screen.getByLabelText("emailOrPhone");
    fireEvent.change(identity, { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "x" } });
    fireEvent.submit(identity.closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toContain(text);
    expect(identity).not.toHaveAttribute("aria-invalid");
    expect(identity).not.toHaveAttribute("aria-describedby");
  });
});

describe("RegisterClient", () => {
  it("alanlar görünür etikete bağlı", () => {
    render(<RegisterClient />);
    expect(screen.getByLabelText("fullName")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("password")).toHaveAttribute("autocomplete", "new-password");
  });

  it("sunucu 'e-posta kayıtlı' derse e-posta alanı işaretlenir, özet kalır", async () => {
    registerGuestAction.mockResolvedValue({ success: false, error: "Errors.emailAlreadyRegistered" });
    render(<RegisterClient />);
    const email = screen.getByLabelText("email");
    fireEvent.change(screen.getByLabelText("fullName"), { target: { value: "Ada" } });
    fireEvent.change(email, { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "longpassword1" } });
    fireEvent.submit(email.closest("form")!);
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(email).toHaveAccessibleDescription("emailAlreadyRegistered");
    expect(screen.getByRole("alert")).toHaveTextContent("emailAlreadyRegistered");
    expect(document.activeElement).toBe(email);
  });
});

describe("NewPasswordClient", () => {
  it("şifre yöneticisi için hesabın kimliğini taşıyan username alanı var", () => {
    const { container } = render(<NewPasswordClient accountLogin="misafir@example.com" />);
    const username = container.querySelector('input[autocomplete="username"]');
    expect(username).not.toBeNull();
    expect(username).toHaveValue("misafir@example.com");
    // type=hidden tarayıcılarca kullanıcı adı sayılmıyor.
    expect(username).not.toHaveAttribute("type", "hidden");
    expect(screen.getByLabelText("newPasswordLabel")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("newPasswordConfirm")).toHaveAttribute("autocomplete", "new-password");
  });

  it("kimlik çözülemezse username alanı çizilmez", () => {
    const { container } = render(<NewPasswordClient />);
    expect(container.querySelector('input[autocomplete="username"]')).toBeNull();
  });
});

describe("ManageLookupForm", () => {
  it("rezervasyon kodu alanı klavye düzeltmesiz, büyük harf", () => {
    render(<ManageLookupForm />);
    const code = screen.getByLabelText("bookingId");
    expect(code).toHaveAttribute("autocapitalize", "characters");
    expect(code).toHaveAttribute("spellcheck", "false");
    expect(code).toHaveAttribute("autocomplete", "off");
  });
});
