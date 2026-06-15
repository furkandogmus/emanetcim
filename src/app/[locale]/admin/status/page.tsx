import prisma from "@/lib/db";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Server, Database, Mail, Smartphone, Cpu, CheckCircle2, XCircle, AlertCircle } from "lucide-react";


export default async function AdminStatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("AdminStatus");

  // Checks
  const dbHealth = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  
  const envStatus = {
    resend: !!process.env.RESEND_API_KEY,
    netgsm: !!process.env.NETGSM_USER && !!process.env.NETGSM_PASS,
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
  const checks = [
    { ok: dbHealth && envStatus.db, weight: 35 },
    { ok: envStatus.auth, weight: 25 },
    { ok: envStatus.resend, weight: 20 },
    { ok: envStatus.netgsm, weight: 20 },
  ];
  const healthScore = checks.reduce((score, check) => score + (check.ok ? check.weight : 0), 0);
  const healthTone =
    healthScore >= 90
      ? { text: "text-green-600", bg: "bg-green-50", label: t("noCriticalError"), Icon: CheckCircle2 }
      : healthScore >= 60
        ? { text: "text-orange-600", bg: "bg-orange-50", label: t("warning"), Icon: AlertCircle }
        : { text: "text-red-600", bg: "bg-red-50", label: t("error"), Icon: XCircle };
  const HealthIcon = healthTone.Icon;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-24 font-sans sm:px-6 lg:p-10 lg:pt-32">
      <header className="mb-8 lg:mb-12">
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 mb-2 sm:text-4xl">{t("title")}</h1>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">{t("subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* DB Card */}
        <StatusCard 
          title={t("database")}
          subtitle="PostgreSQL / Prisma"
          icon={<Database size={24} />}
          status={dbHealth ? 'success' : 'error'}
          details={[`${t("database")}: ${envStatus.db ? t("ok") : t("missing")}`, `Connect: ${dbHealth ? t("active") : t("failed")}`]}
          tLabels={{ online: t("online"), error: t("error"), warning: t("warning") }}
        />

        {/* Mail Card */}
        <StatusCard 
          title={t("email")}
          subtitle="Resend API"
          icon={<Mail size={24} />}
          status={envStatus.resend ? 'success' : 'error'}
          details={[`API Key: ${envStatus.resend ? t("available") : t("undefined")}`, `From: ${process.env.RESEND_FROM || 'Default'}`]}
          tLabels={{ online: t("online"), error: t("error"), warning: t("warning") }}
        />

        {/* SMS Card */}
        <StatusCard 
          title={t("sms")}
          subtitle="Netgsm"
          icon={<Smartphone size={24} />}
          status={envStatus.netgsm ? 'success' : 'warning'}
          details={[`Credentials: ${envStatus.netgsm ? t("ok") : t("missing")}`, "Module: Auth & Notification"]}
          tLabels={{ online: t("online"), error: t("error"), warning: t("warning") }}
        />

        {/* Server Info */}
        <StatusCard 
          title={t("resources")}
          subtitle="Vercel Ops"
          icon={<Server size={24} />}
          status="success"
          details={[`Memory: ${systemInfo.memory}`, `Node: ${systemInfo.node}`, `Platform: ${systemInfo.os}`]}
          tLabels={{ online: t("online"), error: t("error"), warning: t("warning") }}
        />

        {/* Logic / Version */}
        <StatusCard 
          title={t("logic")}
          subtitle="Next.js Runtime"
          icon={<Cpu size={24} />}
          status="success"
          details={[`Version: ${systemInfo.next}`, `Mode: ${envStatus.production ? 'PRODUCTION' : 'DEVELOPMENT'}`, `Auth Secret: ${envStatus.auth ? 'OK' : 'RISKY'}`]}
          tLabels={{ online: t("online"), error: t("error"), warning: t("warning") }}
        />
      </div>

      <footer className="mt-12 border-t border-gray-200 pt-8 lg:mt-16">
        <div className="flex flex-col gap-6 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-1">{t("healthScore")}</h4>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("healthDesc")}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={`text-2xl font-black tracking-tighter ${healthTone.text}`}>{healthScore} / 100</p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${healthTone.text}`}>{healthTone.label}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${healthTone.bg} ${healthTone.text}`}>
              <HealthIcon size={24} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatusCard({ title, subtitle, icon, status, details, tLabels }: { 
  title: string; 
  subtitle: string; 
  icon: React.ReactNode; 
  status: 'success' | 'error' | 'warning';
  details: string[];
  tLabels: { online: string; error: string; warning: string; };
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
    <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-gray-200/50 sm:p-8 lg:rounded-[3rem]">
      <div className="flex items-center justify-between mb-8">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${status === 'success' ? 'bg-gray-50 text-gray-900' : colors[status]}`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${colors[status]}`}>
          <StatusIcon size={12} />
          {status === 'success' ? tLabels.online : status === 'error' ? tLabels.error : tLabels.warning}
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
