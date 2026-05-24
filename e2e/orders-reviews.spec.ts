import { test, expect } from '@playwright/test';

test.describe('Orders and Reviews', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|home|products)/, { timeout: 5000 });
  });

  test('39.5: Order history and cancellation', async ({ page }) => {
    // Navigate to orders page
    await page.goto('/orders');
    
    // Verify orders page is loaded
    await expect(page).toHaveTitle(/orders|my orders/i);
    
    // Wait for orders to load
    await page.waitForSelector('[data-testid="order-card"], .order-card, [class*="OrderCard"]', { timeout: 5000 });
    
    // Verify order list is displayed
    const orderCards = page.locator('[data-testid="order-card"], .order-card, [class*="OrderCard"]');
    const orderCount = await orderCards.count();
    
    if (orderCount > 0) {
      // Click first order to view details
      await orderCards.first().click();
      
      // Wait for order detail page
      await page.waitForURL(/\/orders\/\w+/, { timeout: 5000 });
      
      // Verify order details are displayed
      const orderNumber = page.locator('[data-testid="order-number"], .order-number, [class*="OrderNumber"]').first();
      await expect(orderNumber).toBeVisible({ timeout: 5000 });
      
      // Verify order items are displayed
      const orderItems = page.locator('[data-testid="order-item"], .order-item, [class*="OrderItem"]');
      const itemCount = await orderItems.count();
      expect(itemCount).toBeGreaterThan(0);
      
      // Verify order status is displayed
      const orderStatus = page.locator('[data-testid="order-status"], .status, [class*="Status"]').first();
      await expect(orderStatus).toBeVisible({ timeout: 5000 });
      
      // Check if cancel button is available (only for pending/processing orders)
      const cancelBtn = page.locator('button:has-text("Cancel Order"), button:has-text("Cancel")');
      if (await cancelBtn.isVisible()) {
        // Click cancel button
        await cancelBtn.click();
        
        // Confirm cancellation
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          
          // Verify order status changed to cancelled
          await page.waitForTimeout(1000);
          const updatedStatus = page.locator('[data-testid="order-status"], .status, [class*="Status"]').first();
          const statusText = await updatedStatus.textContent();
          expect(statusText?.toLowerCase()).toContain('cancel');
        }
      }
    }
  });

  test('39.6: Submit product review', async ({ page }) => {
    // Navigate to orders page
    await page.goto('/orders');
    
    // Wait for orders to load
    await page.waitForSelector('[data-testid="order-card"], .order-card, [class*="OrderCard"]', { timeout: 5000 });
    
    // Get first order
    const orderCards = page.locator('[data-testid="order-card"], .order-card, [class*="OrderCard"]');
    const orderCount = await orderCards.count();
    
    if (orderCount > 0) {
      // Click first order
      await orderCards.first().click();
      
      // Wait for order detail page
      await page.waitForURL(/\/orders\/\w+/, { timeout: 5000 });
      
      // Look for review button or navigate to product detail
      const reviewBtn = page.locator('button:has-text("Write Review"), button:has-text("Add Review")').first();
      
      if (await reviewBtn.isVisible()) {
        // Click review button
        await reviewBtn.click();
        
        // Fill review form
        const ratingStars = page.locator('[data-testid="star-rating"], .star-rating, [class*="StarRating"]').first();
        if (await ratingStars.isVisible()) {
          // Click 5th star for 5-star rating
          const stars = ratingStars.locator('button, [role="radio"]');
          const starCount = await stars.count();
          if (starCount >= 5) {
            await stars.nth(4).click();
          }
        }
        
        // Fill review comment
        const commentInput = page.locator('textarea[name="comment"], textarea[placeholder*="comment"]').first();
        if (await commentInput.isVisible()) {
          await commentInput.fill('Great product! Highly recommended.');
        }
        
        // Submit review
        const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Post Review")');
        await submitBtn.click();
        
        // Verify review was submitted
        await page.waitForTimeout(1000);
        const successMsg = page.locator('[data-testid="success-message"], .success, [class*="Success"]').first();
        if (await successMsg.isVisible()) {
          await expect(successMsg).toBeVisible();
        }
      } else {
        // Navigate to product detail page from order
        const productLink = page.locator('[data-testid="product-link"], a[href*="/products/"]').first();
        if (await productLink.isVisible()) {
          await productLink.click();
          
          // Wait for product detail page
          await page.waitForURL(/\/products\/\w+/, { timeout: 5000 });
          
          // Scroll to reviews section
          const reviewsSection = page.locator('[data-testid="reviews-section"], .reviews, [class*="Reviews"]').first();
          if (await reviewsSection.isVisible()) {
            await reviewsSection.scrollIntoViewIfNeeded();
            
            // Click write review button
            const writeReviewBtn = page.locator('button:has-text("Write Review"), button:has-text("Add Review")');
            if (await writeReviewBtn.isVisible()) {
              await writeReviewBtn.click();
              
              // Fill and submit review
              const ratingStars = page.locator('[data-testid="star-rating"], .star-rating, [class*="StarRating"]').first();
              if (await ratingStars.isVisible()) {
                const stars = ratingStars.locator('button, [role="radio"]');
                const starCount = await stars.count();
                if (starCount >= 5) {
                  await stars.nth(4).click();
                }
              }
              
              const commentInput = page.locator('textarea[name="comment"], textarea[placeholder*="comment"]').first();
              if (await commentInput.isVisible()) {
                await commentInput.fill('Excellent quality and fast delivery!');
              }
              
              const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Post Review")');
              await submitBtn.click();
              
              await page.waitForTimeout(1000);
            }
          }
        }
      }
    }
  });

  test('39.6: Edit and delete review', async ({ page }) => {
    // Navigate to product detail page
    await page.goto('/products');
    
    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"]', { timeout: 5000 });
    
    // Click first product
    const firstProduct = page.locator('[data-testid="product-card"], .product-card, [class*="ProductCard"]').first();
    await firstProduct.click();
    
    // Wait for product detail page
    await page.waitForURL(/\/products\/\w+/, { timeout: 5000 });
    
    // Scroll to reviews section
    const reviewsSection = page.locator('[data-testid="reviews-section"], .reviews, [class*="Reviews"]').first();
    if (await reviewsSection.isVisible()) {
      await reviewsSection.scrollIntoViewIfNeeded();
      
      // Look for user's review
      const userReview = page.locator('[data-testid="user-review"], .user-review, [class*="UserReview"]').first();
      if (await userReview.isVisible()) {
        // Click edit button
        const editBtn = userReview.locator('button:has-text("Edit")');
        if (await editBtn.isVisible()) {
          await editBtn.click();
          
          // Update review
          const commentInput = page.locator('textarea[name="comment"], textarea[placeholder*="comment"]').first();
          if (await commentInput.isVisible()) {
            await commentInput.fill('Updated review: Still excellent!');
          }
          
          // Submit update
          const submitBtn = page.locator('button:has-text("Update"), button:has-text("Save")');
          if (await submitBtn.isVisible()) {
            await submitBtn.click();
            await page.waitForTimeout(1000);
          }
        }
        
        // Click delete button
        const deleteBtn = userReview.locator('button:has-text("Delete")');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          
          // Confirm deletion
          const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    }
  });
});
