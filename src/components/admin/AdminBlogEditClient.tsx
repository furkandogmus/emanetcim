"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { 
  FileText, 
  ArrowLeft, 
  Save,
  Globe,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckCircle2
} from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { upsertBlogPostAction } from "@/actions/blog-actions";
import { toast } from "sonner";
import { BlogPost } from "@prisma/client";

interface AdminBlogEditClientProps {
  post: BlogPost | null;
  locale: string;
}

export default function AdminBlogEditClient({ post, locale: currentLocale }: AdminBlogEditClientProps) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    id: post?.id || "",
    title: post?.title || "",
    slug: post?.slug || "",
    content: post?.content || "",
    excerpt: post?.excerpt || "",
    coverImage: post?.coverImage || "",
    locale: post?.locale || currentLocale,
    isPublished: post?.isPublished || false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.slug || !formData.content) {
      toast.error("Lütfen zorunlu alanları doldurun.");
      return;
    }

    setLoading(true);
    try {
      await upsertBlogPostAction(formData);
      toast.success(post ? "Yazı güncellendi." : "Yazı oluşturuldu.");
      router.push("/admin/blog");
      router.refresh();
    } catch (error) {
      toast.error("Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = () => {
    const slug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setFormData({ ...formData, slug });
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-32 md:px-10 md:pt-40 pb-20">
      <header className="mb-10 max-w-5xl mx-auto">
        <Link href="/admin/blog" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">{t("blogManagement") || "Blog Listesine Dön"}</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
            <Edit3 size={32} className="text-orange-600" />
            {post ? (t("editPost") || "Yazıyı Düzenle") : (t("newPost") || "Yeni Yazı")}
          </h1>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
            {t("saveChanges") || "YAZIYI KAYDET"}
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 text-sm font-bold">
        {/* Ana İçerik */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 px-1">BAŞLIK</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                onBlur={!formData.slug ? generateSlug : undefined}
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all text-lg font-black placeholder:text-gray-300"
                placeholder="Yazı başlığını girin..."
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 px-1">İÇERİK (HTML/Markdown)</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-6 py-6 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all min-h-[500px] font-medium leading-relaxed"
                placeholder="Yazı içeriğini buraya yazın..."
              />
              <p className="mt-2 text-[10px] text-gray-400 px-1 uppercase tracking-widest">
                Şu an düz metin/HTML desteklenmektedir. Yakında zengin editör eklenecek.
              </p>
            </div>
          </div>
        </div>

        {/* Yan Menü (Ayarlar) */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 px-1">SLUG (URL YOLU)</label>
              <div className="relative">
                <LinkIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold"
                  placeholder="yazi-linki"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 px-1">DİL</label>
              <div className="relative">
                <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={formData.locale}
                  onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold appearance-none cursor-pointer"
                >
                  <option value="tr">Türkçe (TR)</option>
                  <option value="en">English (EN)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 mb-2 px-1">KAPAK GÖRSELİ URL</label>
              <div className="relative">
                <ImageIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={formData.coverImage}
                  onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold"
                  placeholder="https://gorsel-linki.jpg"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-12 h-6 rounded-full transition-all relative ${formData.isPublished ? 'bg-green-500' : 'bg-gray-200'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isPublished ? 'left-7' : 'left-1'}`}></div>
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.isPublished}
                  onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-900 transition-colors">
                  {formData.isPublished ? "YAYINLA" : "TASLAK OLARAK TUT"}
                </span>
              </label>
            </div>
          </div>

          <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 italic text-[11px] text-orange-600 font-bold leading-relaxed">
            <div className="flex items-center gap-2 mb-2 not-italic">
              <CheckCircle2 size={16} />
              <span className="font-black uppercase tracking-widest">SEO İpucu</span>
            </div>
            Yazı içeriğinde anahtar kelimeleri (valiz emanet, bagaj saklama vb.) kalın yaparak ve alt başlıklar kullanarak Google'da daha üstte yer alabiliriz.
          </div>
        </div>
      </form>
    </div>
  );
}

// Missing import fix
import { Edit3 } from "lucide-react";
