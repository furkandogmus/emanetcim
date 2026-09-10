/**
 * Recharts tabanlı grafiklerin (AnalyticsChart, PartnerEarningsCharts)
 * ORTAK renkleri.
 *
 * NEDEN VAR (2026-09-10'da bulundu): iki dosya da marka rengini AYRI AYRI
 * hardcode ediyordu ve ikisi de YANLIŞTI -- `#f97316` (Tailwind'in stok
 * orange-500'ü), oysa projenin gerçek marka rengi `--brand-600: hsl(21 90%
 * 48%)` = `#ea580c` (globals.css:246, "← main" diye işaretli; aynı hex
 * DateTimePicker.tsx/LocationPicker.tsx/layout.tsx theme-color'da doğru
 * kullanılıyor). Gri tonlar da ayrı ayrı tekrarlanıyordu. Recharts SVG
 * `stroke`/`fill` öznitelikleri CSS custom property okuyamadığı için
 * `var(--brand-600)` değil, aynı sabit değer TEK yerde.
 */
export const CHART_COLORS = {
  brand: "#ea580c",
  gridLine: "#f3f4f6",
  axisTick: "#9ca3af",
  border: "#e5e7eb",
} as const;
