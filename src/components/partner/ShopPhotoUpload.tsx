"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Camera, ImageOff } from "lucide-react";
import { updateShopImageAction } from "@/actions/shop";
import { useActionErrorText } from "@/lib/use-action-error";
import { toast } from "sonner";
import { MAX_IMAGE_BYTES } from "@/lib/storage/image-validation";

/**
 * Esnafın vitrin fotoğrafını yüklediği yer.
 *
 * NEDEN YENİ (2026-09-01): `Shop.image` misafir vitrininde çiziliyordu ama
 * kod tabanında ona YAZAN tek bir satır yoktu — esnaf panelinde de, admin
 * formunda da. Pazar yerindeki her dükkan kalıcı olarak fotoğrafsızdı.
 *
 * Depolama yapılandırılmamışsa bu bileşen HİÇ ÇİZİLMEZ (`configured` prop'u):
 * çalışmayacak bir düğme göstermek, düğme göstermemekten kötüdür.
 */

type Props = {
  shopId: string;
  initialUrl: string | null;
  /** Depolama yapılandırıldı mı? Sunucu karar verir; bkz. `isStorageConfigured`. */
  configured: boolean;
};

export default function ShopPhotoUpload({ shopId, initialUrl, configured }: Props) {
  const t = useTranslations("Partner");
  const errorText = useActionErrorText();
  const [url, setUrl] = useState(initialUrl);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  if (!configured) return null;

  function onPick(file: File) {
    /*
      ISTEMCI TARAFI KONTROL YALNIZCA KOLAYLIK. Gercek dogrulama sunucuda,
      dosyanin ILK BAYTLARINDAN yapiliyor (`validateImageBytes`) -- `file.type`
      istemci kontrolundedir ve hic okunmuyor. Buradaki kontrol, 8 MB'lik bir
      dosyayi bosuna yuklemeyi onlemek icin.
    */
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(errorText("Errors.imageTooLarge"));
      return;
    }
    const form = new FormData();
    form.set("shopId", shopId);
    form.set("file", file);

    startTransition(async () => {
      const res = await updateShopImageAction(form);
      if (res.success) {
        setUrl(res.url);
        toast.success(t("shopPhotoSaved"));
      } else {
        toast.error(errorText(res.error));
      }
    });
  }

  return (
    <section className="ui-card p-5">
      <p className="id-eyebrow text-gray-400">{t("shopPhotoTitle")}</p>
      <p className="mt-1 text-xs text-gray-500">{t("shopPhotoHint")}</p>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
          {url ? (
            <Image src={url} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
              <ImageOff className="h-5 w-5" />
              <span className="px-1 text-center text-[10px] leading-tight">
                {t("shopPhotoNone")}
              </span>
            </div>
          )}
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id={`shop-photo-${shopId}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Ayni dosyayi tekrar secebilmek icin deger sifirlaniyor.
              e.target.value = "";
              if (file) onPick(file);
            }}
          />
          <label
            htmlFor={`shop-photo-${shopId}`}
            aria-disabled={pending}
            className={`id-control inline-flex cursor-pointer items-center gap-2 border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold transition-colors hover:bg-gray-50 ${
              pending ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Camera className="h-4 w-4" />
            {pending ? t("shopPhotoUploading") : t("shopPhotoChoose")}
          </label>
        </div>
      </div>
    </section>
  );
}
