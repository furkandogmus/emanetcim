/**
 * Modal açıkken arka planı `inert` yapar. Tab tuzağı yalnızca klavye odağını
 * tutar; VoiceOver'ın sanal imleci DOM'u okur ve modal açıkken arka plandaki
 * düğmelere geçip onları etkinleştirebiliyordu (`aria-modal`ı Safari tutarlı
 * uygulamıyor).
 *
 * `<main>`e doğrudan `inert` konmaz: modalların çoğu portal kullanmıyor,
 * `<main>` içinde çiziliyor ve kendisi de kilitlenirdi. Bunun yerine `body`den
 * modal köküne inen yolun DIŞINDAKİ kardeşler `inert` yapılır.
 *  - Yalnızca en üstteki modal etkileşimli; arka plan SON modal kapanınca açılır.
 *  - Başkasının `inert`ine (kapalı `BottomSheet`) dokunulmaz, kaldırılmaz.
 *  - Canlı bölgeler (sonner bildirimleri) açık kalır.
 *  - `[data-modal-root]` kökü genişletir: `BottomSheet`in karartması diyaloğun
 *    kardeşi; `inert` olsaydı dışarı tıklama kapatmazdı.
 */

type Entry = { id: number; dialog: HTMLElement | null };

const stack: Entry[] = [];
/** YALNIZCA bizim koyduğumuz `inert`ler -- kaldırırken başkasınınkine dokunmamak için. */
const ours = new Set<Element>();
let observer: MutationObserver | null = null;
let nextId = 1;

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE", "NOSCRIPT"]);
const LIVE_REGION = '[aria-live], [role="status"], [role="alert"], [role="log"]';

/** Modalın etkileşimli kalan kökü: işaretli bir kapsayıcı varsa o, yoksa diyaloğun kendisi. */
export function modalRoot(dialog: HTMLElement): HTMLElement {
  return dialog.closest<HTMLElement>("[data-modal-root]") ?? dialog;
}

/** Öğe ya da atalarından biri, BİZİM koymadığımız bir `inert` taşıyor mu? */
function hasForeignInert(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (n.hasAttribute("inert") && !ours.has(n)) return true;
  }
  return false;
}

function insideOurs(node: Node): boolean {
  for (let n: Node | null = node; n; n = n.parentNode) {
    if (n instanceof Element && ours.has(n)) return true;
  }
  return false;
}

function topDialog(): HTMLElement | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    const d = stack[i].dialog;
    if (d && d.isConnected) return d;
  }
  return null;
}

function release(): void {
  for (const el of ours) el.removeAttribute("inert");
  ours.clear();
}

function apply(): void {
  const top = topDialog();
  if (!top || typeof document === "undefined") return;
  const root = modalRoot(top);
  const keep: Element[] = [root];
  for (const live of document.querySelectorAll(LIVE_REGION)) {
    if (!root.contains(live)) keep.push(live);
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
    const top = topDialog();
    if (!top) return;
    const root = modalRoot(top);
    const relevant = records.some(
      (r) =>
        r.addedNodes.length > 0 &&
        !root.contains(r.target) &&
        !insideOurs(r.target),
    );
    if (relevant) recompute();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Yeni açılan modalın diyaloğunu bulur: yığında henüz OLMAYAN, başkasının
 * `inert`i altında DURMAYAN son `[role="dialog"]`. Bizim `inert`imiz altında
 * durabilir -- dıştaki modal açıkken içteki, sayfa gövdesinde çizilmiş olabilir.
 */
export function resolveNewDialog(): HTMLElement | null {
  const known = new Set(stack.map((e) => e.dialog));
  const all = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
  const candidates = all.filter((d) => !known.has(d) && !hasForeignInert(d));
  return candidates[candidates.length - 1] ?? null;
}

/** Modalı yığına iter ve arka planı `inert` yapar. Dönen kimlik `popModal`a verilir. */
export function pushModal(dialog: HTMLElement | null): number {
  const id = nextId++;
  stack.push({ id, dialog });
  ensureObserver();
  recompute();
  return id;
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

export function modalDialog(id: number): HTMLElement | null {
  return stack.find((e) => e.id === id)?.dialog ?? null;
}
