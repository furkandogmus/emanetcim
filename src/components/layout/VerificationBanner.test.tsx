/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VerificationBanner from "./VerificationBanner";
import { useSession } from "next-auth/react";

describe("VerificationBanner", () => {
  it("should render null if session is not available", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated" } as any);
    const { container } = render(<VerificationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should render null if user is already verified", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { emailVerified: new Date(), role: "GUEST" } },
      status: "authenticated",
    } as any);
    const { container } = render(<VerificationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should render banner if guest is not verified", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { emailVerified: null, role: "GUEST" } },
      status: "authenticated",
    } as any);
    
    render(<VerificationBanner />);
    
    // "emailVerificationRequiredBanner" is the key returned by our mock translation
    expect(screen.getByText("emailVerificationRequiredBanner")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render null for ADMIN even if not verified", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { emailVerified: null, role: "ADMIN" } },
      status: "authenticated",
    } as any);
    const { container } = render(<VerificationBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
