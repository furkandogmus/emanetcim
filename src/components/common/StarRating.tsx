"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
}

export default function StarRating({
  rating,
  maxRating = 5,
  size = 20,
  interactive = false,
  onRatingChange,
  className = ""
}: StarRatingProps) {
  const t = useTranslations("Common");
  const [hoveredRating, setHoveredRating] = useState(0);

  const displayRating = hoveredRating || rating;

  /**
   * Yildizlar SALT GORSEL bilgi tasiyordu: ne interaktif modda hangi yildiza
   * dokunuldugunu, ne de goruntuleme modunda "5 uzerinden 4" degerini ekran
   * okuyucuya soyleyen hicbir metin yoktu. Grup seviyesinde ozet + interaktif
   * modda dugme basina etiket eklendi; goruntuleme modunda tek tek yildizlar
   * dekoratif oldugu icin `aria-hidden`.
   */
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role={interactive ? "radiogroup" : undefined}
      aria-label={t("ratingOutOf", { rating: displayRating, max: maxRating })}
    >
      {[...Array(maxRating)].map((_, i) => {
        const starValue = i + 1;
        const isActive = displayRating >= starValue;

        return (
          <motion.button
            key={i}
            type="button"
            disabled={!interactive}
            aria-hidden={interactive ? undefined : true}
            tabIndex={interactive ? undefined : -1}
            aria-label={interactive ? t("rateStars", { count: starValue }) : undefined}
            aria-pressed={interactive ? isActive : undefined}
            onMouseEnter={() => interactive && setHoveredRating(starValue)}
            onMouseLeave={() => interactive && setHoveredRating(0)}
            onClick={() => interactive && onRatingChange?.(starValue)}
            whileHover={interactive ? { scale: 1.2, rotate: 5 } : {}}
            whileTap={interactive ? { scale: 0.9 } : {}}
            className={`${interactive ? 'cursor-pointer' : 'cursor-default'} transition-colors focus:outline-none`}
          >
            <Star
              size={size}
              strokeWidth={2.5}
              className={`transition-colors ${
                isActive
                  ? 'fill-yellow-500 text-yellow-500'
                  : 'text-gray-200'
              }`}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
