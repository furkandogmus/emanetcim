import { test, expect } from '@playwright/test';

test.describe('BagajPark Core Flows', () => {

  test('should load the landing page and show the hero section', async ({ page }) => {
    // Navigate to TR locale specifically
    await page.goto('/tr');
    
    // Check main title (TR)
    await expect(page.locator('h1')).toContainText('Valizini Güvenle Bırak');
    
    // Check search button visibility
    await expect(page.locator('text=Emanet Noktası Bul').first()).toBeVisible();
  });

  test('should switch language to English', async ({ page }) => {
    await page.goto('/tr');
    
    // Switch to EN
    await page.goto('/en');
    
    // Check main title (EN)
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Drop Your Bags');
  });

  test('should navigate to the search page when clicking the search bar', async ({ page }) => {
    await page.goto('/tr');

    await page.getByRole('button', { name: /Emanet Noktası Bul/i }).click();

    await expect(page).toHaveURL(/\/tr\/search/);
  });

  test('should load the login page', async ({ page }) => {
    await page.goto('/tr/login');
    
    // Check if login buttons are present
    await expect(page.getByRole('button').first()).toBeVisible();
  });


});
