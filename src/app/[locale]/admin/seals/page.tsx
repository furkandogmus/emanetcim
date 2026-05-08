import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft, ShieldCheck, CheckCircle2, Download } from 'lucide-react';
import Link from 'next/link';
import SealShipButton from '@/components/admin/SealShipButton';
import AdminSealInventoryClient from '@/components/admin/AdminSealInventoryClient';
import { Link as I18nLink } from '@/i18n/routing';
import prisma from '@/lib/db';
import { sealService } from '@/services/SealService';

/**
 * Admin Seals Page - Mühür Stok ve Talep Yönetimi
 */
export default async function AdminSealsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Admin');

  const requests = await prisma.sealRequest.findMany({
    include: { shop: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const pending = await prisma.sealRequest.count({ where: { status: 'PENDING' } });
  const shipped = await prisma.sealRequest.count({ where: { status: 'SHIPPED' } });
  const delivered = await prisma.sealRequest.count({ where: { status: 'DELIVERED' } });

  const sealCounts = await sealService.getSealCounts();
  const assignedBatches = await sealService.getAssignedSealBatches();
  const shops = await prisma.shop.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="p-10 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <I18nLink href="/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </I18nLink>
        <h1 className="text-3xl font-black tracking-tight">{t('sealRequests')}</h1>
      </header>

      <main className="p-10 max-w-5xl mx-auto w-full flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 px-2">
            {t('sealInventorySection')}
          </h2>
          <AdminSealInventoryClient 
            sealCounts={sealCounts} 
            shops={shops} 
            assignedBatches={assignedBatches} 
          />
        </section>

        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mt-4 px-2">
          {t('sealRequestsSection')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
           <div className="bg-orange-600 text-white p-8 rounded-[2.5rem] shadow-xl shadow-orange-200">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{t('sealsPending')}</p>
              <h2 className="text-4xl font-black">{pending}</h2>
           </div>
           <div className="bg-gray-900 text-white p-8 rounded-[2.5rem]">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">{t('sealsInTransit')}</p>
              <h2 className="text-4xl font-black">{shipped}</h2>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{t('sealsDelivered')}</p>
              <h2 className="text-4xl font-black text-gray-900">{delivered}</h2>
           </div>
        </div>

        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mt-8 mb-2 px-2">{t('recentRequests')}</h3>
        
        {requests.map((req) => (
          <div key={req.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
            <div className="flex items-center gap-6">
              <div className={`p-4 rounded-2xl ${req.status === 'PENDING' ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{req.shop.name}</h4>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('sealQuantity', { count: req.quantity })}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
               <div className="text-right hidden md:block">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${req.status === 'PENDING' ? 'text-orange-600' : 'text-gray-400'}`}>
                    {req.status === 'PENDING' ? t('statusPendingApproval') : req.status === 'SHIPPED' ? t('statusInTransit') : t('statusDelivered')}
                  </p>
                  <p className="text-[10px] font-bold text-gray-300">{req.createdAt.toISOString().slice(0, 10)}</p>
               </div>
               {req.status === 'PENDING' ? (
                 <SealShipButton requestId={req.id} requestedQuantity={req.quantity} />
               ) : req.status === 'SHIPPED' ? (
                 <div className="flex flex-col items-end gap-1">
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kargoda</span>
                   {req.trackingNumber && (
                     <span className="text-xs font-mono text-gray-500">{req.trackingNumber}</span>
                   )}
                 </div>
               ) : (
                 <div className="text-green-500">
                   <CheckCircle2 size={20} />
                 </div>
               )}
            </div>
          </div>
        ))}

        <Link
          href="/api/admin/seals/export"
          className="mt-6 w-full py-6 bg-white border-2 border-dashed border-gray-200 rounded-3xl text-gray-400 text-sm font-bold hover:border-orange-200 hover:text-orange-600 transition-all flex items-center justify-center gap-2"
        >
          <Download size={18} /> {t('exportCsv')}
        </Link>
      </main>
    </div>
  );
}
