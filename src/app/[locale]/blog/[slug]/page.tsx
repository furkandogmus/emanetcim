import { formatDateInZone } from "@/lib/format-datetime";
import { PLATFORM_TIMEZONE } from "@/lib/datetime-local";
import { setRequestLocale, getTranslations } from "next-intl/server";
import prisma from "@/lib/db";
import { Link } from "@/i18n/routing";
import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { Clock, User, ArrowLeft, Share2 } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ensureDefaultBlogPosts } from "@/lib/blog-initializer";
import { alternatesForPath } from "@/lib/seo-alternates";
import { socialMetadata } from "@/lib/social-metadata";
import { serializeJsonLd } from "@/lib/json-ld-script";
import { sanitizeRichText, stripHtmlToText } from "@/lib/rich-text";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  let post = await prisma.blogPost.findUnique({ where: { slug, isPublished: true } });

  if (!post) {
    await ensureDefaultBlogPosts(locale);
    post = await prisma.blogPost.findUnique({ where: { slug, isPublished: true } });
  }

  if (!post) return { title: "Not Found" };

  const base = getSiteBaseUrl();
  const description = post.excerpt || stripHtmlToText(post.content).substring(0, 160);
  const canonical = `${base}/${locale}/blog/${slug}`;
  return {
    title: post.title,
    description,
    alternates: alternatesForPath(locale, `/blog/${slug}`),
    /*
      `images` KOSULLU veriliyor: onceki hali `post.coverImage ? [...] : []` idi,
      yani kapagi olmayan bir yazinin paylasim karti BOS dizi aliyordu ve geri
      dusecek marka gorseli de kalmiyordu. Tanimsiz birakildiginda
      `socialMetadata` varsayilan gorseli koyuyor.
    */
    ...socialMetadata({
      type: "article",
      url: canonical,
      title: post.title,
      description,
      images: post.coverImage ? [post.coverImage] : undefined,
      article: {
        publishedTime: post.createdAt.toISOString(),
        authors: [post.authorName],
      },
    }),
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Guest");

  let post = await prisma.blogPost.findUnique({
    where: { slug, isPublished: true },
  });

  if (!post) {
    await ensureDefaultBlogPosts(locale);
    post = await prisma.blogPost.findUnique({
      where: { slug, isPublished: true },
    });
  }

  if (!post) {
    notFound();
  }

  // JSON-LD for Article SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "image": post.coverImage ? [post.coverImage] : [],
    "datePublished": post.createdAt.toISOString(),
    "dateModified": post.updatedAt.toISOString(),
    "author": [{
      "@type": "Person",
      "name": post.authorName,
      "url": "https://bagajpark.com"
    }]
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* Hero Header */}
      <header className="pt-32 pb-10 px-6 max-w-4xl mx-auto">
        <Link href="/blog" /* `py-2 -my-2`: olculdu 115x16 px; yazidan cikisin tek yolu ve
             mobilde parmakla isabet edilmesi gerekiyor (WCAG 2.5.8). */
          className="inline-flex items-center gap-2 py-2 -my-2 text-gray-400 hover:text-orange-600 transition-colors mb-8 group id-eyebrow text-xs">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          {t("backToBlog")}
        </Link>
        <div className="flex items-center gap-4 id-eyebrow text-orange-600 mb-6 font-sans">
          <span className="bg-orange-600 text-white px-3 py-1 rounded-full uppercase">{t("blogCategory")}</span>
          <span className="flex items-center gap-1.5 text-gray-400"><Clock size={12} /> {formatDateInZone(post.createdAt, { locale, timeZone: PLATFORM_TIMEZONE })}</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-gray-900 leading-[1.1] mb-8">
          {post.title}
        </h1>
        <div className="flex items-center justify-between border-t border-b border-gray-100 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
              <User size={20} />
            </div>
            <div>
              <p className="text-xs id-eyebrow text-gray-900">{post.authorName}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{t("editorLabel")}</p>
            </div>
          </div>
          <button className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-orange-600 transition-colors">
            <Share2 size={18} />
          </button>
        </div>
      </header>

      {/* Cover Image */}
      {post.coverImage && (
        <section className="mb-16 px-6 max-w-6xl mx-auto">
          <div className="relative aspect-[21/9] rounded-4xl overflow-hidden shadow-2xl shadow-gray-200">
            <Image 
              src={post.coverImage} 
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        </section>
      )}

      {/* Main Content */}
      <article className="px-6 max-w-3xl mx-auto">
        <div 
          className="prose prose-lg md:prose-xl prose-orange max-w-none prose-p:leading-relaxed prose-p:text-gray-700 prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-gray-900 prose-img:rounded-3xl prose-img:shadow-xl prose-a:text-orange-600 prose-a:font-black prose-strong:font-black"
          /*
            TEMIZLENMIS govde (2026-08-31). Icerigi yonetici yaziyor, yani
            zengin metin BILINCLI bir ozellik -- ama tek savunma "yoneticiye
            guveniyoruz" olamaz: hesap ele gecirilirse depolanmis XSS siteyi
            ziyaret eden HERKESI vurur ve CSP'de `'unsafe-inline'` oldugu icin
            enjekte edilen script CALISIR. Gerekce ve izin listesi
            `src/lib/rich-text.ts`te.
          */
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(post.content) }}
        />
        
        {/* Footer Area */}
        <div className="mt-20 pt-10 border-t border-gray-100">
          <div className="bg-orange-50 p-8 rounded-4xl border border-orange-100">
            {/* `h2`, `h4` DEGIL: yazinin h1'inden sonra iki seviye atliyordu. */}
            <h2 className="text-sm id-eyebrow text-gray-900 mb-2">{t("ctaTitle")}</h2>
            <p className="text-sm font-bold text-gray-500 mb-6 leading-relaxed">{t("ctaDescription")}</p>
            <Link 
              href="/search"
              className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-2xl id-eyebrow text-xs shadow-lg shadow-orange-200 hover:scale-105 transition-all"
            >
              {t("findShop")}
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
