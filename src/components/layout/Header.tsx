"use client";

import { Link } from "@/i18n/routing";
import UserNav from "./UserNav";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  
  // Login sayfasında Header'ı gizleyebiliriz (isteğe bağlı)
  const isLoginPage = pathname.includes('/login');
  if (isLoginPage) return null;

  return (
    <header className="sticky top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-gray-100 px-6 py-3 flex justify-between items-center transition-all duration-300 shadow-sm shadow-gray-50/50">
      <Link 
        href="/" 
        className="text-xl font-black text-orange-600 tracking-tighter hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
      >
        <div className="w-8 h-8 bg-orange-600 rounded-xl"></div>
        BagajPark
      </Link>
      
      <div className="flex items-center gap-4 sm:gap-8">
        <Link 
          href="/blog" 
          className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-orange-600 hover:scale-105 transition-all"
        >
          BLOG
        </Link>
        <UserNav />
      </div>
    </header>
  );
}
