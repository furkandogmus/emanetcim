/**
 * Tasarim token'lari -- web kimliginden (`src/app/[locale]/globals.css`) elle
 * aktarildi. Web'de bir renk degisirse burasi da guncellenmeli; iki proje ayri
 * paket oldugu icin bunu zorlayan bir mekanizma henuz yok.
 *
 * Disiplin: tek vurgu rengi (turuncu), sicak notrler, hiyerarsi tipografiyle.
 */
export const colors = {
  // --id-accent-600 (hsl 21 90% 41%). Beyaz metinle ~5:1; dolu butonlarin zemini.
  accent: "#C74C0A",
  // --brand-600, markanin "ana" turuncusu: ikon, pin, vurgu metni.
  brand: "#EA580C",
  brandSoft: "#FFF4EE", // --brand-50
  brandSoftBorder: "#FDE0CC", // --brand-100

  ink: "#1C1917", // stone-900
  inkSecondary: "#57534E", // stone-600
  inkMuted: "#78716C", // stone-500, beyaz zeminde 4.8:1

  bg: "#FDFCFB", // --background, saf beyaz degil
  surface: "#FFFFFF",
  surfaceMuted: "#F5F5F4", // --id-neutral-100
  border: "#E7E5E4", // --id-neutral-200
  borderStrong: "#D6D3D1",

  success: "#15803D",
  successSoft: "#F0FDF4",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  warning: "#B45309",
  warningSoft: "#FFFBEB",
  white: "#FFFFFF",
} as const;

/**
 * Ic ice yaricap: ic = dis - aradaki bosluk. Kart 16 + ic bosluk 4 ise ic kutu 12.
 * Butonlar ve girdiler ayni `control` yaricapini paylasir; pill yalnizca cip ve rozet.
 */
export const radius = {
  inner: 10,
  control: 14,
  card: 18,
  sheet: 24,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Basliklar Bricolage Grotesque (web'in display ailesi), govde Geist, kod ve rakam
 * Geist Mono. 800 yalnizca marka/hero icin; ekran basliklari 700, kart basliklari 600 --
 * her yer 800 iken ekranlar bagiriyordu (2026-11-17 arayuz gecisi).
 */
export const fonts = {
  hero: "BricolageGrotesque_800ExtraBold",
  display: "BricolageGrotesque_700Bold",
  displayMedium: "BricolageGrotesque_600SemiBold",
  body: "Geist_400Regular",
  bodyMedium: "Geist_500Medium",
  bodySemibold: "Geist_600SemiBold",
  monoMedium: "GeistMono_500Medium",
} as const;

export const shadow = {
  card: {
    shadowColor: "#1C1917",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  floating: {
    shadowColor: "#1C1917",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;
