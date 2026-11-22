/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import GuestContactForm from "@/components/guest/GuestContactForm";

vi.mock("next-intl", () => {
  const t = Object.assign((key: string) => key, { has: () => true });
  return { useTranslations: () => t };
});

function Harness({ onValid }: { onValid: () => void }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <GuestContactForm
      email={email}
      phone={phone}
      onEmailChange={setEmail}
      onPhoneChange={setPhone}
      error={error}
      onError={setError}
      isProcessing={false}
      onValid={onValid}
    />
  );
}

describe("GuestContactForm (checkout misafir iletişimi)", () => {
  it("alanlar görünür etikete bağlı ve doğru autocomplete taşıyor", () => {
    render(<Harness onValid={() => {}} />);
    const email = screen.getByLabelText("checkoutGuestEmailPlaceholder");
    const phone = screen.getByLabelText("checkoutGuestPhonePlaceholder");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(phone).toHaveAttribute("autocomplete", "tel");
    // Görünür etiketten farklı aria-label yok (WCAG 2.5.3).
    expect(email).not.toHaveAttribute("aria-label");
    expect(email.closest("form")).not.toBeNull();
  });

  it("Enter (form submit) geçerli e-postayla rezervasyonu başlatır", () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    const email = screen.getByLabelText("checkoutGuestEmailPlaceholder");
    fireEvent.change(email, { target: { value: "misafir@example.com" } });
    fireEvent.submit(email.closest("form")!);
    expect(onValid).toHaveBeenCalledTimes(1);
  });

  it("boş e-postada alan geçersiz, odakta, özet alert duruyor", () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    const email = screen.getByLabelText("checkoutGuestEmailPlaceholder");
    fireEvent.submit(email.closest("form")!);
    expect(onValid).not.toHaveBeenCalled();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("checkoutGuestContactRequired");
    expect(document.activeElement).toBe(email);
    expect(screen.getByRole("alert")).toHaveTextContent("checkoutGuestContactRequired");
  });

  it("kısa telefon telefonu işaretler, e-postayı değil", () => {
    render(<Harness onValid={() => {}} />);
    fireEvent.change(screen.getByLabelText("checkoutGuestEmailPlaceholder"), {
      target: { value: "misafir@example.com" },
    });
    const phone = screen.getByLabelText("checkoutGuestPhonePlaceholder");
    fireEvent.change(phone, { target: { value: "123" } });
    fireEvent.submit(phone.closest("form")!);
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(phone);
    expect(screen.getByLabelText("checkoutGuestEmailPlaceholder")).not.toHaveAttribute("aria-invalid");
  });
});
