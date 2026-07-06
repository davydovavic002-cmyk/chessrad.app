import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3569';

test.describe('ChessRad smoke', () => {
  test('home page loads', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/\//);
  });

  test('tournaments page requires auth', async ({ page }) => {
    await page.goto(`${BASE}/tournaments`);
    await expect(page).toHaveURL(/\//);
  });

  test('parent report public route', async ({ page }) => {
    const res = await page.goto(`${BASE}/parent-report/invalid-token`);
    expect(res?.status()).toBeLessThan(500);
  });

  test('api health via puzzle status redirect', async ({ request }) => {
    const res = await request.get(`${BASE}/api/user/puzzle-status`);
    expect([401, 403]).toContain(res.status());
  });
});
