"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Loader2, Send } from 'lucide-react';
import { addReviewAction } from '@/actions/review';
import { useModalBehavior } from '@/lib/hooks/useModalBehavior';
import StarRating from '@/components/common/StarRating';
import { toast } from "sonner";
import { useActionErrorText } from "@/lib/use-action-error";

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
  const t = useTranslations();
  const errorText = useActionErrorText();

  /**
   * Escape ile kapanmıyordu ve `role="dialog"` taşımıyordu: klavye kullanıcısı
   * göndermek dışında çıkış yolu olmayan bir formun içinde kalıyordu.
   */
  useModalBehavior({ open: true, onClose });

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
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
      // `res.error` bir "Errors.x" anahtaridir, ham metin degil -- cevrilmeden
      // basilirsa toast'ta birebir "Errors.duplicateReview" yazardi.
      toast.error(errorText(res.error, t("Review.error")));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-form-title"
        aria-describedby="review-form-subtitle"
        className="bg-white text-gray-900 rounded-4xl w-full max-w-sm p-10 flex flex-col gap-8 shadow-2xl relative border border-gray-100 overflow-hidden"
      >
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-[4rem] -z-10 translate-x-8 -translate-y-8"></div>
        
        <button 
          type="button"
          onClick={onClose} 
          aria-label={t("Common.close")}
          className="btn-ui btn-ui-sm btn-ui-ghost btn-ui-icon absolute top-6 right-6 rounded-full"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <h3 id="review-form-title" className="ui-heading-lg mb-2">
            {shopName.toLowerCase()}
          </h3>
          <p id="review-form-subtitle" className="ui-kicker leading-relaxed px-4">
             {t("Review.subtitle")}
           </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
           {/* Stars Selection */}
           <div className="flex justify-center">
              <StarRating 
                rating={rating} 
                interactive={true} 
                size={40} 
                onRatingChange={(val) => setRating(val)} 
              />
           </div>

           {/* Comment Area */}
           <textarea
             value={comment}
             onChange={(e) => setComment(e.target.value)}
             aria-label={t("Review.placeholder")}
             placeholder={t("Review.placeholder")}
             className="ui-field min-h-[120px] rounded-3xl p-6 resize-none"
           />

           <button
             type="submit"
             disabled={isSubmitting}
             className="btn-ui btn-ui-lg btn-ui-primary w-full h-20 rounded-3xl gap-3"
           >
             {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Send size={20} />}
             {t("Review.submit")}
           </button>
        </form>
      </div>
    </div>
  );
}
