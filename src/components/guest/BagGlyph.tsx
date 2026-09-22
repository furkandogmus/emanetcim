export type BagSize = "s" | "m" | "xl";

/**
 * Valiz boyu cizimi. Uc boy AYNI olcekte cizilir (1 birim ~ 1 cm'ye yakin),
 * yani yan yana konunca aradaki fark gercek hayattakiyle ayni okunur:
 * sirt cantasi < kabin valizi < kargo valizi. Fotograf yerine cizim, cunku
 * her dilde ve karanlik/aydinlik zeminde ayni gorunur ve agirligi ~1 KB.
 */
const VIEWBOX: Record<BagSize, string> = {
  s: "0 0 56 72",
  m: "0 0 56 96",
  xl: "0 0 72 128",
};

/** Ayni olcek: yukseklik viewBox yuksekligiyle orantili. */
export const BAG_HEIGHT_UNITS: Record<BagSize, number> = { s: 72, m: 96, xl: 128 };

export default function BagGlyph({
  size,
  className,
  style,
}: {
  size: BagSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox={VIEWBOX[size]}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {size === "s" && (
        <g strokeWidth={3} className="stroke-brand-800">
          <path d="M20 12 Q28 1 36 12" fill="none" />
          <rect x={4} y={10} width={48} height={60} rx={16} className="fill-brand-200" />
          <rect x={12} y={40} width={32} height={22} rx={8} className="fill-brand-100" />
          <path d="M18 26 H38" fill="none" />
        </g>
      )}
      {size === "m" && (
        <g strokeWidth={3} className="stroke-brand-800">
          <path d="M22 20 V4 H34 V20" fill="none" />
          <rect x={6} y={20} width={44} height={66} rx={8} className="fill-brand-400" />
          <path d="M20 30 V76 M36 30 V76" fill="none" className="stroke-brand-700" />
          <circle cx={15} cy={90} r={4} className="fill-gray-800 stroke-gray-800" />
          <circle cx={41} cy={90} r={4} className="fill-gray-800 stroke-gray-800" />
        </g>
      )}
      {size === "xl" && (
        <g strokeWidth={3} className="stroke-brand-900">
          <path d="M28 20 V4 H44 V20" fill="none" />
          <rect x={6} y={20} width={60} height={96} rx={10} className="fill-brand-600" />
          <path d="M24 32 V104 M36 32 V104 M48 32 V104" fill="none" className="stroke-brand-800" />
          <circle cx={17} cy={121} r={5} className="fill-gray-800 stroke-gray-800" />
          <circle cx={55} cy={121} r={5} className="fill-gray-800 stroke-gray-800" />
        </g>
      )}
    </svg>
  );
}
