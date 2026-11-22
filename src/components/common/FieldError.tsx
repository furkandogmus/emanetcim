/**
 * Bir alanın hata metni. Kimliği `useFieldErrors().errorId(alan)` olmalı:
 * girdinin `aria-describedby`'ı buna işaret eder. Hata yoksa hiçbir şey çizmez.
 */
export default function FieldError({
  id,
  message,
  className = "text-xs font-semibold text-red-600",
}: {
  id: string;
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} className={className}>
      {message}
    </p>
  );
}
