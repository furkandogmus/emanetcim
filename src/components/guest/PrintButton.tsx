"use client";

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
      className="w-full py-5 bg-white border border-gray-100 text-gray-500 id-eyebrow rounded-2xl hover:bg-gray-50 transition-all text-sm flex items-center justify-center gap-2"
    >
      <Printer size={18} />
      {label}
    </button>
  );
}
