import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft, Store, MapPin, ClipboardList } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { shopService } from '@/services/ShopService';
import ApproveButton from '@/components/admin/ApproveButton';
import RejectButton from '@/components/admin/RejectButton';

/**
 * Admin Applications Page - Esnaf Başvuru Yönetimi (Server Component)
 */
export default async function AdminApplicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Admin');

  // Veritabanından bekleyen dükkan başvurularını çek
  const applications = await shopService.getPendingShops();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="p-10 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-3xl font-black tracking-tight">{t('applications')}</h1>
      </header>

      <main className="p-10 max-w-5xl mx-auto w-full flex flex-col gap-6">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
            <ClipboardList size={64} strokeWidth={1} />
            <p className="font-bold">{t('noApplications')}</p>
          </div>
        ) : (
          applications.map((app) => (
            <div key={app.id} className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 group hover:translate-y-[-4px] transition-all duration-300">
              <div className="flex items-center gap-6">
                 <div className="bg-gray-50 p-4 rounded-2xl text-gray-300 group-hover:text-orange-400 transition-colors">
                    <Store size={32} />
                 </div>
                 <div>
                    <h3 className="font-bold text-lg text-gray-900">{app.name}</h3>
                    <p className="text-sm text-gray-500 font-medium">{t('ownerLabel')} {app.owner?.name || t('anonymous')} • {new Date(app.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}</p>
                    <div className="flex items-center gap-1 text-xs text-orange-600 font-bold mt-1 uppercase tracking-widest">
                       <MapPin size={12} /> {app.address || t('defaultCity')}
                    </div>
                 </div>
              </div>

              <div className="flex gap-4 w-full md:w-auto">
                 <ApproveButton shopId={app.id} label={t('approve')} />
                 <RejectButton shopId={app.id} label={t('reject')} />
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
