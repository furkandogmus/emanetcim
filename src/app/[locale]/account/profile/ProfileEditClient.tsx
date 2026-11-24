"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { signOutWithPush } from "@/lib/web-push-client";
import { toast } from "sonner";
import { useActionErrorText } from "@/lib/use-action-error";
import { changePasswordAction, updateProfileAction } from "@/actions/profile";

const INPUT =
  "w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-[16px] font-medium outline-none focus:ring-2 focus:ring-orange-500";

export default function ProfileEditClient({
  initialName,
  initialPhone,
  email,
  hasPassword,
}: {
  initialName: string;
  initialPhone: string;
  email: string | null;
  hasPassword: boolean;
}) {
  const t = useTranslations("AccountProfile");
  const errorText = useActionErrorText();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingProfile, startProfile] = useTransition();
  const [savingPassword, startPassword] = useTransition();

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    startProfile(async () => {
      const result = await updateProfileAction({ name, phone });
      if (result.ok) toast.success(t("saved"));
      else setProfileError(errorText(result.error));
    });
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordMismatch"));
      return;
    }
    startPassword(async () => {
      const result = await changePasswordAction({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
      });
      if (!result.ok) {
        setPasswordError(errorText(result.error));
        return;
      }
      // Eski oturumlar `tokenVersion` ile dustu (ilk sifrede de); bu sekme de yeniden giris ister.
      toast.success(t(result.firstPassword ? "passwordSet" : "passwordChanged"));
      await signOutWithPush({ redirectTo: "/login" });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={saveProfile}
        className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-700">{t("nameLabel")}</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            maxLength={100}
            required
            onChange={(e) => setName(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-700">{t("phoneLabel")}</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={INPUT}
          />
          <span className="text-xs text-gray-500">{t("phoneHint")}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-700">{t("emailLabel")}</span>
          <input type="email" value={email ?? ""} readOnly disabled className={`${INPUT} text-gray-500`} />
          <span className="text-xs text-gray-500">{t("emailReadOnly")}</span>
        </label>
        {profileError ? (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
            {profileError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={savingProfile}
          className="rounded-2xl bg-orange-600 px-6 py-3 text-sm id-display text-white transition-colors hover:bg-orange-700 disabled:opacity-60"
        >
          {savingProfile ? t("saving") : t("save")}
        </button>
      </form>

      <form
        onSubmit={savePassword}
        className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg id-display text-gray-900">{t("passwordTitle")}</h2>
        <p className="text-sm text-gray-600">
          {hasPassword ? t("passwordIntroChange") : t("passwordIntroSet")}
        </p>
        {hasPassword ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-gray-700">{t("currentPassword")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              required
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={INPUT}
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-700">{t("newPassword")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            required
            minLength={8}
            onChange={(e) => setNewPassword(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-gray-700">{t("confirmPassword")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            required
            minLength={8}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={INPUT}
          />
        </label>
        {passwordError ? (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
            {passwordError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={savingPassword}
          className="rounded-2xl bg-gray-900 px-6 py-3 text-sm id-display text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
        >
          {savingPassword ? t("saving") : t("passwordSave")}
        </button>
      </form>
    </div>
  );
}
