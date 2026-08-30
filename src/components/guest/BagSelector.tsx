"use client";

import { Minus, Plus, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BagSelectorProps {
  label: string;
  sublabel: string;
  count: number;
  onIncrease: () => void;
  onDecrease: () => void;
  /**
   * Boy kimligi (`s` | `m` | `xl`). Verilirse +/- dugmelerine
   * `bag-<size>-increase` / `bag-<size>-decrease` test kancasi eklenir.
   *
   * NEDEN VAR (2026-08-26): E2E bu dugmeleri
   * `getByRole('button', { name: 'Increase' }).nth(0)` ile ariyordu. Iki ayri
   * kirilganlik: (1) erisilebilirlik adi `t("increase")` ile CEVRILIYOR, yani
   * `/tr` sayfasinda "M artir" oluyor ve 'Increase' HICBIR ZAMAN eslesmiyor;
   * (2) `.nth(0)` konum bazli -- boylarin sirasi degisirse test sessizce
   * baska bir dugmeye tiklar. Ikisi birlikte CI'yi kirmizi tutuyordu
   * (`use-cases.spec.ts:36` ve `:82`, `locator.click` zaman asimi).
   *
   * Test kancasi bilerek `aria-label`'dan AYRI: erisilebilirlik adi cevrilmeye
   * devam etmeli, test ise dilden bagimsiz olmali.
   */
  size?: "s" | "m" | "xl";
  /**
   * Verilirse `count >= max` oldugunda "+" pasif olur.
   *
   * NEDEN VAR: "+" hicbir zaman disabled olmuyordu -- misafir art art
   * tiklayip sunucunun `clampBagCount` ile sessizce kirptigi (varsayilan 50)
   * tutarin cok uzerine cikabiliyordu. Checkout boyunca kirpilmamis sayi
   * gosterilip son anda farkli bir tutar cikmasi guveni kirar.
   */
  max?: number;
}

/**
 * BagSelector - Valiz Adet Seçici
 * KISS Prensibi: Basit +/- kontrolleri.
 */
export default function BagSelector({ label, sublabel, count, onIncrease, onDecrease, size, max }: BagSelectorProps) {
  const t = useTranslations('Common');
  return (
    /*
      `flex-wrap` + sol grupta `min-w-0 flex-1`, sag grupta `shrink-0`.

      NEDEN (2026-08-31'de olculdu): metin boyutu %200'e cikarildiginda (WCAG
      2.2 kriteri 1.4.4) checkout sayfasi 200 px yana kayiyordu ve kaynak bu
      satirdi. Iki grup da buyuyor (ikon dolgusu, bosluk, sayi genisligi) ama
      satir sarmalanamadigi icin tasiyordu. Sarmalama acilinca adimlayici alt
      satira geciyor ve yatay kaydirma sifirlaniyor -- olculdu: 200 px -> 0.

      Etiket kuculebilmeli (`min-w-0`), ADIMLAYICI KUCULMEMELI (`shrink-0`):
      +/- dugmeleri dokunma hedefi, daralirsa isabet edilemez hale gelir.
    */
    <div className="ui-card-soft flex flex-wrap items-center justify-between gap-3 p-4 group hover:border-orange-200 transition-all">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="bg-white p-3 rounded-xl shadow-sm text-gray-400 group-hover:text-orange-600 transition-colors">
          <Package size={24} strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">{label}</p>
          <p className="ui-kicker">{sublabel}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <button 
          type="button"
          onClick={onDecrease}
          disabled={count === 0}
          aria-label={t("decrease", { label })}
          data-testid={size ? `bag-${size}-decrease` : undefined}
          className="btn-ui btn-ui-sm btn-ui-secondary btn-ui-icon rounded-full text-gray-900 shadow-sm"
        >
          <Minus size={18} />
        </button>
        <span className="w-6 text-center font-black text-lg text-gray-900">{count}</span>
        <button 
          type="button"
          onClick={onIncrease}
          disabled={max !== undefined && count >= max}
          aria-label={t("increase", { label })}
          data-testid={size ? `bag-${size}-increase` : undefined}
          className="btn-ui btn-ui-sm btn-ui-primary btn-ui-icon rounded-full"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
