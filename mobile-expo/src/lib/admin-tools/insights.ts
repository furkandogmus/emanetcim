import { Activity, BellRing, ChartNoAxesColumn, MapPinned } from "lucide-react-native";

import type { AdminToolSection } from "./types";

/** Salt okuma gorunurluk ekranlari; web `/admin/{analytics,status,jobs,notifications,prelaunch}` karsiligi. */
export const ADMIN_INSIGHT_TOOLS: AdminToolSection = {
  key: "insights",
  titleKey: "adminSystem.toolsTitle",
  links: [
    { key: "analytics", href: "/admin/analytics", Icon: ChartNoAxesColumn, labelKey: "adminAnalytics.title" },
    { key: "system", href: "/admin/system", Icon: Activity, labelKey: "adminSystem.title" },
    { key: "notificationLog", href: "/admin/notifications", Icon: BellRing, labelKey: "adminNotificationLog.title" },
    { key: "prelaunch", href: "/admin/prelaunch", Icon: MapPinned, labelKey: "adminPrelaunch.title" },
  ],
};
