"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  images: { id: string; url: string }[];
  shopName: string;
}

export default function ShopGallery({ images, shopName }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) return null;

  const prev = () => setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <>
      <div className="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden bg-gray-100">
        <img
          src={images[activeIndex].url}
          alt={`${shopName} ${activeIndex + 1}`}
          className="w-full h-full object-cover cursor-pointer"
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
              className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${i === activeIndex ? "border-orange-500" : "border-transparent opacity-60 hover:opacity-100"}`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
          >
            <X size={20} />
          </button>
          <img
            src={images[activeIndex].url}
            alt={shopName}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
