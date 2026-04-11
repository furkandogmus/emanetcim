"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import type { HomeTestimonial } from "@/lib/home-testimonials";

type Props = {
  items: HomeTestimonial[];
};

export default function TestimonialCarousel({ items }: Props) {
  const t = useTranslations("Guest");
  if (items.length === 0) return null;

  return (
    <section
      className="border-y border-gray-100 bg-white py-14 px-6"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="testimonials-heading"
          className="text-center text-xs font-black uppercase tracking-[0.2em] text-gray-400"
        >
          {t("testimonialsTitle")}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-gray-500">
          {t("testimonialsSubtitle")}
        </p>
        <div className="mt-8 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
          {items.map((item) => (
            <figure
              key={item.id}
              className="min-w-[280px] max-w-[320px] snap-start rounded-2xl border border-gray-100 bg-gray-50/80 p-5 flex flex-col gap-3"
            >
              <div className="flex items-center gap-0.5 text-orange-500" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={
                      i < item.rating
                        ? "fill-orange-500"
                        : "fill-transparent text-gray-200"
                    }
                  />
                ))}
              </div>
              <blockquote className="text-sm font-medium leading-relaxed text-gray-700">
                “{item.comment}”
              </blockquote>
              <figcaption className="text-xs font-bold text-gray-400">
                {item.authorLabel} · {item.shopName}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
