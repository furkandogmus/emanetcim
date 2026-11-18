import { Platform } from "react-native";
import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";

/**
 * Sign in with Apple yalnizca iOS'ta. App Store kurali (4.8): Google ile giris sunan
 * uygulama Apple ile girisi de sunmak zorunda. Sunucu ucu `auth/apple` token'i
 * `APPLE_BUNDLE_ID` (com.bagajpark) kitlesiyle dogrular.
 */
export const appleSignInPlatform = Platform.OS === "ios";

/**
 * Dugme `app.json` -> `extra.appleSignIn` acik olmadan gorunmez. Yerel yetki (entitlement)
 * her iOS build'inde var; Apple gelistirici hesabi, EAS'ta yetkinin acilmasi ve sunucuda
 * `APPLE_BUNDLE_ID` dogrulanmadan acilirsa misafir calismayan bir dugme gorurdu. Bayrak
 * manifestte: acmak OTA ile gider, yeni build gerekmez.
 */
const enabledByConfig = Constants.expoConfig?.extra?.appleSignIn === true;

export async function appleSignInAvailable(): Promise<boolean> {
  if (!appleSignInPlatform || !enabledByConfig) return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export type AppleCredential = { identityToken: string; givenName?: string; familyName?: string };

export class AppleSignInError extends Error {
  constructor() {
    super("apple_failed");
  }
}

/**
 * Apple sayfasini acar. Vazgecilirse `null`. Ad yalnizca ILK giriste gelir; sunucu
 * hesabi o zaman acar, sonraki girislerde `sub` ile bulur.
 */
export async function pickAppleCredential(): Promise<AppleCredential | null> {
  try {
    const res = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!res.identityToken) throw new AppleSignInError();
    return {
      identityToken: res.identityToken,
      givenName: res.fullName?.givenName ?? undefined,
      familyName: res.fullName?.familyName ?? undefined,
    };
  } catch (e) {
    if (e instanceof AppleSignInError) throw e;
    if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") return null;
    console.warn("apple_sign_in_failed", e);
    throw new AppleSignInError();
  }
}
