import { Platform } from "react-native";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

/**
 * Sitenin Google girisiyle ayni web istemci kimligi (Firebase projesi
 * `bagajpark-694ad`). Android'de token'in `aud` alani bu olur ve sunucu
 * `GOOGLE_CLIENT_ID` ile eslestirir. Gizli degil; derleme aninda `eas.json`'dan.
 * Tanimsizsa Google girisi hic sunulmaz: yapilandirmasiz build kirik dugme gostermesin.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

/** iOS istemci kimligi ve Apple hesabi gelene kadar yalnizca Android. */
export const googleSignInAvailable = Platform.OS === "android" && WEB_CLIENT_ID.length > 0;

let configured = false;

export class GoogleSignInError extends Error {
  constructor(public readonly code: "play_services" | "in_progress" | "google_failed") {
    super(code);
  }
}

/**
 * Yerel hesap seciciyi acar ve ID token doner. Kullanici vazgecerse `null`:
 * vazgecmek hata degil, ekranda mesaj gosterilmez.
 */
export async function pickGoogleIdToken(): Promise<string | null> {
  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (isCancelledResponse(res)) return null;
    if (isSuccessResponse(res) && res.data.idToken) return res.data.idToken;
    throw new GoogleSignInError("google_failed");
  } catch (e) {
    if (e instanceof GoogleSignInError) throw e;
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (e.code === statusCodes.IN_PROGRESS) throw new GoogleSignInError("in_progress");
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new GoogleSignInError("play_services");
    }
    // DEVELOPER_ERROR (SHA-1 / istemci kimligi uyusmazligi) dahil: kullaniciya genel mesaj.
    console.warn("google_sign_in_failed", e);
    throw new GoogleSignInError("google_failed");
  }
}

/** Cikista hesap secici bir sonraki giriste yine sorsun (baska hesapla giris). */
export async function forgetGoogleAccount() {
  if (!configured) return;
  await GoogleSignin.signOut().catch(() => undefined);
}
