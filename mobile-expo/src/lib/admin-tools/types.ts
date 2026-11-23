import type { Href } from "expo-router";
import type { LucideIcon } from "lucide-react-native";

/** Yonetici ozetindeki tek bir uygulama ici baglanti satiri. */
export type AdminToolLink = {
  /** React anahtari; alan icinde tekil. */
  key: string;
  href: Href;
  Icon: LucideIcon;
  /** Tam ceviri anahtari (`admin.users`, `adminOps.tools.coupons`...). */
  labelKey: string;
};

/** Ozette kendi basligiyla cizilen arac bolumu. */
export type AdminToolSection = {
  key: string;
  titleKey: string;
  links: readonly AdminToolLink[];
};
