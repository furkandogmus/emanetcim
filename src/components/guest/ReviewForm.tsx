"use client";

import { useState } from 'react';
import { Star, X, Loader2, Send } from 'lucide-react';
import { addReviewAction } from '@/actions/review';

interface ReviewFormProps {
  bookingId: string;
  guestId: string;
  shopId: string;
  shopName: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * ReviewForm - Misafirlerin 1-5 yıldız ile dükkanları puanladığı modern modül.
 * UC_M_11 kapsamında değerlendirme arayüzü.
 */
export default function ReviewForm({ 
  bookingId, guestId, shopId, shopName, onClose, onSuccess 
}: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const res = await addReviewAction({
      bookingId,
      guestId,
      shopId,
      rating,
      comment
    });

    setIsSubmitting(false);

    if (res.success) {
      onSuccess();
    } else {
      alert(res.error || "Yorum kaydedilemedi.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white text-gray-900 rounded-[3rem] w-full max-w-sm p-10 flex flex-col gap-8 shadow-2xl relative border border-gray-100 overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-[4rem] -z-10 translate-x-8 -translate-y-8"></div>
        
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center">
           <h3 className="text-2xl font-black tracking-tighter mb-2">{shopName.toLowerCase()}</h3>
           <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed px-4">
             Deneyiminizi 1-5 yıldız arasında puanlayarak diğer gezginlere rehber olun.
           </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
           {/* Stars Selection */}
           <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform active:scale-90"
                >
                  <Star 
                    size={40} 
                    strokeWidth={2.5}
                    className={`transition-colors ${
                      (hoveredRating || rating) >= star 
                        ? 'fill-orange-500 text-orange-500' 
                        : 'text-gray-200'
                    }`} 
                  />
                </button>
              ))}
           </div>

           {/* Comment Area */}
           <textarea
             value={comment}
             onChange={(e) => setComment(e.target.value)}
             placeholder="Dükkan ve hizmet hakkındaki düşünceleriniz..."
             className="w-full bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-[2rem] p-6 text-sm font-medium outline-none min-h-[120px] transition-all resize-none"
           />

           <button
             type="submit"
             disabled={isSubmitting}
             className="w-full h-20 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-100 disabled:text-gray-300 rounded-[2rem] text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-orange-100"
           >
             {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Send size={20} />}
             DEĞERLENDİRMEYİ GÖNDER
           </button>
        </form>
      </div>
    </div>
  );
}
