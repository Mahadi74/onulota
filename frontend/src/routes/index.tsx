import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet, RouteObject } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { LoadingSpinner } from '@/components/LoadingSpinner'

// Layout
import { MainLayout } from '@/components/layouts/MainLayout'
import { AdminLayout } from '@/components/AdminLayout'

// Lazy-loaded pages
const HomePage = lazy(() => import('@/pages/HomePage'))
const ProductsPage = lazy(() => import('@/pages/ProductsPage'))
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'))
const CategoryProductsPage = lazy(() => import('@/pages/CategoryProductsPage'))
const CartPage = lazy(() => import('@/pages/CartPage'))
const WishlistPage = lazy(() => import('@/pages/WishlistPage'))
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'))
const OrderSuccessPage = lazy(() => import('@/pages/OrderSuccessPage'))
const OrdersPage = lazy(() => import('@/pages/OrdersPage'))
const OrderDetailPage = lazy(() => import('@/pages/OrderDetailPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage'))
const AdminCategoriesPage = lazy(() => import('@/pages/admin/AdminCategoriesPage'))
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage'))
const AdminOrderDetailPage = lazy(() => import('@/pages/admin/AdminOrderDetailPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminCouponsPage = lazy(() => import('@/pages/admin/AdminCouponsPage'))
const AdminHomepagePage = lazy(() => import('@/pages/admin/AdminHomepagePage'))
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
)

const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <HomePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'products',
        element: (
          <SuspenseWrapper>
            <ProductsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'products/:id',
        element: (
          <SuspenseWrapper>
            <ProductDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'categories',
        element: (
          <SuspenseWrapper>
            <CategoriesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'categories/:slug',
        element: (
          <SuspenseWrapper>
            <CategoryProductsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'cart',
        element: (
          <SuspenseWrapper>
            <CartPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'wishlist',
        element: (
          <SuspenseWrapper>
            <WishlistPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'checkout',
        element: (
          <ProtectedRoute>
            <SuspenseWrapper>
              <CheckoutPage />
            </SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/success/:id',
        element: (
          <ProtectedRoute>
            <SuspenseWrapper>
              <OrderSuccessPage />
            </SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedRoute>
            <SuspenseWrapper>
              <OrdersPage />
            </SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:id',
        element: (
          <ProtectedRoute>
            <SuspenseWrapper>
              <OrderDetailPage />
            </SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <SuspenseWrapper>
              <ProfilePage />
            </SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
    ],
  },
  // Admin routes — separate layout (no public Header/Footer)
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminLayout>
          <Outlet />
        </AdminLayout>
      </AdminRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: (
          <SuspenseWrapper>
            <AdminDashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'products',
        element: (
          <SuspenseWrapper>
            <AdminProductsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'categories',
        element: (
          <SuspenseWrapper>
            <AdminCategoriesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'orders',
        element: (
          <SuspenseWrapper>
            <AdminOrdersPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'orders/:id',
        element: (
          <SuspenseWrapper>
            <AdminOrderDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'users',
        element: (
          <SuspenseWrapper>
            <AdminUsersPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'coupons',
        element: (
          <SuspenseWrapper>
            <AdminCouponsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'homepage',
        element: (
          <SuspenseWrapper>
            <AdminHomepagePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings',
        element: (
          <SuspenseWrapper>
            <AdminSettingsPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
  {
    path: '/login',
    element: (
      <SuspenseWrapper>
        <LoginPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/register',
    element: (
      <SuspenseWrapper>
        <RegisterPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '*',
    element: (
      <SuspenseWrapper>
        <NotFoundPage />
      </SuspenseWrapper>
    ),
  },
]

export const router = createBrowserRouter(routes)
