"use client";

import { Printer } from "lucide-react";

export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
    >
      <Printer size={16} aria-hidden />
      {label}
    </button>
  );
}
