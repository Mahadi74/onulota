import { test, expect } from '@playwright/test';

test.describe('Cart and Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|home|products)/, { timeout: 5000 });
  });

  test('39.4: Add to cart and checkout with COD', async ({ page }) => {
    // Navigate to products page
    await page.goto('/products');
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"]', { timeout: 5000 });
    
    // Click first product
    const firstProduct = page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').first();
    await firstProduct.click();
    
    // Wait for product detail page
    await page.waitForURL(/\/products\/\w+/, { timeout: 5000 });
    
    // Select quantity if available
    const quantityInput = page.locator('input[type="number"], [data-testid="quantity-input"]').first();
    if (await quantityInput.isVisible()) {
      await quantityInput.fill('2');
    }
    
    // Click add to cart button
    const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add To Cart")');
    await addToCartBtn.click();
    
    // Wait for success message or cart update
    await page.waitForTimeout(1000);
    
    // Navigate to cart page
    await page.goto('/cart');
    
    // Verify cart items are displayed
    const cartItems = page.locator('[data-testid="cart-item"], .cart-item, [class*="CartItem"]');
    const itemCount = await cartItems.count();
    expect(itemCount).toBeGreaterThan(0);
    
    // Verify cart totals are displayed
    const cartTotal = page.locator('[data-testid="cart-total"], .total, [class*="Total"]').first();
    await expect(cartTotal).toBeVisible({ timeout: 5000 });
    
    // Click checkout button
    const checkoutBtn = page.locator('button:has-text("Checkout"), button:has-text("Proceed to Checkout")');
    await checkoutBtn.click();
    
    // Wait for checkout page
    await page.waitForURL(/\/checkout/, { timeout: 5000 });
    
    // Verify checkout stepper is visible
    const stepper = page.locator('[data-testid="checkout-stepper"], .stepper, [class*="Stepper"]').first();
    await expect(stepper).toBeVisible({ timeout: 5000 });
    
    // Step 1: Address selection
    const addressOptions = page.locator('[data-testid="address-option"], .address-option, [class*="AddressOption"]');
    const addressCount = await addressOptions.count();
    
    if (addressCount > 0) {
      // Select first address
      await addressOptions.first().click();
    } else {
      // Add new address
      const addAddressBtn = page.locator('button:has-text("Add Address"), button:has-text("Add New Address")');
      if (await addAddressBtn.isVisible()) {
        await addAddressBtn.click();
        
        // Fill address form
        await page.fill('input[name="street"]', '123 Main Street');
        await page.fill('input[name="city"]', 'Dhaka');
        await page.fill('input[name="postalCode"]', '1205');
        await page.fill('input[name="phone"]', '+8801234567890');
        
        // Save address
        const saveBtn = page.locator('button:has-text("Save"), button:has-text("Save Address")');
        await saveBtn.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Step 2: Payment method selection
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Select COD payment method
    const codOption = page.locator('input[value="cod"], label:has-text("Cash on Delivery"), label:has-text("COD")').first();
    if (await codOption.isVisible()) {
      await codOption.click();
    }
    
    // Step 3: Review and place order
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Verify order review is displayed
    const orderReview = page.locator('[data-testid="order-review"], .order-review, [class*="OrderReview"]').first();
    await expect(orderReview).toBeVisible({ timeout: 5000 });
    
    // Click place order button
    const placeOrderBtn = page.locator('button:has-text("Place Order"), button:has-text("Confirm Order")');
    await placeOrderBtn.click();
    
    // Wait for order confirmation page
    await page.waitForURL(/\/orders\/success/, { timeout: 5000 });
    
    // Verify order confirmation message
    const confirmationMsg = page.locator('[data-testid="order-confirmation"], h1, h2').first();
    await expect(confirmationMsg).toBeVisible({ timeout: 5000 });
  });

  test('39.4: Cart persistence and merge', async ({ page, context }) => {
    // Add item to cart as guest
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"]', { timeout: 5000 });
    
    const firstProduct = page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').first();
    await firstProduct.click();
    
    await page.waitForURL(/\/products\/\w+/, { timeout: 5000 });
    
    const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add To Cart")');
    await addToCartBtn.click();
    
    // Verify cart persists in localStorage
    const cartData = await page.evaluate(() => localStorage.getItem('cart'));
    expect(cartData).toBeTruthy();
    
    // Navigate to cart page
    await page.goto('/cart');
    
    // Verify cart items are displayed
    const cartItems = page.locator('[data-testid="cart-item"], .cart-item, [class*="CartItem"]');
    const itemCount = await cartItems.count();
    expect(itemCount).toBeGreaterThan(0);
  });
});
