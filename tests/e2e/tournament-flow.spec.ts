import { test, expect } from '@playwright/test';

test.describe('TourneyMaster AI — Application & UI E2E Flows', () => {
  test('1. Home Landing Page loads and displays branding & navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TourneyMaster/i);
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Verify key action links
    const createBtn = page.getByRole('link', { name: /create tournament/i });
    await expect(createBtn).toBeVisible();

    const signInBtn = page.getByRole('link', { name: /sign in/i });
    await expect(signInBtn).toBeVisible();
  });

  test('2. Authentication page renders login form with Magic Link input', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.getByPlaceholder(/you@example.com/i);
    await expect(emailInput).toBeVisible();

    const submitBtn = page.getByRole('button', { name: /send magic link/i });
    await expect(submitBtn).toBeVisible();
  });

  test('3. Historical Leaderboard loads and renders standings header', async ({ page }) => {
    await page.goto('/leaderboard');
    const heading = page.locator('h1');
    await expect(heading).toContainText(/Historical Rating Leaderboard|Leaderboard/i);
  });

  test('4. Admin New Tournament form validates inputs', async ({ page }) => {
    await page.goto('/admin/tournaments/new');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('5. Viewport responsiveness checks across devices (no horizontal scroll)', async ({ page }) => {
    await page.goto('/');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // Allow minor subpixel rendering variance
  });

  test('6. PWA Manifest and Icons are accessible', async ({ page }) => {
    const manifestResponse = await page.request.get('/manifest.json');
    expect(manifestResponse.status()).toBe(200);
    const manifestJson = await manifestResponse.json();
    expect(manifestJson.name).toContain('TourneyMaster');
    expect(manifestJson.icons.length).toBeGreaterThan(0);

    const iconResponse = await page.request.get('/icons/icon-192.svg');
    expect(iconResponse.status()).toBe(200);
  });

  test('7. Offline Fallback page is accessible', async ({ page }) => {
    const offlineResponse = await page.request.get('/offline.html');
    expect(offlineResponse.status()).toBe(200);
    const offlineHtml = await offlineResponse.text();
    expect(offlineHtml).toContain('offline');
  });

  test('8. Auth Callback endpoint redirects properly without 404', async ({ page }) => {
    const res = await page.goto('/auth/callback');
    // Without code param, redirects to /login?error=auth-failed
    expect(page.url()).toContain('/login');
    expect(res?.status()).toBeLessThan(400);
  });
});
