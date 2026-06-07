/**
 * Sayfa geçiş animasyonu globals.css'te `main { animation: fade-in }` ile
 * saf CSS olarak yapılıyor. framer-motion kaldırıldı; bu sayede landing
 * sayfalarında ~75 KiB'lık JS ilk yüklemede indirilmiyor (PageSpeed:
 * "Kullanılmayan JavaScript").
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
