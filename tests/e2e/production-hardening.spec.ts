import { test, expect } from '@playwright/test';

test.describe('BagajPark Production Hardening & PWA E2E Tests', () => {

  // 1. Güvenlik & Middleware (Auth Redirects)
  test('Middleware: should redirect unauthenticated users to login with callbackUrl', async ({ page }) => {
    await page.goto('/tr/admin');

    await expect(page).toHaveURL(/\/tr\/login/);
    const url = page.url();
    expect(url).toContain('callbackUrl=');
    expect(decodeURIComponent(new URL(url).searchParams.get('callbackUrl') || '')).toContain('/tr/admin');

    await expect(page.locator('h1')).toContainText(/Giriş Yap/i);
  });

  test('Middleware: should redirect unauthenticated partner users to login', async ({ page }) => {
    await page.goto('/tr/partner');
    await expect(page).toHaveURL(/\/tr\/login/);
    const url = page.url();
    expect(decodeURIComponent(new URL(url).searchParams.get('callbackUrl') || '')).toContain('/tr/partner');
  });

  // 2. PWA & Infrastructure Assets
  test('PWA: manifest.json should be accessible and correct', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.ok()).toBeTruthy();
    const manifest = await response?.json();
    expect(manifest.short_name).toBe('BagajPark');
  });

  // Dile gore manifest (2026-09-23): kisayollar ve ad ziyaretcinin dilinde.
  test('PWA: locale manifest carries localized shortcuts', async ({ page }) => {
    const response = await page.goto('/manifests/de.webmanifest');
    expect(response?.ok()).toBeTruthy();
    const manifest = await response?.json();
    expect(manifest.lang).toBe('de');
    expect(manifest.id).toBe('/');
    expect(manifest.shortcuts[0].url).toBe('/de/search?utm_source=pwa');
    expect((await page.goto('/manifests/xx.webmanifest'))?.status()).toBe(404);
  });

  // sw.js artık kendini kaldıran statik dosya; erişilebilir olmalı ki eski SW'ler temizlensin.
  test('PWA: sw.js (Service Worker) should be accessible', async ({ page }) => {
    const response = await page.goto('/sw.js');
    expect(response?.ok()).toBeTruthy();
    expect(response?.headers()['content-type']).toContain('application/javascript');
  });

  // Cevrimdisi sayfa (2026-09-23): baglanti yokken tarayici hata sayfasi degil.
  // Config service worker'lari genelde ENGELLIYOR (bayat yanit korkusu); bu
  // test worker'in kendisini sinadigi icin yalnizca burada izinli.
  test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });
  test('PWA: offline navigation shows the offline page', async ({ page, context }) => {
    await page.goto('/tr');
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.register('/push-sw.js');
      await navigator.serviceWorker.ready;
      return reg.active?.state;
    });
    await page.reload(); // worker artik bu sayfayi kontrol ediyor
    await context.setOffline(true);
    await page.goto('/tr/search').catch(() => {});
    await expect(page.locator('#t')).toHaveText('Bağlantı yok');
    await context.setOffline(false);
  });
  });

  test('Metadata: should contain PWA and theme meta tags', async ({ page }) => {
    await page.goto('/tr');
    const themeColor = await page.locator('meta[name="theme-color"]').first().getAttribute('content');
    expect(themeColor).toBe('#ea580c');

    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifest).toBe('/manifests/tr.webmanifest');
  });

  test('i18n: should switch content language correctly', async ({ page }) => {
    // Turkish
    await page.goto('/tr/search');
    await expect(page.getByTestId('nearby-heading').first()).toContainText(/Yakındaki/i);
    
    // English
    await page.goto('/en/search');
    await expect(page.getByTestId('nearby-heading').first()).toContainText(/Nearby/i);
  });

  // 3. Kullanıcı Deneyimi (Custom 404 & i18n)
  test('Error Handling: should show custom 404 page for non-existent routes', async ({ page }) => {
    // Navigate to a definitely non-existent route within the tr locale
    await page.goto('/tr/non-existent-at-all');
    
    // Wait for the text to appear (handling potential async/hydration)
    const heading = page.locator('h1');
    await expect(heading).toContainText(/KAYBOLDUN/i, { timeout: 10000 });
  });

  // 4. Demo Mode Login Akışı
  test('Demo Mode: should login as Esnaf and redirect to partner dashboard', async ({ page }) => {
    await page.goto('/tr/login');

    await page.getByText('Esnaf Girişi').click();

    await expect(page).toHaveURL(/\/tr\/partner/, { timeout: 15000 });

    /*
      METIN DEGIL TESTID. Bu satir eskiden `getByText('Aktif Emanetler')`
      bekliyordu ve 2026-09-01'de KIRILDI: o kart panelden BILEREK kaldirildi
      (ustteki gunluk durum blogu ayni sayiyi farkli birimle gosterdigi icin
      iki rakam birbirini yalanliyordu -- gerekce `PartnerClient.tsx`te).
      Yani test uygulamanin bir hatasini degil, kendi eskimisligini
      raporluyordu.

      `partner-shop-name` panelin baslik `h1`i ve yalnizca dukkan cozuldugunde
      ciziliyor -- yani "esnaf paneline gercekten girildi"nin karsiligi.
      Testid bir SOZLESME; gorunur metin ise urun ekibinin istedigi zaman
      degistirebilecegi bir seydir ve e2e'nin ona baglanmasi bu kirilmanin
      sebebiydi.

      `.first()`: sayfa akisla gelirken ayni baslik kisa sure iki kez DOM'da
      (biri gizli) kaliyor; strict mod bunu ihlal sayip deploy'u kesiyordu.
      Ayni kaypaklik `use-cases.spec.ts`te 2026-08-31'de boyle cozulmustu.
    */
    await expect(page.getByTestId('partner-shop-name').first()).toBeVisible();
  });

});
