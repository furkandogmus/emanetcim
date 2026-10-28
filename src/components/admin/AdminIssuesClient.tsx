"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type {
  TeamIssueDto,
  TeamIssueEventDto,
  TeamIssueUser,
} from "@/services/TeamIssueService";
import styles from "./AdminIssuesClient.module.css";

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };

type PendingPhoto = {
  key: string;
  src: string;
  pending: true;
  file: File;
};

type DisplayPhoto = {
  key: string;
  src: string;
  pending: boolean;
  file?: File;
};

interface AdminIssuesClientProps {
  initialIssues: TeamIssueDto[];
}

function initials(user: string): string {
  return user === "Furkan" ? "F" : "B";
}

function parseDate(value?: string | null): Date {
  if (!value) return new Date();
  return new Date(String(value).replace(" ", "T"));
}

function formatIssueDate(value?: string | null, includeTime = true): string {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(
    "tr-TR",
    includeTime
      ? {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Istanbul",
        }
      : {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Europe/Istanbul",
        },
  ).format(date);
}

function paintStrokes(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  strokes: Stroke[],
) {
  context.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    context.beginPath();
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = Math.max(2, Math.min(width, height) * 0.009);
    context.lineCap = "round";
    context.lineJoin = "round";
    const first = stroke.points[0];
    context.moveTo(first.x * width, first.y * height);
    if (stroke.points.length === 1) {
      context.arc(
        first.x * width,
        first.y * height,
        context.lineWidth / 2,
        0,
        Math.PI * 2,
      );
      context.fill();
    } else {
      for (const point of stroke.points.slice(1)) {
        context.lineTo(point.x * width, point.y * height);
      }
      context.stroke();
    }
  }
}

export default function AdminIssuesClient({
  initialIssues,
}: AdminIssuesClientProps) {
  const t = useTranslations("AdminIssues");

  const [user, setUser] = useState<TeamIssueUser | null>(null);
  const [issues, setIssues] = useState<TeamIssueDto[]>(initialIssues);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [currentIssueId, setCurrentIssueId] = useState<number | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [activePhotoKey, setActivePhotoKey] = useState<string | null>(null);
  const [photoAnnotations, setPhotoAnnotations] = useState<
    Record<string, Stroke[]>
  >({});
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawColor, setDrawColor] = useState("#e24f4a");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingSave, setSubmittingSave] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const strokesRef = useRef<Stroke[]>(strokes);
  strokesRef.current = strokes;

  const showToastMessage = useCallback((message: string, isError = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, isError });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("bagajpark-user");
    if (saved === "Berat" || saved === "Furkan") {
      setUser(saved);
    }
  }, []);

  const applyUser = (selected: TeamIssueUser) => {
    window.sessionStorage.setItem("bagajpark-user", selected);
    setUser(selected);
  };

  const apiRequest = useCallback(
    async (action: string, options: RequestInit = {}) => {
      const response = await fetch(
        `/api/admin/issues?action=${encodeURIComponent(action)}`,
        options,
      );
      const result = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!response.ok) {
        const serverMsg =
          typeof result.error === "string" &&
          result.error !== "request_failed" &&
          result.error !== "unknown_action"
            ? result.error
            : t("toastErrorGeneric");
        throw new Error(serverMsg);
      }
      return result;
    },
    [t],
  );

  const loadIssues = useCallback(async () => {
    try {
      const result = await apiRequest("list", { method: "GET" });
      if (Array.isArray(result.issues)) {
        setIssues(result.issues as TeamIssueDto[]);
      }
      setLastRefreshTime(
        new Intl.DateTimeFormat("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Istanbul",
        }).format(new Date()),
      );
    } catch (err) {
      showToastMessage(
        err instanceof Error ? err.message : t("toastErrorGeneric"),
        true,
      );
    }
  }, [apiRequest, showToastMessage, t]);

  useEffect(() => {
    if (!user || currentIssueId !== null) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadIssues();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user, currentIssueId, loadIssues]);

  const clearPendingPhotos = useCallback(() => {
    setPendingPhotos((prev) => {
      for (const photo of prev) {
        URL.revokeObjectURL(photo.src);
      }
      return [];
    });
  }, []);

  const currentIssue =
    currentIssueId !== null
      ? issues.find((item) => Number(item.id) === Number(currentIssueId)) ??
        null
      : null;

  const getDisplayPhotos = useCallback(
    (issue: TeamIssueDto | null): DisplayPhoto[] => {
      if (!issue) return [...pendingPhotos];
      const saved: DisplayPhoto[] = (issue.photos ?? []).map((p) => ({
        key: `saved-${p.id}`,
        src: p.image_path,
        pending: false,
      }));
      return [...saved, ...pendingPhotos];
    },
    [pendingPhotos],
  );

  const displayPhotos = getDisplayPhotos(currentIssue);
  const resolvedActiveKey =
    displayPhotos.some((p) => p.key === activePhotoKey)
      ? activePhotoKey
      : (displayPhotos[0]?.key ?? null);
  const activePhoto =
    displayPhotos.find((p) => p.key === resolvedActiveKey) ?? null;

  const resizeAndPaintCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintStrokes(context, bounds.width, bounds.height, strokesRef.current);
  }, []);

  useEffect(() => {
    resizeAndPaintCanvas();
  }, [strokes, activePhoto?.src, resizeAndPaintCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    const observer = new ResizeObserver(() => {
      resizeAndPaintCanvas();
    });
    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [activePhoto?.src, resizeAndPaintCanvas]);

  const addPendingFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter((file) => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          showToastMessage(
            t("toastInvalidType", { name: file.name || "File" }),
            true,
          );
          return false;
        }
        if (file.size > 8 * 1024 * 1024) {
          showToastMessage(t("toastTooLarge", { name: file.name }), true);
          return false;
        }
        return true;
      });
      if (!accepted.length) return;

      if (resolvedActiveKey) {
        setPhotoAnnotations((prev) => ({
          ...prev,
          [resolvedActiveKey]: [...strokesRef.current],
        }));
      }

      const added: PendingPhoto[] = accepted.map((file) => ({
        key: `new-${crypto.randomUUID()}`,
        src: URL.createObjectURL(file),
        pending: true,
        file,
      }));

      setPendingPhotos((prev) => [...prev, ...added]);
      const lastKey = added[added.length - 1].key;
      setActivePhotoKey(lastKey);
      setStrokes([]);
    },
    [resolvedActiveKey, showToastMessage, t],
  );

  useEffect(() => {
    if (currentIssueId === null) return;
    const onPaste = (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      const file = imageItem?.getAsFile();
      if (!file) return;
      event.preventDefault();
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        showToastMessage(t("toastPasteType"), true);
        return;
      }
      const ext =
        file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1] || "png";
      addPendingFiles([
        new File([file], `ekran-goruntusu.${ext}`, { type: file.type }),
      ]);
      showToastMessage(t("toastPasteAdded"));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [currentIssueId, addPendingFiles, showToastMessage, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key === "/" &&
        target &&
        !["INPUT", "TEXTAREA"].includes(target.tagName)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape" && createDialogOpen) {
        setCreateDialogOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [createDialogOpen]);

  const openIssue = async (id: number, sourceList?: TeamIssueDto[]) => {
    clearPendingPhotos();
    const list = sourceList ?? issues;
    const found = list.find((item) => Number(item.id) === Number(id));
    setCurrentIssueId(Number(id));
    setActivePhotoKey(null);
    setPhotoAnnotations({});
    setStrokes([]);
    setDrawingMode(false);
    setDescriptionDraft(found?.description ?? "");
    try {
      await apiRequest("open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, issue_id: id }),
      });
      await loadIssues();
    } catch (err) {
      showToastMessage(
        err instanceof Error ? err.message : t("toastErrorGeneric"),
        true,
      );
    }
  };

  const leaveIssue = async () => {
    if (!currentIssue || !user) {
      setCurrentIssueId(null);
      return;
    }
    let resolveOnExit = false;
    let resolvedSuccessfully = false;
    if (user === "Furkan" && currentIssue.status === "open") {
      resolveOnExit = window.confirm(t("confirmExitResolve"));
    }
    try {
      if (resolveOnExit) {
        await apiRequest("resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user, issue_id: currentIssue.id }),
        });
        resolvedSuccessfully = true;
      }
      await apiRequest("leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, issue_id: currentIssue.id }),
      });
    } catch (err) {
      showToastMessage(
        err instanceof Error ? err.message : t("toastErrorGeneric"),
        true,
      );
    }
    setCurrentIssueId(null);
    clearPendingPhotos();
    setActivePhotoKey(null);
    setPhotoAnnotations({});
    setStrokes([]);
    setDrawingMode(false);
    await loadIssues();
    if (resolvedSuccessfully) {
      showToastMessage(t("toastResolved"));
    }
  };

  const handleSelectPhoto = (key: string) => {
    const nextAnnotations = { ...photoAnnotations };
    if (resolvedActiveKey) {
      nextAnnotations[resolvedActiveKey] = [...strokes];
      setPhotoAnnotations(nextAnnotations);
    }
    setActivePhotoKey(key);
    setStrokes([...(nextAnnotations[key] || [])]);
  };

  const canvasPoint = (
    event: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
  ): Point => {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingMode) return;
    event.preventDefault();
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    const pt = canvasPoint(event, canvas);
    const updated = [...strokes, { color: drawColor, points: [pt] }];
    setStrokes(updated);
    if (resolvedActiveKey) {
      setPhotoAnnotations((prev) => ({ ...prev, [resolvedActiveKey]: updated }));
    }
  };

  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    event.preventDefault();
    const pt = canvasPoint(event, event.currentTarget);
    const updated = strokes.map((s, idx) =>
      idx === strokes.length - 1 ? { ...s, points: [...s.points, pt] } : s,
    );
    setStrokes(updated);
    if (resolvedActiveKey) {
      setPhotoAnnotations((prev) => ({ ...prev, [resolvedActiveKey]: updated }));
    }
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const clearDrawing = () => {
    setStrokes([]);
    if (resolvedActiveKey) {
      setPhotoAnnotations((prev) => ({ ...prev, [resolvedActiveKey]: [] }));
    }
  };

  const createAnnotatedPhoto = async (
    photo: DisplayPhoto,
    annotationsMap: Record<string, Stroke[]>,
  ): Promise<File | null> => {
    const photoStrokes = annotationsMap[photo.key] || [];
    if (!photoStrokes.length) return photo.file || null;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = photo.src;
    if (!image.complete || !image.naturalWidth) {
      await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
      });
    }
    const output = document.createElement("canvas");
    output.width = image.naturalWidth;
    output.height = image.naturalHeight;
    const context = output.getContext("2d");
    if (!context) throw new Error(t("toastAnnotationError"));
    context.drawImage(image, 0, 0);
    paintStrokes(context, output.width, output.height, photoStrokes);
    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error(t("toastAnnotationError"));
    const safeName = photo.file?.name
      ? `isaretli-${photo.file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`
      : "bagajpark-isaretli.png";
    return new File([blob], safeName, { type: "image/png" });
  };

  const handleSaveDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentIssue || !user) return;

    const mergedAnnotations: Record<string, Stroke[]> = {
      ...photoAnnotations,
      ...(resolvedActiveKey ? { [resolvedActiveKey]: [...strokes] } : {}),
    };

    setSubmittingSave(true);
    try {
      const body = new FormData();
      body.set("user", user);
      body.set("issue_id", String(currentIssue.id));
      body.set("description", descriptionDraft);

      for (const photo of displayPhotos) {
        const annotations = mergedAnnotations[photo.key] || [];
        if (!photo.pending && !annotations.length) continue;
        const file = await createAnnotatedPhoto(photo, mergedAnnotations);
        if (file) {
          body.append("photos[]", file, file.name || "bagajpark-fotograf.png");
        }
      }

      const result = await apiRequest("save-details", {
        method: "POST",
        body,
      });
      const addedCount = Number(result.photos_added ?? 0);
      showToastMessage(
        addedCount > 0
          ? t("toastPhotosAdded", { count: addedCount })
          : t("toastDetailsSaved"),
      );
      clearPendingPhotos();
      setActivePhotoKey(null);
      setPhotoAnnotations({});
      setStrokes([]);
      setDrawingMode(false);
      await loadIssues();
    } catch (err) {
      showToastMessage(
        err instanceof Error ? err.message : t("toastErrorGeneric"),
        true,
      );
    } finally {
      setSubmittingSave(false);
    }
  };

  const handleUpdateStatus = async (action: "resolve" | "reopen") => {
    if (!currentIssue || !user) return;
    try {
      await apiRequest(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, issue_id: currentIssue.id }),
      });
      showToastMessage(
        action === "resolve" ? t("toastResolved") : t("toastReopened"),
      );
      await loadIssues();
    } catch (err) {
      showToastMessage(
        err instanceof Error ? err.message : t("toastErrorGeneric"),
        true,
      );
    }
  };

  const handleDeleteIssue = async (issue: TeamIssueDto) => {
    if (!user) return;
    if (!window.confirm(t("confirmDelete", { title: issue.title }))) return;
    setDeletingId(issue.id);
    try {
      await apiRequest("delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, issue_id: issue.id }),
      });
      showToastMessage(t("toastDeleted"));
      await loadIssues();
    } catch (err) {
      showToastMessage(
        err instanceof Error ? err.message : t("toastErrorGeneric"),
        true,
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const title = newTitle.trim();
    if (!title) return;
    setSubmittingCreate(true);
    try {
      const result = await apiRequest("create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, title }),
      });
      setNewTitle("");
      setCreateDialogOpen(false);
      const updatedRes = await apiRequest("list", { method: "GET" });
      const nextList = Array.isArray(updatedRes.issues)
        ? (updatedRes.issues as TeamIssueDto[])
        : issues;
      setIssues(nextList);
      if (typeof result.id === "number") {
        await openIssue(result.id, nextList);
      }
    } catch (err) {
      showToastMessage(
        err instanceof Error ? err.message : t("toastErrorGeneric"),
        true,
      );
    } finally {
      setSubmittingCreate(false);
    }
  };

  const eventDescription = (event: TeamIssueEventDto): string => {
    switch (event.action) {
      case "created":
        return t("eventCreated");
      case "opened":
        return t("eventOpened");
      case "left":
        return t("eventLeft");
      case "resolved":
        return t("eventResolved");
      case "reopened":
        return t("eventReopened");
      case "details_saved":
        return t("eventDetailsSaved");
      default:
        return t("eventDefault");
    }
  };

  const openCount = issues.filter((item) => item.status === "open").length;
  const resolvedCount = issues.length - openCount;
  const filteredIssues = issues.filter((issue) => {
    const matchesStatus = filter === "all" || issue.status === filter;
    const haystack =
      `${issue.title} ${issue.description || ""} ${issue.created_by}`.toLocaleLowerCase(
        "tr-TR",
      );
    const matchesSearch = haystack.includes(search.toLocaleLowerCase("tr-TR"));
    return matchesStatus && matchesSearch;
  });

  const todayFormatted = new Intl.DateTimeFormat("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date());

  if (!user) {
    return (
      <div className={styles.root}>
        <section
          className={styles.welcomeScreen}
          aria-labelledby="welcomeTitle"
        >
          <div className={styles.welcomeMark} aria-hidden="true">
            <span>bp</span>
            <i />
          </div>
          <p className={styles.eyebrow}>{t("eyebrowTeamArea")}</p>
          <h1 id="welcomeTitle" className={styles.welcomeTitle}>
            {t("welcomeTitle")}
          </h1>
          <p className={styles.welcomeCopy}>{t("welcomeCopy")}</p>
          <div className={styles.userChoices}>
            <button
              className={styles.userChoice}
              type="button"
              onClick={() => applyUser("Berat")}
            >
              <span className={styles.avatar}>B</span>
              <span>Berat</span>
              <span className={styles.choiceArrow} aria-hidden="true">
                ↗
              </span>
            </button>
            <button
              className={styles.userChoice}
              type="button"
              onClick={() => applyUser("Furkan")}
            >
              <span className={`${styles.avatar} ${styles.avatarFurkan}`}>
                F
              </span>
              <span>Furkan</span>
              <span className={styles.choiceArrow} aria-hidden="true">
                ↗
              </span>
            </button>
          </div>
          <p className={styles.welcomeFoot}>{t("welcomeFoot")}</p>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <Link className={styles.brand} href="/admin">
            <span className={styles.brandMark}>
              bp
              <i />
            </span>
            <span className={styles.brandName}>
              bagaj<span>park</span>
            </span>
          </Link>
          <div className={styles.sidebarLabel}>{t("sidebarLabel")}</div>
          <button
            className={`${styles.sideLink} ${styles.sideLinkActive}`}
            type="button"
            onClick={() => {
              if (currentIssueId !== null) void leaveIssue();
            }}
          >
            <span className={styles.sideIcon}>▤</span> {t("issuesNav")}
            <span className={styles.sideCount}>{openCount}</span>
          </button>
          <Link className={styles.sideLink} href="/admin">
            <span className={styles.sideIcon}>←</span> {t("backToAdmin")}
          </Link>
          <div className={styles.sidebarBottom}>
            <div className={styles.sidebarNote}>
              <span className={styles.liveDot} />
              <span>{t("twoPersonNote")}</span>
            </div>
            <div className={styles.profileRow}>
              <span
                className={`${styles.avatar} ${
                  user === "Furkan" ? styles.avatarFurkan : ""
                }`}
              >
                {initials(user)}
              </span>
              <span className={styles.profileName}>{user}</span>
              <button
                className={styles.textButton}
                type="button"
                onClick={async () => {
                  if (currentIssueId !== null) await leaveIssue();
                  window.sessionStorage.removeItem("bagajpark-user");
                  setUser(null);
                  setCurrentIssueId(null);
                }}
              >
                {t("switchUser")}
              </button>
            </div>
          </div>
        </aside>

        <main className={styles.mainContent}>
          <header className={styles.topbar}>
            <div className={styles.breadcrumb}>
              <span>{t("workspaceCrumb")}</span>
              <span className={styles.crumbSlash}>/</span>
              <strong>
                {currentIssue
                  ? t("detailCrumb")
                  : t("issuesCrumb")}
              </strong>
            </div>
            <div className={styles.topbarRight}>
              <span className={styles.todayLabel}>{todayFormatted}</span>
              <span
                className={`${styles.topAvatar} ${
                  user === "Furkan" ? styles.avatarFurkan : ""
                }`}
              >
                {initials(user)}
              </span>
            </div>
          </header>

          {!currentIssue ? (
            <section className={styles.pageView}>
              <div className={styles.pageHeading}>
                <div>
                  <p className={styles.eyebrow}>{t("eyebrowProductTeam")}</p>
                  <h1>{t("pageTitle")}</h1>
                  <p className={styles.pageSubtitle}>{t("pageSubtitle")}</p>
                </div>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => {
                    setCreateDialogOpen(true);
                    setTimeout(() => createInputRef.current?.focus(), 20);
                  }}
                >
                  <span aria-hidden="true">＋</span> {t("newIssueButton")}
                </button>
              </div>

              <div className={styles.statsRow}>
                <div className={styles.statItem}>
                  <span className={styles.statNumber}>{openCount}</span>
                  <span className={styles.statLabel}>{t("statOpen")}</span>
                </div>
                <span className={styles.statDivider} />
                <div className={styles.statItem}>
                  <span className={`${styles.statNumber} ${styles.statBlue}`}>
                    {resolvedCount}
                  </span>
                  <span className={styles.statLabel}>{t("statResolved")}</span>
                </div>
                <span className={styles.statDivider} />
                <div className={styles.statItem}>
                  <span className={styles.statNumber}>{issues.length}</span>
                  <span className={styles.statLabel}>{t("statTotal")}</span>
                </div>
              </div>

              <div className={styles.listToolbar}>
                <div
                  className={styles.filterTabs}
                  role="tablist"
                  aria-label={t("filterAria")}
                >
                  <button
                    className={`${styles.filterTab} ${
                      filter === "all" ? styles.filterTabSelected : ""
                    }`}
                    type="button"
                    onClick={() => setFilter("all")}
                  >
                    {t("filterAll")} <span>{issues.length}</span>
                  </button>
                  <button
                    className={`${styles.filterTab} ${
                      filter === "open" ? styles.filterTabSelected : ""
                    }`}
                    type="button"
                    onClick={() => setFilter("open")}
                  >
                    {t("filterOpen")}
                  </button>
                  <button
                    className={`${styles.filterTab} ${
                      filter === "resolved" ? styles.filterTabSelected : ""
                    }`}
                    type="button"
                    onClick={() => setFilter("resolved")}
                  >
                    {t("filterResolved")}
                  </button>
                </div>
                <label className={styles.searchBox} htmlFor="issueSearchInput">
                  <span aria-hidden="true">⌕</span>
                  <input
                    ref={searchInputRef}
                    id="issueSearchInput"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    aria-label={t("searchPlaceholder")}
                  />
                  <kbd>/</kbd>
                </label>
              </div>

              <div className={styles.issueTable}>
                <div className={styles.tableHeader}>
                  <span>{t("colIssue")}</span>
                  <span>{t("colStatus")}</span>
                  <span>{t("colCreatedBy")}</span>
                  <span>{t("colLastActivity")}</span>
                  <span>{t("colAction")}</span>
                </div>
                <div>
                  {filteredIssues.map((issue) => {
                    const lastEv =
                      issue.events && issue.events.length > 0
                        ? issue.events[issue.events.length - 1]
                        : null;
                    const activity = lastEv
                      ? `${lastEv.user_name} · ${formatIssueDate(lastEv.created_at)}`
                      : formatIssueDate(issue.created_at);
                    const firstPhoto = issue.photos?.[0]?.image_path;

                    return (
                      <div key={issue.id} className={styles.issueRow}>
                        <button
                          className={styles.issueOpen}
                          type="button"
                          onClick={() => void openIssue(issue.id)}
                          aria-label={t("openIssueAria", {
                            title: issue.title,
                          })}
                        >
                          <span className={styles.issueTitleWrap}>
                            <span className={styles.issueThumb}>
                              {firstPhoto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={firstPhoto} alt="" />
                              ) : (
                                <span aria-hidden="true">▧</span>
                              )}
                            </span>
                            <span className={styles.issueTitleBlock}>
                              <span className={styles.issueTitle}>
                                {issue.title}
                              </span>
                              <span className={styles.issueDate}>
                                {formatIssueDate(issue.created_at)}
                              </span>
                            </span>
                          </span>
                        </button>
                        <span
                          className={`${styles.statusPill} ${
                            issue.status === "resolved"
                              ? styles.statusPillResolved
                              : ""
                          }`}
                        >
                          {issue.status === "resolved"
                            ? t("statusResolved")
                            : t("statusOpen")}
                        </span>
                        <span className={styles.rowPerson}>
                          <span
                            className={`${styles.miniAvatar} ${
                              issue.created_by === "Furkan"
                                ? styles.miniAvatarFurkan
                                : ""
                            }`}
                          >
                            {initials(issue.created_by)}
                          </span>
                          {issue.created_by}
                        </span>
                        <span className={styles.rowActivity}>{activity}</span>
                        <button
                          className={styles.deleteIssueButton}
                          type="button"
                          disabled={deletingId === issue.id}
                          onClick={() => void handleDeleteIssue(issue)}
                          aria-label={t("deleteIssueAria", {
                            title: issue.title,
                          })}
                          title={t("deleteIssueTitle")}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M4 6h12M8 6V4h4v2m2 0-.7 10H6.7L6 6m2.5 3v4m3-4v4" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {filteredIssues.length === 0 && (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyMark}>＋</span>
                    <h2>
                      {issues.length === 0
                        ? t("emptyTitle")
                        : t("emptyFilterTitle")}
                    </h2>
                    <p>
                      {issues.length === 0
                        ? t("emptySubtitle")
                        : t("emptyFilterSubtitle")}
                    </p>
                    {issues.length === 0 && (
                      <button
                        className={styles.outlineButton}
                        type="button"
                        onClick={() => {
                          setCreateDialogOpen(true);
                          setTimeout(() => createInputRef.current?.focus(), 20);
                        }}
                      >
                        {t("emptyCreateButton")}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <p className={styles.listFooter}>
                <span className={styles.liveDot} /> {t("syncFooter")}{" "}
                <span className={styles.footerSeparator}>·</span>{" "}
                <span>
                  {lastRefreshTime
                    ? t("lastUpdatedAt", { time: lastRefreshTime })
                    : t("lastUpdatedNow")}
                </span>
              </p>
            </section>
          ) : (
            <section className={`${styles.pageView} ${styles.detailView}`}>
              <button
                className={styles.backButton}
                type="button"
                onClick={() => void leaveIssue()}
              >
                <span aria-hidden="true">←</span> {t("backToList")}
              </button>

              <div className={styles.detailHeading}>
                <div>
                  <p className={styles.eyebrow}>
                    {currentIssue.status === "resolved"
                      ? t("detailEyebrowResolved", { id: currentIssue.id })
                      : t("detailEyebrowOpen", { id: currentIssue.id })}
                  </p>
                  <h1>{currentIssue.title}</h1>
                  <div className={styles.detailMeta}>
                    <span>
                      {t("createdByLabel")}{" "}
                      <strong>{currentIssue.created_by}</strong>
                    </span>
                    <span>{formatIssueDate(currentIssue.created_at)}</span>
                    <span
                      className={`${styles.statusPill} ${
                        currentIssue.status === "resolved"
                          ? styles.statusPillResolved
                          : ""
                      }`}
                    >
                      {currentIssue.status === "resolved"
                        ? t("statusResolved")
                        : t("statusOpen")}
                    </span>
                  </div>
                </div>
                <div className={styles.detailActions}>
                  {currentIssue.status === "resolved" ? (
                    <button
                      className={styles.outlineButton}
                      type="button"
                      onClick={() => void handleUpdateStatus("reopen")}
                    >
                      {t("reopenButton")}
                    </button>
                  ) : (
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={() => void handleUpdateStatus("resolve")}
                    >
                      <span aria-hidden="true">✓</span> {t("resolveButton")}
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailPanel}>
                  <div className={styles.panelHeading}>
                    <h2>{t("detailPanelTitle")}</h2>
                    <span>
                      {pendingPhotos.length > 0
                        ? t("photoCountWithPending", {
                            saved: currentIssue.photos.length,
                            pending: pendingPhotos.length,
                          })
                        : t("photoCountSaved", {
                            saved: currentIssue.photos.length,
                          })}
                    </span>
                  </div>

                  <div className={styles.photoFrame}>
                    {activePhoto ? (
                      <>
                        <div className={styles.photoStage}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            ref={imageRef}
                            src={activePhoto.src}
                            alt={t("photoAlt", { title: currentIssue.title })}
                            onLoad={resizeAndPaintCanvas}
                          />
                          <canvas
                            ref={canvasRef}
                            className={`${styles.annotationCanvas} ${
                              drawingMode ? styles.annotationCanvasDrawing : ""
                            }`}
                            aria-label={t("canvasAria")}
                            onPointerDown={beginStroke}
                            onPointerMove={continueStroke}
                            onPointerUp={finishStroke}
                            onPointerCancel={finishStroke}
                          />
                        </div>
                        {displayPhotos.length > 1 && (
                          <div
                            className={styles.photoGallery}
                            aria-label={t("galleryAria")}
                          >
                            {displayPhotos.map((photo, index) => (
                              <button
                                key={photo.key}
                                className={`${styles.photoThumb} ${
                                  photo.key === activePhoto.key
                                    ? styles.photoThumbActive
                                    : ""
                                }`}
                                type="button"
                                onClick={() => handleSelectPhoto(photo.key)}
                                aria-label={t("photoItemAria", {
                                  index: index + 1,
                                })}
                                aria-pressed={photo.key === activePhoto.key}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo.src} alt="" />
                                {photo.pending && (
                                  <span className={styles.photoNewMark}>
                                    {t("newBadge")}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className={styles.photoEmpty}>
                        <span className={styles.photoSymbol} aria-hidden="true">
                          ▧
                        </span>
                        <strong>{t("photoEmptyTitle")}</strong>
                        <span>{t("photoEmptySubtitle")}</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.annotationTools}>
                    <button
                      className={`${styles.outlineButton} ${styles.drawToggle} ${
                        drawingMode && activePhoto
                          ? styles.drawToggleActive
                          : ""
                      }`}
                      type="button"
                      disabled={!activePhoto}
                      aria-pressed={Boolean(drawingMode && activePhoto)}
                      onClick={() => setDrawingMode((prev) => !prev)}
                    >
                      <span aria-hidden="true">✎</span> {t("drawToggle")}
                    </button>
                    <label
                      className={styles.colorPickerLabel}
                      htmlFor="issueDrawColor"
                    >
                      {t("drawColorLabel")}
                    </label>
                    <input
                      id="issueDrawColor"
                      className={styles.colorPicker}
                      type="color"
                      value={drawColor}
                      onChange={(e) => setDrawColor(e.target.value)}
                      aria-label={t("drawColorLabel")}
                    />
                    <button
                      className={`${styles.textButton} ${styles.clearDrawing}`}
                      type="button"
                      disabled={strokes.length === 0}
                      onClick={clearDrawing}
                    >
                      {t("clearDrawing")}
                    </button>
                    <span className={styles.annotationHint}>
                      {t("annotationHint")}
                    </span>
                  </div>

                  <p
                    className={`${styles.detailDescription} ${
                      currentIssue.description ? "" : styles.detailPlaceholder
                    }`}
                  >
                    {currentIssue.description || t("descriptionPlaceholderText")}
                  </p>

                  <form
                    className={styles.editForm}
                    onSubmit={(e) => void handleSaveDetails(e)}
                  >
                    <label
                      className={styles.fieldLabel}
                      htmlFor="issueDescription"
                    >
                      {t("descriptionLabel")}
                    </label>
                    <textarea
                      className={styles.textareaInput}
                      id="issueDescription"
                      name="description"
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      placeholder={t("descriptionInputPlaceholder")}
                      aria-label={t("descriptionLabel")}
                      required
                    />
                    <div className={styles.uploadControl}>
                      <label
                        className={styles.uploadButton}
                        htmlFor="issuePhotoInput"
                      >
                        <span aria-hidden="true">＋</span> {t("uploadButton")}
                      </label>
                      <input
                        className={styles.uploadInput}
                        id="issuePhotoInput"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        aria-label={t("uploadButton")}
                        onChange={(e) => {
                          const files = Array.from(e.currentTarget.files || []);
                          e.currentTarget.value = "";
                          addPendingFiles(files);
                        }}
                      />
                      <span className={styles.uploadFilename}>
                        {pendingPhotos.length > 0
                          ? t("uploadStatusPending", {
                              count: pendingPhotos.length,
                            })
                          : currentIssue.photos.length > 0
                            ? t("uploadStatusSaved", {
                                count: currentIssue.photos.length,
                              })
                            : t("uploadStatusEmpty")}
                      </span>
                    </div>
                    <div className={styles.formFoot}>
                      <span className={styles.formHint}>{t("formHint")}</span>
                      <button
                        className={`${styles.primaryButton} ${styles.saveButton}`}
                        type="submit"
                        disabled={submittingSave}
                      >
                        {t("saveButton")}
                      </button>
                    </div>
                  </form>
                </div>

                <aside className={styles.detailPanel}>
                  <div className={styles.panelHeading}>
                    <h2>{t("activityTitle")}</h2>
                    <span>
                      {t("activityCount", {
                        count: currentIssue.events.length,
                      })}
                    </span>
                  </div>
                  <div className={styles.timeline}>
                    {currentIssue.events.length > 0 ? (
                      currentIssue.events.map((ev, idx) => (
                        <div key={idx} className={styles.timelineItem}>
                          <span className={styles.timelineDot} aria-hidden="true">
                            {ev.action === "resolved" ? "✓" : "·"}
                          </span>
                          <div>
                            <div className={styles.timelineCopy}>
                              <strong>{ev.user_name}</strong>{" "}
                              {eventDescription(ev)}
                            </div>
                            <div className={styles.timelineTime}>
                              {formatIssueDate(ev.created_at)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className={styles.activityEmpty}>
                        {t("activityEmpty")}
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            </section>
          )}

          {toast && (
            <div
              className={`${styles.toast} ${
                toast.isError ? styles.toastError : ""
              }`}
              role="status"
              aria-live="polite"
            >
              {toast.message}
            </div>
          )}
        </main>
      </div>

      {createDialogOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="createIssueDialogTitle"
        >
          <div className={styles.createDialog}>
            <form onSubmit={(e) => void handleCreateIssue(e)}>
              <div className={styles.dialogTop}>
                <div>
                  <p className={styles.eyebrow}>{t("dialogEyebrow")}</p>
                  <h2 id="createIssueDialogTitle">{t("dialogTitle")}</h2>
                </div>
                <button
                  className={styles.iconButton}
                  type="button"
                  aria-label={t("dialogCloseAria")}
                  onClick={() => setCreateDialogOpen(false)}
                >
                  ×
                </button>
              </div>
              <label className={styles.fieldLabel} htmlFor="issueTitleInput">
                {t("issueTitleLabel")}
              </label>
              <input
                ref={createInputRef}
                className={styles.textInput}
                id="issueTitleInput"
                name="title"
                maxLength={180}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("issueTitlePlaceholder")}
                aria-label={t("issueTitleLabel")}
                required
              />
              <p className={styles.dialogHint}>{t("dialogHint")}</p>
              <div className={styles.dialogActions}>
                <button
                  className={styles.outlineButton}
                  type="button"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  {t("cancelButton")}
                </button>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={submittingCreate}
                >
                  {t("createSubmitButton")} <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
