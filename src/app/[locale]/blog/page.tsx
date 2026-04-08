import { setRequestLocale, getTranslations } from "next-intl/server";
import prisma from "@/lib/db";
import { Link } from "@/i18n/routing";
import { Metadata } from "next";
import { Clock, User, ChevronRight } from "lucide-react";
import Image from "next/image";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Guest" });
  return {
    title: t("blogTitle") || "BagajPark Blog | Seyahat İpuçları ve Bavul Emanet Rehberi",
    description: t("blogDescription") || "Seyahat ederken yüklerinden kurtulmanın yolları, İstanbul rehberi ve bagaj güvenliği hakkında her şey.",
  };
}

export default async function BlogListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Guest");

  const posts = await prisma.blogPost.findMany({
    where: { 
      locale,
      isPublished: true 
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 bg-gray-50/50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-gray-900 mb-6 uppercase">
            Bagaj<span className="text-orange-600">Park</span> Blog
          </h1>
          <p className="text-lg md:text-xl font-bold text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {t("blogTagline") || "Seyahatlerinizi kolaylaştıracak ipuçları, şehir rehberleri ve bavul emanetine dair her şey burada."}
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          {posts.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
              <p className="text-gray-400 font-bold uppercase tracking-widest">{t("noPostsFound") || "Henüz yazı paylaşılmadı."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {posts.map((post) => (
                <Link 
                  key={post.id} 
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col h-full bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden hover:shadow-2xl hover:shadow-orange-100/50 transition-all active:scale-[0.98]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                    {post.coverImage ? (
                      <Image 
                        src={post.coverImage} 
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-200">
                        <FileText size={48} />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-orange-600 border border-white/20">
                      {post.locale === "tr" ? "Seyahat" : "Travel"}
                    </div>
                  </div>

                  <div className="p-8 flex-1 flex flex-col">
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
                      <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(post.createdAt).toLocaleDateString(locale)}</span>
                      <span className="flex items-center gap-1.5"><User size={12} /> {post.authorName}</span>
                    </div>
                    <h2 className="text-xl font-black text-gray-900 group-hover:text-orange-600 transition-colors mb-3 leading-tight">
                      {post.title}
                    </h2>
                    <p className="text-sm font-bold text-gray-400 line-clamp-2 mb-6 leading-relaxed">
                      {post.excerpt || post.content.substring(0, 150).replace(/<[^>]*>/g, "")}
                    </p>
                    <div className="mt-auto flex items-center gap-1 text-xs font-black uppercase tracking-widest text-gray-900 group-hover:gap-2 transition-all">
                      {t("readMore") || "Devamını Oku"} <ChevronRight size={16} className="text-orange-600" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

import { FileText } from "lucide-react";
