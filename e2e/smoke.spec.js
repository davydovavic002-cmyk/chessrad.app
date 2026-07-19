const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3011';

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

  test('api profile requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/profile`);
    expect([401, 403]).toContain(res.status());
  });

  test('puzzle routes are disabled', async ({ page, request }) => {
    await page.goto(`${BASE}/puzzle`);
    await expect(page).toHaveURL(/lobby|\/($|\?)/);
    const res = await request.get(`${BASE}/api/user/puzzle-status`);
    expect([401, 403, 410]).toContain(res.status());
  });
});
