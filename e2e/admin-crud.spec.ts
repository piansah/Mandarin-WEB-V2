import { test, expect } from '@playwright/test';

// Hanya jalankan test ini jika NEXT_PUBLIC_TEST_MODE diset (untuk menghindari merusak prod db)
// Secara umum di pipeline CI kita set ini ke true.

test.describe('Admin CRUD - Word Examples', () => {
  const testWordHanzi = `E2E-Word-${Date.now()}`;
  const testHanzi = '测试';
  const testPinyin = 'ce shi';
  const testArti = 'E2E Test Meaning';
  
  const testArtiEdited = 'E2E Test Meaning Edited';

  test.beforeEach(async ({ page }) => {
    // 1. Kunjungi halaman test login
    await page.goto('/test-login');
    
    // Pastikan halaman login E2E muncul
    const heading = page.locator('h1', { hasText: 'Test Login' });
    await expect(heading).toBeVisible();

    // 2. Login menggunakan user E2E
    await page.fill('#test-email', process.env.E2E_ADMIN_EMAIL || 'testadmin@example.com');
    await page.fill('#test-password', process.env.E2E_ADMIN_PASSWORD || 'testpassword');
    await page.click('#test-submit');

    // Pastikan diarahkan ke dashboard
    await page.waitForURL('**/dashboard**');
  });

  test('harusnya bisa melakukan flow CRUD lengkap di Word Examples', async ({ page }) => {
    // === 1. NAVIGASI ===
    await page.goto('/dashboard/admin/database/word-examples');
    await expect(page.locator('h1', { hasText: 'Word Examples' })).toBeVisible();

    // === 2. CREATE ===
    // Klik tombol Tambah
    await page.click('button:has-text("Tambah")');
    
    // Pastikan modal terbuka
    const modalHeading = page.locator('div[role="dialog"] h2', { hasText: 'Tambah Word Example' });
    await expect(modalHeading).toBeVisible();

    // Isi form
    await page.fill('input[id="word_hanzi"]', testWordHanzi);
    await page.fill('input[id="hanzi"]', testHanzi);
    await page.fill('input[id="pinyin"]', testPinyin);
    await page.fill('input[id="arti"]', testArti);

    // Simpan
    await page.click('div[role="dialog"] button:has-text("Simpan")');
    
    // Pastikan modal tertutup
    await expect(modalHeading).toBeHidden();

    // Cari data yang baru dibuat
    await page.fill('input[placeholder*="Cari kata hanzi"]', testWordHanzi);
    // Beri waktu pencarian berjalan (ada debounce mungkin)
    await page.waitForTimeout(1000); 

    // Pastikan item muncul di tabel
    const row = page.locator('tr', { hasText: testWordHanzi }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('td', { hasText: testArti })).toBeVisible();

    // === 3. UPDATE ===
    // Klik tombol edit di baris tersebut
    await row.locator('button[aria-haspopup="menu"]').click();
    await page.click('[role="menuitem"]:has-text("Edit")');

    const editModalHeading = page.locator('div[role="dialog"] h2', { hasText: 'Edit Word Example' });
    await expect(editModalHeading).toBeVisible();

    // Ubah arti
    await page.fill('input[id="arti"]', testArtiEdited);
    await page.click('div[role="dialog"] button:has-text("Simpan")');

    await expect(editModalHeading).toBeHidden();
    await page.waitForTimeout(1000);

    // Pastikan update tercermin
    await expect(row.locator('td', { hasText: testArtiEdited })).toBeVisible();

    // === 4. DELETE ===
    // Klik tombol hapus
    await row.locator('button[aria-haspopup="menu"]').click();
    await page.click('[role="menuitem"]:has-text("Hapus")');

    // Konfirmasi hapus
    const deleteHeading = page.locator('div[role="alertdialog"] h2', { hasText: 'Apakah anda yakin?' });
    await expect(deleteHeading).toBeVisible();
    await page.click('div[role="alertdialog"] button:has-text("Hapus")');

    await expect(deleteHeading).toBeHidden();
    await page.waitForTimeout(1000);

    // Pastikan item sudah hilang
    await expect(page.locator('tr', { hasText: testWordHanzi })).toHaveCount(0);
  });
});
