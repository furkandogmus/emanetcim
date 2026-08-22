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

  test('PWA: sw.js (Service Worker) should be accessible', async ({ page }) => {
    const response = await page.goto('/sw.js');
    expect(response?.ok()).toBeTruthy();
    expect(response?.headers()['content-type']).toContain('application/javascript');
  });

  test('Metadata: should contain PWA and theme meta tags', async ({ page }) => {
    await page.goto('/tr');
    const themeColor = await page.locator('meta[name="theme-color"]').first().getAttribute('content');
    expect(themeColor).toBe('#ea580c');

    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifest).toBe('/manifest.json');
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

    await expect(page.getByText('Aktif Emanetler', { exact: true })).toBeVisible();
  });

});
