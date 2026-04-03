"use client";

import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";

interface PrintButtonProps {
  label: string;
}

export default function PrintButton({ label }: PrintButtonProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <button 
      onClick={handlePrint}
      className="w-full py-5 bg-white border border-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
    >
      <Printer size={18} />
      {label}
    </button>
  );
}
