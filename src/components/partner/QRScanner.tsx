"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X } from "lucide-react";

/**
 * QRScanner Component - Partner Modülü
 * KISS: Tarayıcı içi basit ve hızlı QR okuma.
 */
interface QRScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onResult, onClose }: QRScannerProps) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    const onScanSuccess = (decodedText: string) => {
      scanner.clear();
      onResult(decodedText);
    };

    const onScanFailure = (error: any) => {
      // Sessiz hata - her karede olabilir
    };

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      scanner.clear().catch((error) => {
        console.error("Scanner::clear failed", error);
      });
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[60] bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"
        >
          <X size={24} className="text-gray-900" />
        </button>

        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
            QR Kodu Okutun
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Misafirin telefonundaki QR kodu alanın içine getirin.
          </p>

          {/* Scanner Container */}
          <div 
            id="reader" 
            className="rounded-2xl overflow-hidden border-2 border-dashed border-gray-200"
          ></div>
          
          <div className="mt-6 flex flex-col gap-2">
            <p className="text-xs text-gray-400 text-center italic">
              Kamera erişimi için lütfen tarayıcı izni verin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
