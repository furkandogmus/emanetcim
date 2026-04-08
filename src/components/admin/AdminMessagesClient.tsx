"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Mail, MailOpen, Trash2, Search, ArrowLeft, Inbox, Clock, User, Reply } from "lucide-react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { markMessageAsReadAction, deleteMessageAction } from "@/actions/admin-management";
import { toast } from "sonner";
import { ContactMessage } from "@prisma/client";

interface AdminMessagesClientProps {
  messages: ContactMessage[];
}

export default function AdminMessagesClient({ messages: initialMessages }: AdminMessagesClientProps) {
  const t = useTranslations("Admin");
  const [messages, setMessages] = useState<ContactMessage[]>(initialMessages);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredMessages = messages.filter((m) => {
    const searchLower = search.toLowerCase();
    const matchSearch =
      m.from.toLowerCase().includes(searchLower) ||
      m.subject?.toLowerCase().includes(searchLower) ||
      m.text?.toLowerCase().includes(searchLower);

    const matchFilter = filter === "ALL" || (filter === "UNREAD" && !m.isRead);

    return matchSearch && matchFilter;
  });

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLoadingId(id);
    try {
      await markMessageAsReadAction(id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
      toast.success(t("messageMarkedReadInfo"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLoadingId(id);
    try {
      await deleteMessageAction(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success(t("messageDeletedInfo"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      const msg = messages.find((m) => m.id === id);
      if (msg && !msg.isRead) {
        handleMarkAsRead(id);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-32 md:px-10 md:pt-40">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-4 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest">{t("backToDashboard")}</span>
          </Link>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
            <Inbox className="text-orange-600" />
            {t("messagesTitle")}
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "ALL" | "UNREAD")}
            className="px-4 py-4 bg-white border border-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="ALL">{t("messagesFilterAll")}</option>
            <option value="UNREAD">{t("messagesFilterUnread")}</option>
          </select>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={t("messagesSearchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-bold text-sm"
            />
          </div>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
        {filteredMessages.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <MailOpen size={32} className="text-gray-300" />
            </div>
            <p className="text-sm font-black uppercase tracking-widest">{t("messagesEmpty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            <AnimatePresence>
              {filteredMessages.map((msg) => (
                <motion.div
                  layout
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`group transition-all ${
                    msg.isRead ? "bg-white hover:bg-gray-50/50" : "bg-orange-50/20 hover:bg-orange-50/30"
                  }`}
                >
                  <div 
                    onClick={() => toggleExpand(msg.id)}
                    className="p-6 md:px-8 cursor-pointer flex flex-col md:flex-row gap-4 md:items-center justify-between"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`mt-1 flex-shrink-0 ${msg.isRead ? "text-gray-400" : "text-orange-600"}`}>
                        {msg.isRead ? <MailOpen size={20} /> : <Mail size={20} className="fill-orange-50" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`text-sm ${msg.isRead ? "font-bold text-gray-900" : "font-black text-gray-900"}`}>
                            {msg.from || "İsimsiz"}
                          </span>
                          {!msg.isRead && (
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                          )}
                        </div>
                        <p className={`text-sm truncate ${msg.isRead ? "text-gray-500 font-medium" : "text-gray-900 font-bold"}`}>
                          {msg.subject || "(Konu Yok)"}
                        </p>
                        <p className="text-xs text-gray-400 font-medium mt-1 truncate">
                          {msg.text?.substring(0, 100)}...
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-6 md:w-48 flex-shrink-0">
                      <div className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                        <Clock size={12} />
                        {new Date(msg.createdAt).toLocaleDateString("tr-TR", { month: "short", day: "numeric", hour: "2-digit", minute:"2-digit" })}
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!msg.isRead && (
                          <button
                            onClick={(e) => handleMarkAsRead(msg.id, e)}
                            disabled={loadingId === msg.id}
                            className="p-2 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                            title={t("messagesMarkAsRead")}
                          >
                            <MailOpen size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(msg.id, e)}
                          disabled={loadingId === msg.id}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title={t("messagesDelete")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded View */}
                  <AnimatePresence>
                    {expandedId === msg.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-gray-100 bg-gray-50/50"
                      >
                        <div className="p-8">
                          <div className="flex items-start gap-3 mb-6 bg-white p-4 rounded-2xl border border-gray-100">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                              <User size={20} />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-gray-900">{msg.from}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Alıcı: <span className="font-mono">{msg.to}</span></p>
                                </div>
                                <a 
                                  href={`mailto:${msg.from}?subject=RE: ${msg.subject}`}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-colors"
                                >
                                  <Reply size={14} /> Cevapla
                                </a>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                            <h3 className="text-lg font-black text-gray-900 mb-6 pb-6 border-b border-gray-50 break-words">
                              {msg.subject || "(Konu Yok)"}
                            </h3>
                            <div className="prose prose-sm prose-orange max-w-none prose-p:leading-relaxed text-gray-700 whitespace-pre-wrap">
                              {msg.text || msg.html || (
                                <div className="space-y-4">
                                  <span className="italic text-gray-400">İçerik otomatik olarak ayrıştırılamadı.</span>
                                  {msg.raw && (
                                    <details className="text-[10px] bg-gray-50 p-4 rounded-xl border border-gray-100 font-mono text-gray-500">
                                      <summary className="cursor-pointer font-black uppercase tracking-widest mb-2 hover:text-orange-600 transition-colors">
                                        Ham Veriyi Görüntüle (Raw Payload)
                                      </summary>

                                    </details>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
