/**
 * Modal açıkken arka planı `inert` yapar. Tab tuzağı yalnızca klavye odağını
 * tutar; VoiceOver'ın sanal imleci DOM'u okur ve modal açıkken arka plandaki
 * düğmelere geçip onları etkinleştirebiliyordu (`aria-modal`ı Safari tutarlı
 * uygulamıyor).
 *
 * `<main>`e doğrudan `inert` konmaz: modalların çoğu portal kullanmıyor,
 * `<main>` içinde çiziliyor ve kendisi de kilitlenirdi. Bunun yerine `body`den
 * modal köküne inen yolun DIŞINDAKİ kardeşler `inert` yapılır.
 *  - Kök, modalın KENDİ verdiği düğümdür (ref). DOM'dan tahmin edilmez:
 *    `[role="dialog"]` taşıyan başka bir öğe (eski PWA şeridi) kök sanılınca
 *    modalın kendisi `inert` oluyordu.
 *  - Yalnızca en üstteki modal etkileşimli; arka plan SON modal kapanınca açılır.
 *    `inert: false` girdiler (açılır takvim) arka planı kilitlemez ama
 *    alttaki bir modalın kilidinden muaf tutulur.
 *  - Başkasının `inert`ine (kapalı `BottomSheet`) dokunulmaz, kaldırılmaz.
 *  - Yalnızca sonner'ın bildirim kabı açık kalır; modal açıkken çıkan bildirim okunmalı.
 */

type Entry = { id: number; node: HTMLElement | null; inert: boolean };

const stack: Entry[] = [];
/** YALNIZCA bizim koyduğumuz `inert`ler -- kaldırırken başkasınınkine dokunmamak için. */
const ours = new Set<Element>();
let observer: MutationObserver | null = null;
let nextId = 1;

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE", "NOSCRIPT"]);
/** sonner `<Toaster>`ın kabı; uygulamada `aria-live` taşıyan başka `section` yok. */
const TOAST_REGION = "section[aria-live]";

function insideOurs(node: Node): boolean {
  for (let n: Node | null = node; n; n = n.parentNode) {
    if (n instanceof Element && ours.has(n)) return true;
  }
  return false;
}

/** Kilidi kuran en üstteki modal ve onun üstünde açık duran (kilitlemeyen) düğümler. */
function activeRoots(): HTMLElement[] | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    const e = stack[i];
    if (!e.inert || !e.node?.isConnected) continue;
    const above = stack
      .slice(i + 1)
      .map((x) => x.node)
      .filter((n): n is HTMLElement => !!n?.isConnected);
    return [e.node, ...above];
  }
  return null;
}

function release(): void {
  for (const el of ours) el.removeAttribute("inert");
  ours.clear();
}

function apply(): void {
  const roots = activeRoots();
  if (!roots) return;
  const keep: Element[] = [...roots];
  for (const toast of document.querySelectorAll(TOAST_REGION)) {
    if (!roots.some((r) => r.contains(toast))) keep.push(toast);
  }

  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (SKIP_TAGS.has(child.tagName)) continue;
      if (keep.includes(child)) continue;
      if (keep.some((k) => child.contains(k))) {
        walk(child);
        continue;
      }
      if (child.hasAttribute("inert")) continue; // başkasının; dokunma
      child.setAttribute("inert", "");
      ours.add(child);
    }
  };
  walk(document.body);
}

function recompute(): void {
  release();
  apply();
}

function ensureObserver(): void {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver((records) => {
    const roots = activeRoots() ?? [];
    // Eklenen VE kaldırılan düğüm: kapanan bir öğe kilidin şeklini de değiştirir.
    const relevant = records.some(
      (r) =>
        (r.addedNodes.length > 0 || r.removedNodes.length > 0) &&
        !roots.some((root) => root.contains(r.target)) &&
        !insideOurs(r.target),
    );
    if (relevant) recompute();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/** Modalı yığına iter. Düğüm henüz yoksa (`null`) kilit, `setModalNode` ile kurulur. */
export function pushModal(opts: { node: HTMLElement | null; inert: boolean }): number {
  const id = nextId++;
  stack.push({ id, ...opts });
  ensureObserver();
  recompute();
  return id;
}

/** Modalın kökü bağlandı ya da yeniden bağlandı (remount). */
export function setModalNode(id: number, node: HTMLElement | null): void {
  const e = stack.find((x) => x.id === id);
  if (!e || e.node === node) return;
  e.node = node;
  recompute();
}

/** Modalı yığından çıkarır; başka modal kalmadıysa bütün `inert`leri kaldırır. */
export function popModal(id: number): void {
  const i = stack.findIndex((e) => e.id === id);
  if (i !== -1) stack.splice(i, 1);
  recompute();
  if (stack.length === 0) {
    observer?.disconnect();
    observer = null;
  }
}

export function isTopModal(id: number): boolean {
  return stack.length > 0 && stack[stack.length - 1].id === id;
}

export function modalNode(id: number): HTMLElement | null {
  return stack.find((e) => e.id === id)?.node ?? null;
}
