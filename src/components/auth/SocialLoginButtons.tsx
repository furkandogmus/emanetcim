"use client";

import { signIn } from "next-auth/react";
import { LogIn, Apple, ShieldCheck, Store, User } from "lucide-react";
import { useState } from "react";

/**
 * SocialLoginButtons - Demo Modu Destekli Giriş Paneli
 */
export default function SocialLoginButtons() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  const handleDemoLogin = (email: string) => {
    signIn("credentials", { 
      email, 
      callbackUrl: "/",
      redirect: true 
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="flex flex-col gap-3">
        {/* Real Social Buttons (Simulated/Ready for Keys) */}
        <button 
          onClick={() => signIn("google")}
          className="w-full bg-white border border-gray-200 text-gray-700 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm"
        >
          <LogIn size={20} className="text-blue-500" />
          Google ile Devam Et
        </button>

        <button 
          onClick={() => signIn("apple")}
          className="w-full bg-gray-900 border border-transparent text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-[0.98] shadow-xl"
        >
          <Apple size={20} fill="currentColor" />
          Apple ile Devam Et
        </button>
      </div>

      {/* DEMO MODU SEÇENEKLERİ */}
      <div className="flex flex-col gap-4 border-t border-gray-100 pt-6">
         <button 
           onClick={() => setIsDemoOpen(!isDemoOpen)}
           className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] hover:text-orange-600 transition-colors mx-auto"
         >
           {isDemoOpen ? "DEMO SEÇENEKLERİNİ GİZLE" : "DEMO MODU İLE GİRİŞ YAP"}
         </button>

         {isDemoOpen && (
           <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <button 
                onClick={() => handleDemoLogin("admin@emanetci.com")}
                className="bg-orange-50 hover:bg-orange-100 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group"
              >
                <ShieldCheck size={20} className="text-orange-600" />
                <span className="text-[10px] font-black text-orange-900">ADMIN</span>
              </button>
              
              <button 
                onClick={() => handleDemoLogin("galata@shop.com")}
                className="bg-blue-50 hover:bg-blue-100 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group"
              >
                <Store size={20} className="text-blue-600" />
                <span className="text-[10px] font-black text-blue-900">ESNAF</span>
              </button>

              <button 
                onClick={() => handleDemoLogin("misafir@örnek.com")}
                className="bg-green-50 hover:bg-green-100 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group"
              >
                <User size={20} className="text-green-600" />
                <span className="text-[10px] font-black text-green-900">MİSAFİR</span>
              </button>
           </div>
         )}
      </div>
    </div>
  );
}
