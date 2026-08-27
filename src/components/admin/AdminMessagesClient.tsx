"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Mail, MailOpen, Trash2, Search, ArrowLeft, Inbox, Clock, User, Reply } from "lucide-react";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import type { ContactMessageDTO } from "@/lib/contact-message-dto";
import { replySubjectForMailto } from "@/lib/reply-subject";
import { replyToContactMessageAction } from "@/actions/contact";
import { actionErrorKey } from "@/lib/action-error";
import { bcp47ForUiLocale } from "@/lib/intl-locale";

interface AdminMessagesClientProps {
  messages: ContactMessageDTO[];
}

export default function AdminMessagesClient({ messages: initialMessages }: AdminMessagesClientProps) {
  const t = useTranslations("Admin");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);
  /**
   * Panelden cevap: gerçek e-posta olarak gider (destek adresi + In-Reply-To).
   * Eski "Yanıtla" yalnızca mailto: idi — cevap adminin kişisel kutusundan çıkıyordu.
   */
  const [replyDraft, setReplyDraft] = useState("");
  const [replySendingId, setReplySendingId] = useState<string | null>(null);

  const handleSendReply = async (messageId: string) => {
    const body = replyDraft.trim();
    if (body.length < 2) return;
    setReplySendingId(messageId);
    try {
      const res = await replyToContactMessageAction({ messageId, body });
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, isRead: true, replies: [...m.replies, res.reply] }
              : m,
          ),
        );
        setReplyDraft("");
        toast.success(t("replySent"));
      } else {
        toast.error(t("replyFailed"));
      }
    } catch {
      // `replyToContactMessageAction` icindeki prisma.contactReply.create/
      // contactMessage.update try/catch disinda -- beklenmedik bir DB
      // hatasinda hala firlar. finally yuklenme durumunu zaten sifirliyordu
      // ama hicbir hata gorulmuyordu; admin cevabin gidip gitmedigini
      // anlayamiyordu.
      toast.error(t("replyFailed"));
    } finally {
      setReplySendingId(null);
    }
  };

  const [messages, setMessages] = useState<ContactMessageDTO[]>(initialMessages);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  /**
   * Kategori görünümü. VARSAYILAN "SUPPORT" — kutu bir destek kanalıdır, e-posta
   * çöplüğü değil. 2026-08-22'de 67 mesajın 57'si okunmamıştı ve ezici çoğunluğu
   * soğuk pazarlamaydı; gerçek bir misafir şikâyeti aralarında kayboluyordu
   * (P1-18). Diğerleri silinmiyor, yalnızca varsayılan görünümün dışında.
   */
  const [category, setCategory] = useState<"SUPPORT" | "BULK" | "AUTOMATED" | "ALL">(
    "SUPPORT",
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /**
   * Toplu işlem metinleri artık `Admin` namespace'inden geliyor.
   *
   * Eskiden bileşen içinde sabit bir `locale === "tr" ? {...} : {...}` üçlüsüydü,
   * yani diğer 12 dilde toplu işlem arayüzü İngilizce çıkıyordu (P2-8). Turist
   * odaklı bir üründe Türkçe dışı diller tam da hedef kitle.
   */
  const bulkCopy = {
    selected: t("messagesBulkSelected"),
    selectAll: t("messagesBulkSelectAll"),
    delete: t("messagesBulkDelete"),
    confirm: t("messagesBulkConfirm"),
  };

  /** Seçicide gösterilen sayaçlar. `UNCLASSIFIED` destek altında sayılır. */
  const categoryCounts = {
    SUPPORT: messages.filter(
      (m) => m.category === "SUPPORT" || m.category === "UNCLASSIFIED",
    ).length,
    BULK: messages.filter((m) => m.category === "BULK").length,
    AUTOMATED: messages.filter((m) => m.category === "AUTOMATED").length,
  };

  const filteredMessages = messages.filter((m) => {
    const searchLower = search.toLowerCase();
    const matchSearch =
      (m.from || "").toLowerCase().includes(searchLower) ||
      (m.subject || "").toLowerCase().includes(searchLower) ||
      (m.text || "").toLowerCase().includes(searchLower);

    const matchFilter = filter === "ALL" || (filter === "UNREAD" && !m.isRead);

    /**
     * `UNCLASSIFIED` destek görünümünde GÖSTERİLİR.
     *
     * Sınıflandırma işi henüz çalışmamış olabilir; sınıfsız bir mesajı gizlemek,
     * gerçek bir şikâyeti görünmez kılma riski taşır. Hata payı yine ucuz tarafta.
     */
    const matchCategory =
      category === "ALL" ||
      m.category === category ||
      (category === "SUPPORT" && m.category === "UNCLASSIFIED");

    return matchSearch && matchFilter && matchCategory;
  });

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || res.statusText);
      }
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
      toast.success(t("messageMarkedReadInfo"));
    } catch (caughtError: unknown) {
      toast.error(tErrors(actionErrorKey(caughtError)));
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || res.statusText);
      }
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success(t("messageDeletedInfo"));
    } catch (caughtError: unknown) {
      toast.error(tErrors(actionErrorKey(caughtError)));
    } finally {
      setLoadingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || !window.confirm(bulkCopy.confirm)) return;

    setLoadingId("bulk");
    try {
      const res = await fetch("/api/admin/messages", {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || res.statusText);
      }
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      toast.success(t("messageDeletedInfo"));
    } catch (caughtError: unknown) {
      toast.error(tErrors(actionErrorKey(caughtError)));
    } finally {
      setLoadingId(null);
    }
  };

  const visibleIds = filteredMessages.map((message) => message.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
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
            <span className="text-xs id-eyebrow">{t("backToDashboard")}</span>
          </Link>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
            <Inbox className="text-orange-600" />
            {t("messagesTitle")}
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          {/*
            Kategori seçici. Varsayılan DESTEK: kutu bir destek kanalıdır, gelen
            e-postaların dökümü değil. Sayaçlar seçicinin üstünde ki operatör
            "toplu klasörde ne birikiyor" sorusunu bakmadan cevaplayabilsin.
          */}
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as "SUPPORT" | "BULK" | "AUTOMATED" | "ALL")
            }
            className="px-4 py-4 bg-white border border-gray-100 rounded-2xl text-xs id-eyebrow text-gray-500 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="SUPPORT">
              {t("messagesCategorySupport")} ({categoryCounts.SUPPORT})
            </option>
            <option value="BULK">
              {t("messagesCategoryBulk")} ({categoryCounts.BULK})
            </option>
            <option value="AUTOMATED">
              {t("messagesCategoryAutomated")} ({categoryCounts.AUTOMATED})
            </option>
            <option value="ALL">
              {t("messagesCategoryAll")} ({messages.length})
            </option>
          </select>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "ALL" | "UNREAD")}
            className="px-4 py-4 bg-white border border-gray-100 rounded-2xl text-xs id-eyebrow text-gray-500 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
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

      <div className="mb-4 flex min-h-12 flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-500">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            className="h-4 w-4 accent-orange-600"
          />
          {bulkCopy.selectAll}
        </label>
        <span className="text-xs font-bold text-gray-400">
          {selectedIds.size} {bulkCopy.selected}
        </span>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={loadingId === "bulk"}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-xs font-black text-red-700 transition-colors hover:bg-red-100"
          >
            <Trash2 size={15} />
            {bulkCopy.delete}
          </button>
        )}
      </div>

      <div className="bg-white rounded-4xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
        {filteredMessages.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <MailOpen size={32} className="text-gray-300" />
            </div>
            <p className="text-sm id-eyebrow">{t("messagesEmpty")}</p>
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
                      <input
                        type="checkbox"
                        checked={selectedIds.has(msg.id)}
                        onChange={() =>
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(msg.id)) next.delete(msg.id);
                            else next.add(msg.id);
                            return next;
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
                        aria-label={`${bulkCopy.selectAll}: ${msg.subject || t("noSubject")}`}
                      />
                      <div className={`mt-1 flex-shrink-0 ${msg.isRead ? "text-gray-400" : "text-orange-600"}`}>
                        {msg.isRead ? <MailOpen size={20} /> : <Mail size={20} className="fill-orange-50" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`text-sm ${msg.isRead ? "font-bold text-gray-900" : "font-black text-gray-900"}`}>
                            {msg.from || t("anonymous")}
                          </span>
                          {!msg.isRead && (
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                          )}
                        </div>
                        <p className={`text-sm truncate ${msg.isRead ? "text-gray-500 font-medium" : "text-gray-900 font-bold"}`}>
                          {msg.subject || t("noSubject")}
                        </p>
                        <p className="text-xs text-gray-400 font-medium mt-1 truncate">
                          {(msg.text || "").substring(0, 100)}...
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-6 md:w-48 flex-shrink-0">
                      <div className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                        <Clock size={12} />
                        {new Date(msg.createdAt).toLocaleDateString(dateLocale, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      
                      <div className="flex items-center gap-2 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        {!msg.isRead && (
                          <button
                            onClick={(e) => handleMarkAsRead(msg.id, e)}
                            disabled={loadingId === msg.id}
                            className="p-2 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                            title={t("messagesMarkAsRead")}
                            // `title` tek başına erişilebilir ad olarak
                            // güvenilmez: dokunmatik cihazda tooltip görünmez ve
                            // ekran okuyucu desteği tutarsızdır (P2-9).
                            aria-label={t("messagesMarkAsRead")}
                          >
                            <MailOpen size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(msg.id, e)}
                          disabled={loadingId === msg.id}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title={t("messagesDelete")}
                          aria-label={t("messagesDelete")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

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
                                  <p className="text-xs text-gray-500 mt-0.5">{t("receiverPrefix")} <span className="font-mono">{msg.to}</span></p>
                                </div>
                                <a
                                  href={`mailto:${encodeURIComponent(msg.from)}?subject=${encodeURIComponent(replySubjectForMailto(msg.subject))}`}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl id-eyebrow hover:bg-orange-600 transition-colors"
                                >
                                  <Reply size={14} /> {t("replyLabel")}
                                </a>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                            <h3 className="text-lg font-black text-gray-900 mb-6 pb-6 border-b border-gray-50 break-words">
                              {msg.subject || t("noSubject")}
                            </h3>
                            <div className="prose prose-sm prose-orange max-w-none prose-p:leading-relaxed text-gray-700 whitespace-pre-wrap">
                              {msg.text || msg.html ? (
                                <>{msg.text || msg.html}</>
                              ) : (
                                <div className="space-y-4">
                                  <span className="italic text-gray-400">{t("contentParseError")}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-6 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col gap-4">
                            <h4 className="text-xs id-eyebrow text-gray-400">
                              {t("repliesTitle")}
                            </h4>

                            {msg.replies.length > 0 && (
                              <ul className="flex flex-col gap-3">
                                {msg.replies.map((r) => (
                                  <li key={r.id} className="rounded-2xl bg-orange-50/60 border border-orange-100 p-4">
                                    <p className="text-xs font-bold text-orange-700 mb-1">
                                      {r.fromEmail} · {new Date(r.createdAt).toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" })}
                                    </p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>
                                  </li>
                                ))}
                              </ul>
                            )}

                            <label htmlFor={`reply-${msg.id}`} className="sr-only">
                              {t("replyPlaceholder")}
                            </label>
                            <textarea
                              id={`reply-${msg.id}`}
                              value={expandedId === msg.id ? replyDraft : ""}
                              onChange={(e) => setReplyDraft(e.target.value)}
                              placeholder={t("replyPlaceholder")}
                              aria-label={t("replyPlaceholder")}
                              rows={4}
                              maxLength={5000}
                              className="ui-field resize-y"
                            />
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-bold text-gray-400">
                                {t("replyFromHint", { address: msg.to })}
                              </p>
                              <button
                                type="button"
                                onClick={() => void handleSendReply(msg.id)}
                                disabled={replySendingId === msg.id || replyDraft.trim().length < 2}
                                className="btn-ui btn-ui-md btn-ui-primary disabled:cursor-not-allowed"
                              >
                                {replySendingId === msg.id ? t("replySending") : t("replySendButton")}
                              </button>
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
