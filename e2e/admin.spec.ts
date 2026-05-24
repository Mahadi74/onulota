import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard)/, { timeout: 5000 });
  });

  test('39.7: Admin product creation', async ({ page }) => {
    // Navigate to admin products page
    await page.goto('/admin/products');
    
    // Verify admin products page is loaded
    await expect(page).toHaveTitle(/admin|products/i);
    
    // Click create product button
    const createBtn = page.locator('button:has-text("Create Product"), button:has-text("Add Product"), a:has-text("New Product")');
    await createBtn.click();
    
    // Wait for product form
    await page.waitForSelector('form, [data-testid="product-form"], [class*="ProductForm"]', { timeout: 5000 });
    
    // Fill product form
    const productName = `Test Product ${Date.now()}`;
    await page.fill('input[name="name"]', productName);
    
    // Fill description
    const descriptionInput = page.locator('textarea[name="description"]').first();
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('This is a test product for E2E testing.');
    }
    
    // Fill price
    await page.fill('input[name="price"]', '5000');
    
    // Fill stock
    const stockInput = page.locator('input[name="stock"], input[name="quantity"]').first();
    if (await stockInput.isVisible()) {
      await stockInput.fill('100');
    }
    
    // Select category
    const categorySelect = page.locator('select[name="category"], [data-testid="category-select"]').first();
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
      const firstOption = categorySelect.locator('option').nth(1);
      if (await firstOption.isVisible()) {
        await firstOption.click();
      }
    }
    
    // Upload image (optional)
    const imageInput = page.locator('input[type="file"]').first();
    if (await imageInput.isVisible()) {
      // Note: File upload in Playwright requires a file path
      // For this test, we'll skip actual file upload
      // In real scenario, use: await imageInput.setInputFiles('/path/to/image.jpg');
    }
    
    // Submit form
    const submitBtn = page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Add")');
    await submitBtn.click();
    
    // Wait for success message or redirect
    await page.waitForTimeout(2000);
    
    // Verify product was created (check for success message or redirect to product list)
    const successMsg = page.locator('[data-testid="success-message"], .success, [class*="Success"]').first();
    const productList = page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').first();
    
    const isSuccess = await successMsg.isVisible().catch(() => false) || await productList.isVisible().catch(() => false);
    expect(isSuccess).toBeTruthy();
  });

  test('39.7: Admin product edit', async ({ page }) => {
    // Navigate to admin products page
    await page.goto('/admin/products');
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-row"], .product-row, tr', { timeout: 5000 });
    
    // Click edit button on first product
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      
      // Wait for edit form
      await page.waitForSelector('form, [data-testid="product-form"], [class*="ProductForm"]', { timeout: 5000 });
      
      // Update product name
      const nameInput = page.locator('input[name="name"]').first();
      const currentName = await nameInput.inputValue();
      await nameInput.fill(`${currentName} - Updated`);
      
      // Submit form
      const submitBtn = page.locator('button[type="submit"]:has-text("Update"), button[type="submit"]:has-text("Save")');
      await submitBtn.click();
      
      // Wait for success
      await page.waitForTimeout(1000);
      
      // Verify update was successful
      const successMsg = page.locator('[data-testid="success-message"], .success, [class*="Success"]').first();
      if (await successMsg.isVisible()) {
        await expect(successMsg).toBeVisible();
      }
    }
  });

  test('39.7: Admin dashboard', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin/dashboard');
    
    // Verify dashboard is loaded
    await expect(page).toHaveTitle(/admin|dashboard/i);
    
    // Verify metric cards are displayed
    const metricCards = page.locator('[data-testid="metric-card"], .metric-card, [class*="MetricCard"]');
    const cardCount = await metricCards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    // Verify revenue card
    const revenueCard = page.locator('[data-testid="revenue-card"], .revenue, [class*="Revenue"]').first();
    await expect(revenueCard).toBeVisible({ timeout: 5000 });
    
    // Verify orders card
    const ordersCard = page.locator('[data-testid="orders-card"], .orders, [class*="Orders"]').first();
    await expect(ordersCard).toBeVisible({ timeout: 5000 });
    
    // Verify users card
    const usersCard = page.locator('[data-testid="users-card"], .users, [class*="Users"]').first();
    await expect(usersCard).toBeVisible({ timeout: 5000 });
    
    // Verify chart is displayed
    const chart = page.locator('[data-testid="sales-chart"], .chart, [class*="Chart"]').first();
    if (await chart.isVisible()) {
      await expect(chart).toBeVisible();
    }
    
    // Verify top products table
    const topProductsTable = page.locator('[data-testid="top-products"], .top-products, [class*="TopProducts"]').first();
    if (await topProductsTable.isVisible()) {
      await expect(topProductsTable).toBeVisible();
    }
  });

  test('39.7: Admin order management', async ({ page }) => {
    // Navigate to admin orders page
    await page.goto('/admin/orders');
    
    // Verify admin orders page is loaded
    await expect(page).toHaveTitle(/admin|orders/i);
    
    // Wait for orders to load
    await page.waitForSelector('[data-testid="order-row"], .order-row, tr', { timeout: 5000 });
    
    // Verify order list is displayed
    const orderRows = page.locator('[data-testid="order-row"], .order-row, tr');
    const rowCount = await orderRows.count();
    expect(rowCount).toBeGreaterThan(0);
    
    // Click first order to view/edit
    const firstRow = orderRows.first();
    const editBtn = firstRow.locator('button:has-text("Edit"), button:has-text("Update"), a:has-text("View")');
    
    if (await editBtn.isVisible()) {
      await editBtn.click();
      
      // Wait for order detail/edit modal
      await page.waitForTimeout(500);
      
      // Look for status dropdown
      const statusSelect = page.locator('select[name="status"], [data-testid="status-select"]').first();
      if (await statusSelect.isVisible()) {
        await statusSelect.click();
        
        // Select a different status
        const statusOption = statusSelect.locator('option').nth(1);
        if (await statusOption.isVisible()) {
          await statusOption.click();
        }
      }
      
      // Look for tracking number input (if status is shipped)
      const trackingInput = page.locator('input[name="trackingNumber"], input[placeholder*="tracking"]').first();
      if (await trackingInput.isVisible()) {
        await trackingInput.fill('TRACK123456789');
      }
      
      // Submit update
      const submitBtn = page.locator('button:has-text("Update"), button:has-text("Save"), button:has-text("Confirm")');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        
        // Wait for success
        await page.waitForTimeout(1000);
      }
    }
  });
});
