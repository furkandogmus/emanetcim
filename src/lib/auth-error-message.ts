/**
 * NextAuth `?error=` kodları (OAuth callback, sign-in sayfası) için kullanıcı mesajı.
 */
export function authErrorMessage(
  t: (key: string) => string,
  code: string | null,
): string {
  switch (code) {
    case "Configuration":
      return t("authErrorConfiguration");
    case "AccessDenied":
      return t("authErrorAccessDenied");
    case "Verification":
      return t("authErrorVerification");
    case "OAuthSignin":
      return t("authErrorOAuthSignin");
    case "OAuthCallback":
      return t("authErrorOAuthCallback");
    case "OAuthCreateAccount":
      return t("authErrorOAuthCreateAccount");
    case "EmailCreateAccount":
      return t("authErrorEmailCreateAccount");
    case "Callback":
      return t("authErrorCallback");
    case "OAuthAccountNotLinked":
      return t("authErrorOAuthAccountNotLinked");
    case "SessionRequired":
      return t("authErrorSessionRequired");
    default:
      return t("authErrorGeneric");
  }
}
