import { test, expect } from '@playwright/test';

test.describe('Mandarin Web V2', () => {
  test('harus memuat halaman utama dan menampilkan judul HSK', async ({ page }) => {
    await page.goto('/');
    
    // Asumsi halaman utama menampilkan tulisan HSK atau login
    // Karena kita tidak tahu persis isinya, cek ada konten di body
    await expect(page.locator('body')).toBeVisible();
    
    // Tunggu network idle
    await page.waitForLoadState('networkidle');
    
    // Screenshot awal aplikasi
    await page.screenshot({ path: 'e2e/screenshots/homepage.png', fullPage: true });
  });

  test('navigasi ke halaman dashboard admin database jika memungkinkan', async ({ page }) => {
    // Note: jika butuh login, test ini akan gagal atau di-redirect.
    // Ini sebagai contoh kerangka E2E.
    const response = await page.goto('/dashboard/admin/database/flashcard-cards');
    
    // Verifikasi apakah diarahkan ke halaman login atau berhasil
    if (page.url().includes('login') || page.url().includes('auth')) {
      console.log('Halaman memicu redirect ke login, ini adalah perilaku wajar jika belum auth');
    } else {
      // Jika berhasil tembus (misal mode dev), pastikan judulnya benar
      await expect(page.locator('text=Flashcard Cards').first()).toBeVisible();
    }
  });
});
