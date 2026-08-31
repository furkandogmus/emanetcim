"use client";

import { useActionState } from "react";
import { Send, CheckCircle, AlertCircle } from "lucide-react";
import { sendContactMessageAction, type ContactFormState } from "@/actions/contact";

interface Props {
  labels: {
    formTitle: string;
    name: string;
    email: string;
    message: string;
    send: string;
    success: string;
    error: string;
    tooManyRequests: string;
  };
  responseNote: string;
}

const initialState: ContactFormState = { status: "idle" };

export default function ContactFormClient({ labels, responseNote }: Props) {
  const [state, formAction, isPending] = useActionState(sendContactMessageAction, initialState);

  if (state.status === "success") {
    return (
      <div className="bg-white rounded-4xl p-12 border border-gray-100 shadow-2xl shadow-gray-200/50 order-1 lg:order-2 flex flex-col items-center justify-center gap-6 text-center min-h-[400px]">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500">
          <CheckCircle size={40} />
        </div>
        <p className="text-2xl font-black text-gray-900">{labels.success}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-4xl p-12 border border-gray-100 shadow-2xl shadow-gray-200/50 order-1 lg:order-2">
      <h2 className="text-3xl font-black text-gray-900 mb-8 tracking-tight">{labels.formTitle}</h2>

      {state.status === "error" && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-3 p-4 bg-red-50 rounded-2xl text-red-600 text-sm font-bold"
        >
          <AlertCircle size={18} className="shrink-0" />
          {/*
            `state.error` "too_many_requests" oldugunda da hep ayni genel
            mesaj gosteriliyordu -- misafir arka arkaya denedigi icin hizlandirma
            sinirina takildigini degil, formun "bozuk" oldugunu dusunuyordu.
          */}
          {state.error === "too_many_requests" ? labels.tooManyRequests : labels.error}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-6">
        <div className="space-y-2">
          {/*
            `htmlFor` + `id`: etiketler GORSEL olarak vardi ama girdiye BAGLI
            degildi (ne `htmlFor` ne de sarmalama). Ekran okuyucu bu alanlari
            adsiz okuyordu -- "duzenlenebilir metin, zorunlu" ve baska hicbir
            sey. Olculdu 2026-08-31: uc alanin ucunde de erisilebilir ad yok.

            `autoComplete` de eksikti: mobilde tarayicinin adi/e-postayi
            onermesi buna bagli, ve WCAG 1.3.5 bunu istiyor.
          */}
          <label htmlFor="contact-name" className="id-eyebrow text-gray-400 px-2">
            {labels.name}
          </label>
          <input
            required
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            className="w-full h-14 px-6 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all font-bold"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-email" className="id-eyebrow text-gray-400 px-2">
            {labels.email}
          </label>
          <input
            required
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={200}
            className="w-full h-14 px-6 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all font-bold"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-message" className="id-eyebrow text-gray-400 px-2">
            {labels.message}
          </label>
          <textarea
            required
            id="contact-message"
            name="message"
            rows={4}
            minLength={5}
            maxLength={2000}
            className="w-full p-6 bg-gray-50 border-none rounded-3xl focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all font-bold resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="h-16 w-full bg-gray-900 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl id-eyebrow text-sm transition-all active:scale-95 flex items-center justify-center gap-2 group"
        >
          <Send
            size={18}
            className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
          />
          {isPending ? "..." : labels.send}
        </button>
        <p className="text-[10px] text-gray-400 text-center font-bold uppercase tracking-wider mt-2">
          {responseNote}
        </p>
      </form>
    </div>
  );
}
