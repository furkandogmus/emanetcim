import { bookingShortCode } from "@/lib/booking-code";
import { bookingTimeZone, formatDateTimeInZone } from "@/lib/format-datetime";
import { bcp47ForUiLocale } from "@/lib/intl-locale";

/** Kartin okudugu rezervasyon alanlari; misafirin bilet ekraninda gordugunden fazlasi yok. */
export type WalletBookingSource = {
  id: string;
  status: string;
  checkInTime: Date;
  checkOutTime: Date;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  qrCodeToken: string | null;
  locale: string | null;
  updatedAt: Date;
  shop: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
  };
};

export type WalletLabels = {
  shop: string;
  dropOff: string;
  pickUp: string;
  bags: string;
  code: string;
  address: string;
  cancelled: string;
  /** Kilit ekrani metni: dukkanin yanina gelince gorunur. `{shop}` yer tutucusu. */
  nearShop: string;
};

export type WalletPassContent = {
  serialNumber: string;
  code: string;
  shopName: string;
  address: string | null;
  location: { latitude: number; longitude: number } | null;
  dropOffText: string;
  pickUpText: string;
  dropOffAt: Date;
  bagCount: number;
  qrValue: string;
  /** Iptal / teslim edilmis: Apple `voided`, Google `EXPIRED`. */
  inactive: boolean;
  cancelled: boolean;
  updatedAt: Date;
};

const INACTIVE_STATUSES = new Set(["CANCELLED", "CHECKED_OUT"]);

export function walletPassContent(b: WalletBookingSource, uiLocale: string): WalletPassContent | null {
  // QR'siz kart esnafin tarayabilecegi bir sey tasimaz; gecici token da gercek QR degil.
  if (!b.qrCodeToken || b.qrCodeToken.startsWith("temp_")) return null;
  const timeZone = bookingTimeZone(b.shop);
  const locale = bcp47ForUiLocale(uiLocale);
  const fmt = (d: Date) => formatDateTimeInZone(d, { locale, timeZone, dateStyle: "medium", timeStyle: "short" });
  const hasLocation =
    typeof b.shop.latitude === "number" && typeof b.shop.longitude === "number" &&
    Number.isFinite(b.shop.latitude) && Number.isFinite(b.shop.longitude);
  return {
    serialNumber: b.id,
    code: bookingShortCode(b.id),
    shopName: b.shop.name,
    address: b.shop.address,
    location: hasLocation ? { latitude: b.shop.latitude!, longitude: b.shop.longitude! } : null,
    dropOffText: fmt(b.checkInTime),
    pickUpText: fmt(b.checkOutTime),
    dropOffAt: b.checkInTime,
    bagCount: b.bagCountS + b.bagCountM + b.bagCountXl,
    qrValue: b.qrCodeToken,
    inactive: INACTIVE_STATUSES.has(b.status),
    cancelled: b.status === "CANCELLED",
    updatedAt: b.updatedAt,
  };
}

const BRAND_ORANGE_RGB = "rgb(234, 88, 12)";

export function buildApplePassJson(
  c: WalletPassContent,
  labels: WalletLabels,
  cfg: { passTypeId: string; teamId: string; webServiceURL: string; authenticationToken: string },
) {
  return {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    serialNumber: c.serialNumber,
    organizationName: "BagajPark",
    description: `BagajPark ${c.code}`,
    logoText: "BagajPark",
    backgroundColor: BRAND_ORANGE_RGB,
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(255, 237, 213)",
    webServiceURL: cfg.webServiceURL,
    authenticationToken: cfg.authenticationToken,
    ...(c.inactive ? { voided: true } : {}),
    relevantDate: c.dropOffAt.toISOString(),
    ...(c.location
      ? {
          locations: [{ ...c.location, relevantText: labels.nearShop.replace("{shop}", c.shopName) }],
          maxDistance: 300,
        }
      : {}),
    barcodes: [{ format: "PKBarcodeFormatQR", message: c.qrValue, messageEncoding: "iso-8859-1", altText: c.code }],
    eventTicket: {
      headerFields: [{ key: "bags", label: labels.bags, value: c.bagCount }],
      primaryFields: [{ key: "shop", label: labels.shop, value: c.shopName }],
      secondaryFields: [
        { key: "dropOff", label: labels.dropOff, value: c.dropOffText },
        { key: "pickUp", label: labels.pickUp, value: c.pickUpText },
      ],
      auxiliaryFields: [
        { key: "code", label: labels.code, value: c.code },
        ...(c.cancelled ? [{ key: "status", label: "", value: labels.cancelled }] : []),
      ],
      backFields: c.address ? [{ key: "address", label: labels.address, value: c.address }] : [],
    },
  };
}

/** Google nesne kimligi: `<issuerId>.<sonek>`; sonek yalniz [A-Za-z0-9._-]. */
export function googleObjectId(issuerId: string, bookingId: string): string {
  return `${issuerId}.booking_${bookingId.replace(/[^A-Za-z0-9._-]/g, "_")}`;
}

export function googleClassId(issuerId: string): string {
  return `${issuerId}.bagajpark_booking`;
}

export function buildGoogleGenericObject(
  c: WalletPassContent,
  labels: WalletLabels,
  cfg: { issuerId: string; logoUrl: string; uiLocale: string },
) {
  const lang = cfg.uiLocale;
  const text = (value: string) => ({ defaultValue: { language: lang, value } });
  return {
    id: googleObjectId(cfg.issuerId, c.serialNumber),
    classId: googleClassId(cfg.issuerId),
    state: c.inactive ? "EXPIRED" : "ACTIVE",
    cardTitle: text("BagajPark"),
    header: text(c.shopName),
    subheader: text(c.cancelled ? labels.cancelled : labels.shop),
    hexBackgroundColor: "#ea580c",
    logo: { sourceUri: { uri: cfg.logoUrl }, contentDescription: text("BagajPark") },
    barcode: { type: "QR_CODE", value: c.qrValue, alternateText: c.code },
    textModulesData: [
      { id: "drop_off", header: labels.dropOff, body: c.dropOffText },
      { id: "pick_up", header: labels.pickUp, body: c.pickUpText },
      { id: "bags", header: labels.bags, body: String(c.bagCount) },
      { id: "code", header: labels.code, body: c.code },
      ...(c.address ? [{ id: "address", header: labels.address, body: c.address }] : []),
    ],
  };
}
