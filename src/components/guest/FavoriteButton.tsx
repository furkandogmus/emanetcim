"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";

type Props = {
  shopId: string;
  className?: string;
};

export default function FavoriteButton({ shopId, className = "" }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(shopId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFavorite(shopId);
      }}
      className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
        fav
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-white/80 text-gray-400 hover:text-red-400 hover:bg-red-50"
      } ${className}`}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart size={18} fill={fav ? "currentColor" : "none"} />
    </button>
  );
}
