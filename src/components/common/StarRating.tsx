"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

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
  const [hoveredRating, setHoveredRating] = useState(0);

  const displayRating = hoveredRating || rating;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[...Array(maxRating)].map((_, i) => {
        const starValue = i + 1;
        const isActive = displayRating >= starValue;

        return (
          <motion.button
            key={i}
            type="button"
            disabled={!interactive}
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
