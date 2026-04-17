/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterClient from "./RegisterClient";
import * as actions from "@/actions/register";

// Mock next-intl (already in setup, but ensuring key-based return)
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@/actions/register", () => ({
  registerGuestAction: vi.fn(),
  registerPartnerApplicationAction: vi.fn(),
}));

// Mock LocationPicker as it uses maplibre which is hard to test in jsdom
vi.mock("@/components/partner/LocationPicker", () => ({
  default: ({ onChange }: any) => (
    <div data-testid="location-picker">
      <button onClick={() => onChange({ city: "Istanbul", district: "Besiktas", address: "Main St", latitude: 1, longitude: 1 })}>
        Select Location
      </button>
    </div>
  ),
}));

describe("RegisterClient UI Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show frontend error for invalid TR phone in Partner tab", async () => {
    render(<RegisterClient />);
    
    // Switch to Partner tab
    const partnerTab = screen.getByText("Common.demoEsnaf");
    fireEvent.click(partnerTab);

    // Fill name and password
    fireEvent.change(screen.getByPlaceholderText("Auth.fullName"), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByPlaceholderText("Auth.password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Auth.shopName"), { target: { value: "Excellent Shop" } });
    
    // Fill invalid phone
    fireEvent.change(screen.getByPlaceholderText("Auth.phonePlaceholder"), { target: { value: "123" } });

    // Submit
    fireEvent.click(screen.getByText("Auth.registerSubmitPartner"));

    // Check for error (Errors.invalidTrPhone)
    expect(screen.getByText("Errors.invalidTrPhone")).toBeInTheDocument();
    expect(actions.registerPartnerApplicationAction).not.toHaveBeenCalled();
  });

  it("should show server error if guest registration fails", async () => {
    vi.mocked(actions.registerGuestAction).mockResolvedValue({
      success: false,
      error: "Errors.emailAlreadyRegistered",
    });

    render(<RegisterClient />);

    fireEvent.change(screen.getByPlaceholderText("Auth.fullName"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByPlaceholderText("Auth.email"), { target: { value: "jane@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("Auth.password"), { target: { value: "password123" } });

    fireEvent.click(screen.getByText("Auth.registerSubmitGuest"));

    await waitFor(() => {
      // translateServerError logic in RegisterClient
      expect(screen.getByText("Errors.emailAlreadyRegistered")).toBeInTheDocument();
    });
  });

  it("should show success state on successful registration", async () => {
    vi.mocked(actions.registerGuestAction).mockResolvedValue({ success: true });

    render(<RegisterClient />);

    fireEvent.change(screen.getByPlaceholderText("Auth.fullName"), { target: { value: "Success User" } });
    fireEvent.change(screen.getByPlaceholderText("Auth.email"), { target: { value: "success@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("Auth.password"), { target: { value: "password123" } });

    fireEvent.click(screen.getByText("Auth.registerSubmitGuest"));

    await waitFor(() => {
      expect(screen.getByText("Auth.registerSuccessTitle")).toBeInTheDocument();
    });
  });
});
