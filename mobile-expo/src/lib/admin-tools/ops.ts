import { AlertTriangle, Flag, Handshake, SlidersHorizontal, Ticket, Wallet } from "lucide-react-native";

import type { AdminToolSection } from "./types";

/** Uygulama ici yonetim araclari; odemeler ve platform ayarlari web listesinden buraya tasindi. */
export const ADMIN_OPS_TOOLS: AdminToolSection = {
  key: "ops",
  titleKey: "adminOps.tools.title",
  links: [
    { key: "disputes", href: "/admin/disputes", Icon: AlertTriangle, labelKey: "adminOps.tools.disputes" },
    { key: "coupons", href: "/admin/coupons", Icon: Ticket, labelKey: "adminOps.tools.coupons" },
    { key: "affiliates", href: "/admin/affiliates", Icon: Handshake, labelKey: "adminOps.tools.affiliates" },
    { key: "payments", href: "/admin/payments", Icon: Wallet, labelKey: "adminOps.tools.payments" },
    { key: "settings", href: "/admin/platform-settings", Icon: SlidersHorizontal, labelKey: "adminOps.tools.settings" },
    { key: "flags", href: "/admin/feature-flags", Icon: Flag, labelKey: "adminOps.tools.flags" },
  ],
};
