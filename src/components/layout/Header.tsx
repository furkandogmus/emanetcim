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
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-gray-100 px-6 py-4 flex justify-between items-center transition-all duration-300 shadow-sm shadow-gray-50/50">
      <Link 
        href="/" 
        className="text-2xl font-black text-orange-600 tracking-tighter hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
      >
        <div className="w-8 h-8 bg-orange-600 rounded-xl"></div>
        Emanetçi
      </Link>
      
      <div className="flex items-center gap-6">
        <UserNav />
      </div>
    </header>
  );
}
