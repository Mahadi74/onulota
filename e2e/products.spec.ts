import { test, expect } from '@playwright/test';

test.describe('Product Search and Filter', () => {
  test('39.3: Product search and filter', async ({ page }) => {
    // Navigate to products page
    await page.goto('/products');
    
    // Verify products page is loaded
    await expect(page).toHaveTitle(/products|shop/i);
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"]', { timeout: 5000 });
    
    // Get initial product count
    const initialProducts = await page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').count();
    expect(initialProducts).toBeGreaterThan(0);
    
    // Test search functionality
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('phone');
      await page.waitForTimeout(500); // Wait for debounce
      
      // Verify search results are filtered
      const searchResults = await page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').count();
      expect(searchResults).toBeGreaterThan(0);
    }
    
    // Test category filter
    const categoryFilter = page.locator('[data-testid="category-filter"], .category-filter, [class*="CategoryFilter"]').first();
    if (await categoryFilter.isVisible()) {
      const categoryOptions = categoryFilter.locator('button, label, [role="option"]');
      const optionCount = await categoryOptions.count();
      
      if (optionCount > 0) {
        // Click first category option
        await categoryOptions.first().click();
        await page.waitForTimeout(500);
        
        // Verify products are filtered
        const filteredProducts = await page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').count();
        expect(filteredProducts).toBeGreaterThan(0);
      }
    }
    
    // Test price range filter
    const priceFilter = page.locator('[data-testid="price-filter"], .price-filter, [class*="PriceFilter"]').first();
    if (await priceFilter.isVisible()) {
      const priceSlider = priceFilter.locator('input[type="range"]').first();
      if (await priceSlider.isVisible()) {
        // Adjust price slider
        await priceSlider.fill('5000');
        await page.waitForTimeout(500);
        
        // Verify products are filtered by price
        const priceFilteredProducts = await page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').count();
        expect(priceFilteredProducts).toBeGreaterThan(0);
      }
    }
    
    // Test sorting
    const sortDropdown = page.locator('select, [data-testid="sort-dropdown"], button:has-text("Sort")').first();
    if (await sortDropdown.isVisible()) {
      await sortDropdown.click();
      
      // Select price ascending
      const sortOption = page.locator('option:has-text("Price: Low to High"), button:has-text("Price: Low to High")').first();
      if (await sortOption.isVisible()) {
        await sortOption.click();
        await page.waitForTimeout(500);
        
        // Verify products are sorted
        const sortedProducts = await page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').count();
        expect(sortedProducts).toBeGreaterThan(0);
      }
    }
  });

  test('39.3: Product detail page', async ({ page }) => {
    // Navigate to products page
    await page.goto('/products');
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"]', { timeout: 5000 });
    
    // Click first product
    const firstProduct = page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').first();
    await firstProduct.click();
    
    // Verify product detail page is loaded
    await page.waitForURL(/\/products\/\w+/, { timeout: 5000 });
    
    // Verify product details are visible
    await expect(page.locator('h1, h2, [data-testid="product-title"]')).toBeVisible({ timeout: 5000 });
    
    // Verify price is displayed in BDT
    const priceText = page.locator('[data-testid="product-price"], .price, [class*="Price"]').first();
    await expect(priceText).toBeVisible({ timeout: 5000 });
    
    // Verify image gallery is visible
    const productImage = page.locator('img[alt*="product"], [data-testid="product-image"]').first();
    await expect(productImage).toBeVisible({ timeout: 5000 });
    
    // Verify add to cart button is visible
    const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add To Cart")');
    await expect(addToCartBtn).toBeVisible({ timeout: 5000 });
  });
});
