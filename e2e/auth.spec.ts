import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('39.2: User registration and login flow', async ({ page }) => {
    // Navigate to register page
    await page.goto('/register');
    
    // Verify register page is loaded
    await expect(page).toHaveTitle(/register|sign up/i);
    
    // Fill registration form
    const uniqueEmail = `test-${Date.now()}@example.com`;
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
    
    // Submit registration form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to login or dashboard
    await page.waitForURL(/\/(login|dashboard|home)/, { timeout: 5000 });
    
    // If redirected to login, perform login
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      await page.fill('input[name="email"]', uniqueEmail);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      
      // Wait for redirect to dashboard/home
      await page.waitForURL(/\/(dashboard|home|products)/, { timeout: 5000 });
    }
    
    // Verify user is logged in (check for user menu or profile link)
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Profile"), a:has-text("Profile")');
    await expect(userMenu).toBeVisible({ timeout: 5000 });
  });

  test('39.2: User login flow', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Verify login page is loaded
    await expect(page).toHaveTitle(/login|sign in/i);
    
    // Use a test account (should be created by seed script)
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard/home
    await page.waitForURL(/\/(dashboard|home|products)/, { timeout: 5000 });
    
    // Verify user is logged in
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Profile"), a:has-text("Profile")');
    await expect(userMenu).toBeVisible({ timeout: 5000 });
  });

  test('39.2: User logout flow', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|home|products)/, { timeout: 5000 });
    
    // Click user menu
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Profile")').first();
    await userMenu.click();
    
    // Click logout button
    const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout")');
    await logoutBtn.click();
    
    // Verify redirect to login or home
    await page.waitForURL(/\/(login|home)/, { timeout: 5000 });
    
    // Verify user menu is not visible
    await expect(userMenu).not.toBeVisible({ timeout: 5000 });
  });
});
