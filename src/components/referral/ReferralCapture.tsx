"use client";

import { useEffect } from "react";
import { storeReferralCode } from "@/lib/referral-capture";

/**
 * Herhangi bir sayfaya `?ref=KOD` ile gelindiginde kodu saklar. Gorunur bir
 * sey cizmez. `useSearchParams` yerine `location.search`: kok layout'ta
 * Suspense sinirina gerek kalmasin diye.
 */
export default function ReferralCapture() {
  useEffect(() => {
    storeReferralCode(new URLSearchParams(window.location.search).get("ref"));
  }, []);
  return null;
}
