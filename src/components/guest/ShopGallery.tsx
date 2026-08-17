"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  images: { id: string; url: string }[];
  shopName: string;
}

export default function ShopGallery({ images, shopName }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const lastDist = useRef(0);
  const pinchZooming = useRef(false);

  const prev = () => setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  const dist = (t: React.TouchEvent) => {
    const dx = t.touches[0].clientX - t.touches[1].clientX;
    const dy = t.touches[0].clientY - t.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchZooming.current = true;
      lastDist.current = dist(e);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pinchZooming.current || e.touches.length < 2) return;
    e.preventDefault();
    const d = dist(e);
    const delta = d / lastDist.current;
    setScale((s) => Math.max(1, Math.min(5, s * delta)));
    lastDist.current = d;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pinchZooming.current) {
      pinchZooming.current = false;
      setScale(1);
    }
  }, []);

  // Guard hook'lardan sonra: koşullu hook çağrısı render sırasını bozuyordu.
  if (images.length === 0) return null;

  return (
    <>
      <div className="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden bg-gray-100">
        <Image
          src={images[activeIndex].url}
          alt={`${shopName} ${activeIndex + 1}`}
          fill
          unoptimized
          className="object-cover cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === activeIndex ? "bg-white w-4" : "bg-white/50"}`}
                />
              ))}
            </div>
            <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-full">
              {activeIndex + 1}/{images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(i)}
              className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${i === activeIndex ? "border-orange-500" : "border-transparent opacity-60 hover:opacity-100"}`}
            >
              <Image src={img.url} alt="" fill unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center touch-pinch-zoom"
          onClick={() => setLightboxOpen(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 z-10"
          >
            <X size={20} />
          </button>
          <div
            className="relative w-[90vw] h-[85vh] transition-transform duration-75"
            style={{ transform: `scale(${scale})` }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[activeIndex].url}
              alt={shopName}
              fill
              unoptimized
              className="object-contain rounded-lg"
            />
          </div>
          {scale > 1 && (
            <button
              onClick={() => setScale(1)}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-sm"
            >
              Reset Zoom
            </button>
          )}
        </div>
      )}
    </>
  );
}
