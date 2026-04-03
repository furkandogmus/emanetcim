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
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-orange-200 transition-all">
      <div className="flex items-center gap-4">
        <div className="bg-white p-3 rounded-xl shadow-sm text-gray-400 group-hover:text-orange-600 transition-colors">
          <Package size={24} strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">{label}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{sublabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={onDecrease}
          disabled={count === 0}
          aria-label="Decrease"
          className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
        >
          <Minus size={18} />
        </button>
        <span className="w-6 text-center font-black text-lg text-gray-900">{count}</span>
        <button 
          onClick={onIncrease}
          aria-label="Increase"
          className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white hover:bg-orange-700 transition-all active:scale-95 shadow-md shadow-orange-200"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
