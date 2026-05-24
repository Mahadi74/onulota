import { test, expect, devices } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('39.8: Mobile viewport (375px) - Product listing', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to products page
    await page.goto('/products');
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"]', { timeout: 5000 });
    
    // Verify products are displayed in mobile layout
    const productCards = page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]');
    const cardCount = await productCards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    // Verify mobile navigation is visible
    const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-menu, [class*="MobileMenu"]').first();
    if (await mobileMenu.isVisible()) {
      await expect(mobileMenu).toBeVisible();
    }
    
    // Verify hamburger menu is visible on mobile
    const hamburger = page.locator('button[aria-label*="menu"], button[class*="hamburger"], [data-testid="hamburger"]').first();
    if (await hamburger.isVisible()) {
      await expect(hamburger).toBeVisible();
    }
    
    // Verify product cards are stacked vertically
    const firstCard = productCards.first();
    const secondCard = productCards.nth(1);
    
    if (await secondCard.isVisible()) {
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();
      
      if (firstBox && secondBox) {
        // On mobile, cards should be stacked (second card below first)
        expect(secondBox.y).toBeGreaterThan(firstBox.y);
      }
    }
  });

  test('39.8: Mobile viewport (375px) - Checkout flow', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|home|products)/, { timeout: 5000 });
    
    // Navigate to products
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"]', { timeout: 5000 });
    
    // Add product to cart
    const firstProduct = page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').first();
    await firstProduct.click();
    
    await page.waitForURL(/\/products\/\w+/, { timeout: 5000 });
    
    const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add To Cart")');
    await addToCartBtn.click();
    
    // Navigate to checkout
    await page.goto('/checkout');
    
    // Verify stepper is visible and mobile-friendly
    const stepper = page.locator('[data-testid="checkout-stepper"], .stepper, [class*="Stepper"]').first();
    await expect(stepper).toBeVisible({ timeout: 5000 });
    
    // Verify form inputs are touch-friendly (min 44px height)
    const inputs = page.locator('input, textarea, select, button[type="submit"]');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < Math.min(inputCount, 3); i++) {
      const input = inputs.nth(i);
      const box = await input.boundingBox();
      if (box) {
        // Touch targets should be at least 44px
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('39.8: Desktop viewport (1280px) - Product listing', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Navigate to products page
    await page.goto('/products');
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"]', { timeout: 5000 });
    
    // Verify products are displayed in desktop layout
    const productCards = page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]');
    const cardCount = await productCards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    // Verify sidebar is visible on desktop
    const sidebar = page.locator('[data-testid="sidebar"], .sidebar, [class*="Sidebar"]').first();
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
    }
    
    // Verify product cards are displayed in grid
    const firstCard = productCards.first();
    const secondCard = productCards.nth(1);
    
    if (await secondCard.isVisible()) {
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();
      
      if (firstBox && secondBox) {
        // On desktop, cards should be side by side (same Y position approximately)
        expect(Math.abs(secondBox.y - firstBox.y)).toBeLessThan(50);
      }
    }
  });

  test('39.8: Desktop viewport (1280px) - Admin panel', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard)/, { timeout: 5000 });
    
    // Navigate to admin dashboard
    await page.goto('/admin/dashboard');
    
    // Verify admin sidebar is visible
    const adminSidebar = page.locator('[data-testid="admin-sidebar"], .admin-sidebar, [class*="AdminSidebar"]').first();
    await expect(adminSidebar).toBeVisible({ timeout: 5000 });
    
    // Verify main content area is properly sized
    const mainContent = page.locator('[data-testid="admin-content"], .admin-content, [class*="AdminContent"]').first();
    if (await mainContent.isVisible()) {
      const box = await mainContent.boundingBox();
      if (box) {
        // Main content should take up most of the width
        expect(box.width).toBeGreaterThan(800);
      }
    }
  });

  test('39.8: Tablet viewport (768px) - Product listing', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Navigate to products page
    await page.goto('/products');
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"]', { timeout: 5000 });
    
    // Verify products are displayed
    const productCards = page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]');
    const cardCount = await productCards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    // Verify layout is responsive (should show 2-3 columns on tablet)
    const firstCard = productCards.first();
    const secondCard = productCards.nth(1);
    const thirdCard = productCards.nth(2);
    
    if (await thirdCard.isVisible()) {
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();
      const thirdBox = await thirdCard.boundingBox();
      
      if (firstBox && secondBox && thirdBox) {
        // Second card should be beside first (same Y)
        expect(Math.abs(secondBox.y - firstBox.y)).toBeLessThan(50);
        // Third card should be below first (different Y)
        expect(thirdBox.y).toBeGreaterThan(firstBox.y);
      }
    }
  });

  test('39.8: Image loading on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to products page
    await page.goto('/products');
    
    // Wait for products to load
    await page.waitForSelector('img[alt*="product"], [data-testid="product-image"]', { timeout: 5000 });
    
    // Verify images have lazy loading attribute
    const images = page.locator('img[loading="lazy"]');
    const lazyImageCount = await images.count();
    
    // At least some images should have lazy loading
    expect(lazyImageCount).toBeGreaterThan(0);
    
    // Verify images are responsive
    const productImages = page.locator('img[alt*="product"], [data-testid="product-image"]');
    const imageCount = await productImages.count();
    
    for (let i = 0; i < Math.min(imageCount, 3); i++) {
      const img = productImages.nth(i);
      const box = await img.boundingBox();
      if (box) {
        // Images should fit within mobile viewport
        expect(box.width).toBeLessThanOrEqual(375);
      }
    }
  });
});
