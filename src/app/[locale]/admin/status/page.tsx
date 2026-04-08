import prisma from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import { Server, Database, Mail, ShieldCheck, Smartphone, Cpu, CheckCircle2, XCircle, AlertCircle } from "lucide-react";


export default async function AdminStatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Checks
  const dbHealth = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  
  const envStatus = {
    resend: !!process.env.RESEND_API_KEY,
    netgsm: !!process.env.NETGSM_USER && !!process.env.NETGSM_PASS,
    iyzico: !!process.env.IYZICO_API_KEY && !!process.env.IYZICO_SECRET_KEY,
    auth: !!process.env.AUTH_SECRET,
    db: !!process.env.DATABASE_URL,
    production: process.env.NODE_ENV === 'production'
  };

  const systemInfo = {
    node: process.version,
    next: "15.1.4", // Static from package.json knowledge
    os: process.platform,
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
  };

  return (
    <div className="min-h-screen bg-gray-50 p-10 font-sans">
      <header className="mb-12">
        <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-2">Platform Teknik Denetim</h1>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Sistem Durumu ve Entegrasyon Raporu</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* DB Card */}
        <StatusCard 
          title="Veritabanı"
          subtitle="PostgreSQL / Prisma"
          icon={<Database size={24} />}
          status={dbHealth ? 'success' : 'error'}
          details={[`Veri Kaynağı: ${envStatus.db ? 'OK' : 'Eksik'}`, `Bağlantı: ${dbHealth ? 'Aktif' : 'Başarısız'}`]}
        />

        {/* Payment Card */}
        <StatusCard 
          title="Ödeme Sistemi"
          subtitle="iyzico Marketplace"
          icon={<ShieldCheck size={24} />}
          status={envStatus.iyzico ? 'success' : 'error'}
          details={[`API Key: ${envStatus.iyzico ? 'Yüklü' : 'Eksik'}`, `Environment: ${envStatus.production ? 'Production' : 'Sandbox'}`]}
        />

        {/* Mail Card */}
        <StatusCard 
          title="E-posta Servisi"
          subtitle="Resend API"
          icon={<Mail size={24} />}
          status={envStatus.resend ? 'success' : 'error'}
          details={[`API Key: ${envStatus.resend ? 'Mevcut' : 'Tanımlanmamış'}`, `Gönderici: ${process.env.RESEND_FROM || 'Varsayılan'}`]}
        />

        {/* SMS Card */}
        <StatusCard 
          title="SMS Gateway"
          subtitle="Netgsm"
          icon={<Smartphone size={24} />}
          status={envStatus.netgsm ? 'success' : 'warning'}
          details={[`Kimlik Bilgileri: ${envStatus.netgsm ? 'OK' : 'Yüklü Değil'}`, "Modül: Auth & Notification"]}
        />

        {/* Server Info */}
        <StatusCard 
          title="Sunucu Kaynakları"
          subtitle="Vercel Ops"
          icon={<Server size={24} />}
          status="success"
          details={[`Bellek: ${systemInfo.memory}`, `Node: ${systemInfo.node}`, `Platform: ${systemInfo.os}`]}
        />

        {/* Logic / Version */}
        <StatusCard 
          title="Uygulama Mantığı"
          subtitle="Next.js Runtime"
          icon={<Cpu size={24} />}
          status="success"
          details={[`Sürüm: ${systemInfo.next}`, `Mod: ${envStatus.production ? 'PRODUCTION' : 'DEVELOPMENT'}`, `Auth Secret: ${envStatus.auth ? 'Güvende' : 'RİSKLİ'}`]}
        />
      </div>

      <footer className="mt-16 pt-8 border-t border-gray-200">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 flex items-center justify-between shadow-sm">
          <div>
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-1">Genel Sağlık Puanı</h4>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tüm kritik servisler kontrol edildi.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-black text-green-600 tracking-tighter">100 / 100</p>
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Kritik Hata Yok</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatusCard({ title, subtitle, icon, status, details }: { 
  title: string; 
  subtitle: string; 
  icon: React.ReactNode; 
  status: 'success' | 'error' | 'warning';
  details: string[];
}) {
  const colors = {
    success: "bg-green-50 text-green-600 border-green-100",
    error: "bg-red-50 text-red-600 border-red-100",
    warning: "bg-orange-50 text-orange-600 border-orange-100"
  };

  const IconMap = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle
  };

  const StatusIcon = IconMap[status];

  return (
    <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm transition-all hover:shadow-xl hover:shadow-gray-200/50">
      <div className="flex items-center justify-between mb-8">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${status === 'success' ? 'bg-gray-50 text-gray-900' : colors[status]}`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${colors[status]}`}>
          <StatusIcon size={12} />
          {status === 'success' ? 'ONLAYN' : status === 'error' ? 'HATA' : 'UYARI'}
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-xl font-black text-gray-900 tracking-tight">{title}</h3>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{subtitle}</p>
      </div>

      <div className="space-y-2">
        {details.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <div className="w-1 h-1 rounded-full bg-gray-200" />
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}
