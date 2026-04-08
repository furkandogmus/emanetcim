"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { 
  FileText,
  Search, 
  Edit3, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff,
  Globe
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { deleteBlogPostAction } from "@/actions/blog-actions";
import { toast } from "sonner";
import { BlogPost } from "@prisma/client";

interface AdminBlogClientProps {
  posts: BlogPost[];
}

export default function AdminBlogClient({ posts: initialPosts }: AdminBlogClientProps) {
  const t = useTranslations("Admin");
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(search.toLowerCase()) ||
    post.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete") || "Bu yazıyı silmek istediğinize emin misiniz?")) return;
    
    setLoadingId(id);
    try {
      await deleteBlogPostAction(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      toast.success(t("postDeletedSuccess") || "Yazı başarıyla silindi.");
    } catch {
      toast.error(t("errorTitle") || "Bir hata oluştu.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-32 md:px-10 md:pt-40">
      <header className="mb-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest">{t("backToDashboard")}</span>
          </Link>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
            <FileText className="text-orange-600" />
            {t("blogManagement") || "Blog Yönetimi"}
          </h1>
          <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">
            {posts.length} {t("totalPosts") || "Toplam Yazı"}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors" size={20} />
            <input
              type="text"
              placeholder={t("searchPostsPlaceholder") || "Yazı başlığı veya slug ara..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-bold text-sm"
            />
          </div>
          <Link
            href="/admin/blog/new"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 active:scale-95"
          >
            <Plus size={18} />
            {t("newPost") || "YENİ YAZI"}
          </Link>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden text-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("postDetails") || "Yazı Detayları"}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("locale") || "Dil"}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">{t("status") || "Durum"}</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">{t("actions") || "İşlemler"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence>
                {filteredPosts.map((post) => (
                  <motion.tr
                    key={post.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <p className="font-bold text-gray-900">{post.title}</p>
                        <p className="text-xs text-gray-400 font-medium truncate max-w-[300px]">/{post.locale}/blog/{post.slug}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-gray-500">
                        <Globe size={14} className="text-gray-300" />
                        {post.locale}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`px-3 py-1 rounded-full inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter ${
                        post.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {post.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                        {post.isPublished ? (t("published") || "YAYINDA") : (t("draft") || "TASLAK")}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/blog/${post.id}/edit`}
                          className="p-2.5 bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-xl transition-all"
                        >
                          <Edit3 size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={loadingId === post.id}
                          className="p-2.5 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-all disabled:opacity-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filteredPosts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-gray-400 font-bold">
                    {t("noPostsFound") || "Henüz hiç blog yazısı bulunamadı."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
