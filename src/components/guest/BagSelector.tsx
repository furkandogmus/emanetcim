"use client";

import { Minus, Plus, Package } from 'lucide-react';

interface BagSelectorProps {
  label: string;
  sublabel: string;
  count: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

/**
 * BagSelector - Valiz Adet Seçici
 * KISS Prensibi: Basit +/- kontrolleri.
 */
export default function BagSelector({ label, sublabel, count, onIncrease, onDecrease }: BagSelectorProps) {
  return (
    <div className="ui-card-soft flex items-center justify-between p-4 group hover:border-orange-200 transition-all">
      <div className="flex items-center gap-4">
        <div className="bg-white p-3 rounded-xl shadow-sm text-gray-400 group-hover:text-orange-600 transition-colors">
          <Package size={24} strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">{label}</p>
          <p className="ui-kicker">{sublabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          type="button"
          onClick={onDecrease}
          disabled={count === 0}
          aria-label="Decrease"
          className="btn-ui btn-ui-sm btn-ui-secondary btn-ui-icon rounded-full text-gray-900 shadow-sm"
        >
          <Minus size={18} />
        </button>
        <span className="w-6 text-center font-black text-lg text-gray-900">{count}</span>
        <button 
          type="button"
          onClick={onIncrease}
          aria-label="Increase"
          className="btn-ui btn-ui-sm btn-ui-primary btn-ui-icon rounded-full"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
