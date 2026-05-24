# Quick Action Plan: Tasks 39-40

## Current Status
- **Task 39 (E2E Tests)**: 0% complete - Not started
- **Task 40 (Performance)**: 71% complete - 5/7 subtasks done

---

## Immediate Actions (Next 30 minutes)

### 1. Add Image Lazy Loading to All Pages
**File**: `/frontend/src/pages/` and `/frontend/src/components/`

**Action**: Add `loading="lazy"` to all `<img>` tags

**Files to Update**:
- [ ] ProductDetailPage.tsx - Product gallery images
- [ ] CategoryProductsPage.tsx - Category product images
- [ ] AdminProductsPage.tsx - Admin product list images
- [ ] OrderDetailPage.tsx - Order item images
- [ ] ProfilePage.tsx - User profile image
- [ ] Any other image components

**Command to Find Images**:
```bash
grep -r "<img" frontend/src --include="*.tsx" | grep -v "loading="
```

---

## Short-term Actions (Next 2-3 hours)

### 2. Run Lighthouse Audit
**Steps**:
1. Build frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Serve the build locally:
   ```bash
   npx serve dist
   ```

3. Open Chrome DevTools → Lighthouse → Generate report

4. Document findings in `/Users/expert/projects/game/ruposhi/LIGHTHOUSE_REPORT.md`

5. Identify top 3 performance bottlenecks

---

## Medium-term Actions (Next 4-6 hours)

### 3. Implement Virtual Scrolling for ProductsPage
**Library**: `react-window` (lightweight, ~15KB)

**Steps**:
1. Install: `npm install react-window`
2. Update ProductsPage to use `FixedSizeList` or `VariableSizeList`
3. Test with 100+ products
4. Measure performance improvement

**File**: `/frontend/src/pages/ProductsPage.tsx`

---

## Long-term Actions (Next 8-10 hours)

### 4. Implement E2E Tests (Task 39)
**Setup**:
1. Install Playwright: `npm install -D @playwright/test`
2. Create `playwright.config.ts`
3. Create `/frontend/e2e/` directory
4. Implement 8 test scenarios

**Test Files to Create**:
- `auth.spec.ts` - Registration and login
- `products.spec.ts` - Search and filter
- `checkout.spec.ts` - Add to cart and checkout
- `orders.spec.ts` - Order history and cancellation
- `reviews.spec.ts` - Submit product review
- `admin.spec.ts` - Admin product creation
- `responsive.spec.ts` - Mobile and desktop viewports

---

## Verification Checklist

### Before Marking Task 40 Complete
- [ ] All `<img>` tags have `loading="lazy"` attribute
- [ ] Lighthouse audit run and documented
- [ ] Mobile score ≥ 80
- [ ] Desktop score ≥ 90
- [ ] Virtual scrolling implemented for ProductsPage
- [ ] No console errors or warnings

### Before Marking Task 39 Complete
- [ ] Playwright installed and configured
- [ ] All 8 E2E tests written
- [ ] All tests passing on Chrome, Firefox, WebKit
- [ ] Mobile viewport (375px) tests passing
- [ ] Desktop viewport (1280px) tests passing
- [ ] CI/CD integration configured

---

## Performance Targets

### Lighthouse Scores
- **Mobile**: ≥ 80 (target: 85+)
- **Desktop**: ≥ 90 (target: 95+)

### Core Web Vitals
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

### Bundle Size
- **Main bundle**: < 150KB (gzipped)
- **Vendor bundle**: < 100KB (gzipped)
- **Total**: < 300KB (gzipped)

---

## Resources

### Documentation
- [React.lazy](https://react.dev/reference/react/lazy)
- [Vite Code Splitting](https://vitejs.dev/guide/features.html#code-splitting)
- [Playwright Testing](https://playwright.dev/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [react-window](https://github.com/bvaughn/react-window)

### Tools
- Chrome DevTools Lighthouse
- Playwright Inspector
- Vite Build Analyzer
- Bundle Analyzer

---

## Success Criteria

### Task 40 Complete When:
✅ All 7 subtasks marked complete
✅ Lighthouse mobile score ≥ 80
✅ All images have lazy loading
✅ Virtual scrolling implemented
✅ No performance regressions

### Task 39 Complete When:
✅ All 8 E2E tests written and passing
✅ Tests cover all critical user flows
✅ Mobile and desktop viewports tested
✅ CI/CD integration working
✅ No flaky tests

---

## Estimated Timeline

| Task | Effort | Status |
|------|--------|--------|
| Image lazy loading | 30 min | Ready |
| Lighthouse audit | 1 hour | Ready |
| Virtual scrolling | 3 hours | Ready |
| E2E test setup | 2 hours | Ready |
| E2E test implementation | 4 hours | Ready |
| **Total** | **10.5 hours** | **Ready to start** |

---

## Notes

- All infrastructure is in place (lazy loading, bundle splitting, caching, indexes)
- Only 2 performance features remain (virtual scrolling, Lighthouse fixes)
- E2E tests are completely new and need to be built from scratch
- Recommend completing Task 40 first (quick wins), then Task 39 (more time-intensive)
