"use client";

import { useTranslations } from "next-intl";
import { useFieldErrors } from "@/lib/hooks/useFieldErrors";
import { useActionErrorText } from "@/lib/use-action-error";
import FieldError from "@/components/common/FieldError";

type Props = {
  email: string;
  phone: string;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  /** Form düzeyi özet (role="alert"); sunucu hatası da buraya düşer. */
  error: string | null;
  onError: (message: string | null) => void;
  isProcessing: boolean;
  /** Alanlar geçerliyse çağrılır; rezervasyonu çağıran başlatır. */
  onValid: () => void;
};

/**
 * Checkout'taki hesapsız misafir iletişim formu.
 *
 * Gerçek `<form>`: Enter gönderir, tarayıcı otomatik doldurması alanları form
 * olarak tanır. Biçim doğrulaması modal AÇIKKEN çalışır (2026-09-10): sunucu
 * hatası modal kapandıktan sonra arkadaki sayfaya düşüyordu, oysa düzeltecek
 * alanlar modalın içinde.
 */
export default function GuestContactForm({
  email,
  phone,
  onEmailChange,
  onPhoneChange,
  error,
  onError,
  isProcessing,
  onValid,
}: Props) {
  const t = useTranslations("Guest");
  const errorText = useActionErrorText();
  const { attachForm, errors, setErrors, clearError, fieldProps, errorId } =
    useFieldErrors<"email" | "phone">("checkout-guest");

  const submit = () => {
    if (isProcessing) return;
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    // E-posta zorunlu: yönetim bağı ve hesaba bağlama ona dayanır (sunucu da reddeder).
    const emailError = !trimmedEmail
      ? t("checkoutGuestContactRequired")
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
        ? errorText("Errors.invalidEmail")
        : undefined;
    const phoneError =
      trimmedPhone && trimmedPhone.length < 10 ? errorText("Errors.invalidPhone") : undefined;
    if (emailError || phoneError) {
      setErrors({ email: emailError, phone: phoneError });
      onError(emailError ?? phoneError ?? null);
      return;
    }
    setErrors({});
    onError(null);
    onValid();
  };

  const inputClass =
    "w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-[16px] font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all aria-[invalid=true]:border-red-400";

  return (
    <form
      ref={attachForm}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 mb-1 text-left">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkout-guest-email" className="text-xs font-bold text-gray-600">
            {t("checkoutGuestEmailPlaceholder")}
          </label>
          <input
            id="checkout-guest-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            aria-required="true"
            {...fieldProps("email")}
            value={email}
            onChange={(e) => {
              onEmailChange(e.target.value);
              clearError("email");
            }}
            className={inputClass}
          />
          <FieldError id={errorId("email")} message={errors.email} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkout-guest-phone" className="text-xs font-bold text-gray-600">
            {t("checkoutGuestPhonePlaceholder")}
          </label>
          <input
            id="checkout-guest-phone"
            name="tel"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            {...fieldProps("phone")}
            value={phone}
            onChange={(e) => {
              onPhoneChange(e.target.value);
              clearError("phone");
            }}
            className={inputClass}
          />
          <FieldError id={errorId("phone")} message={errors.phone} />
        </div>
      </div>

      {/* Hata modalın İÇİNDE: eskiden yalnızca arkadaki sayfada çiziliyordu. */}
      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        /* Çift gönderim koruması: iki dokunuş iki rezervasyon açıyordu. */
        disabled={isProcessing}
        className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-4 px-6 rounded-2xl font-bold transition-all shadow-lg shadow-orange-200 text-center block cursor-pointer"
      >
        {isProcessing ? t("checkoutProcessing") : t("checkoutGuestContinue")}
      </button>
    </form>
  );
}
