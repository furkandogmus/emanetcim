import { useTranslation } from "react-i18next";

import { ProfileView } from "@/components/ProfileView";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/lib/auth";

export default function GuestAccountTab() {
  const { t } = useTranslation();
  const { state } = useAuth();
  if (state.status !== "signedIn") {
    return <SignInPrompt title={t("auth.profilePromptTitle")} body={t("auth.profilePromptBody")} />;
  }
  return <ProfileView asTab />;
}
