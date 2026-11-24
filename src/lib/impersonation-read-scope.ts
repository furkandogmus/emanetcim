import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Web "olarak goruntule" sirasinda server action'lar varsayilan olarak KIMLIKSIZ calisir
 * (oturum callback'i kullaniciyi bosaltir): yeni bir yazma action'i kendiliginden kapali
 * dogar. Yalniz bu kapsamla sarilan salt okuma action'lari hedefin kimligini gorur.
 * Liste `impersonation-action-guard.test.ts`te sabit; eklemek bilincli bir karar.
 */
const scope = new AsyncLocalStorage<true>();

export function asImpersonationRead<T>(fn: () => Promise<T>): Promise<T> {
  return scope.run(true, fn);
}

export function inImpersonationReadScope(): boolean {
  return scope.getStore() === true;
}
