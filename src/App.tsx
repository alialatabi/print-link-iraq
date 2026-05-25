import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { CartProvider } from "@/contexts/CartContext";
import Layout from "@/components/Layout";
import ScrollToTop from "@/components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
const Index = lazy(() => import("./pages/Index"));

// Lazy-loaded routes for code splitting
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthPage = lazy(() => import("./pages/auth/AuthPage"));
const StaffLogin = lazy(() => import("./pages/auth/StaffLogin"));
const ServiceSelection = lazy(() => import("./pages/customer/ServiceSelection"));
const SubServiceSelection = lazy(() => import("./pages/customer/SubServiceSelection"));
const SpecializationSelection = lazy(() => import("./pages/customer/SpecializationSelection"));
const TemplateSelection = lazy(() => import("./pages/customer/TemplateSelection"));
const OrderForm = lazy(() => import("./pages/customer/OrderForm"));
const OTPVerification = lazy(() => import("./pages/customer/OTPVerification"));
const OrderSuccess = lazy(() => import("./pages/customer/OrderSuccess"));
const OrderTracking = lazy(() => import("./pages/customer/OrderTracking"));
const MyOrders = lazy(() => import("./pages/customer/MyOrders"));
const ProfilePage = lazy(() => import("./pages/customer/ProfilePage"));
const DesignerLogin = lazy(() => import("./pages/designer/DesignerLogin"));
const DesignerOrders = lazy(() => import("./pages/designer/DesignerOrders"));
const DesignerOrderDetails = lazy(() => import("./pages/designer/DesignerOrderDetails"));
const AdminPanel = lazy(() => import("./pages/admin/AdminPanel"));
const TemplateDetails = lazy(() => import("./pages/customer/TemplateDetails"));
const CartPage = lazy(() => import("./pages/customer/CartPage"));
const CheckoutPage = lazy(() => import("./pages/customer/CheckoutPage"));
const CompleteProfile = lazy(() => import("./pages/customer/CompleteProfile"));
const UploadDesignPage = lazy(() => import("./pages/customer/UploadDesignPage"));
const DeliveryAddressPage = lazy(() => import("./pages/customer/DeliveryAddressPage"));
const MyCoupons = lazy(() => import("./pages/customer/MyCoupons"));
const AiDesignPage = lazy(() => import("./pages/customer/AiDesignPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppProvider>
          <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Layout>
              <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/staff-login" element={<StaffLogin />} />
                <Route path="/services" element={<ServiceSelection />} />
                <Route path="/sub-services/:parentId" element={<SubServiceSelection />} />
                <Route path="/specializations/:serviceType" element={<SpecializationSelection />} />
                <Route path="/templates/:serviceType" element={<TemplateSelection />} />
                <Route path="/template/:templateId" element={<TemplateDetails />} />
                <Route path="/ai-design" element={<AiDesignPage />} />
                <Route path="/ai-design/:serviceType" element={<AiDesignPage />} />
                <Route path="/cart" element={<CartPage />} />

                {/* Authenticated customer routes */}
                <Route path="/order/:templateId" element={<ProtectedRoute><OrderForm /></ProtectedRoute>} />
                <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
                <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                <Route path="/upload-design" element={<ProtectedRoute><UploadDesignPage /></ProtectedRoute>} />
                <Route path="/verify-otp" element={<ProtectedRoute><OTPVerification /></ProtectedRoute>} />
                <Route path="/order-success" element={<ProtectedRoute><OrderSuccess /></ProtectedRoute>} />
                <Route path="/track-order/:orderId" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
                <Route path="/delivery-address/:orderId" element={<ProtectedRoute><DeliveryAddressPage /></ProtectedRoute>} />
                <Route path="/my-orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/my-coupons" element={<ProtectedRoute><MyCoupons /></ProtectedRoute>} />

                {/* Designer routes */}
                <Route path="/designer/login" element={<DesignerLogin />} />
                <Route path="/designer/orders" element={<ProtectedRoute requiredRole="designer"><DesignerOrders /></ProtectedRoute>} />
                <Route path="/designer/orders/:orderId" element={<ProtectedRoute requiredRole="designer"><DesignerOrderDetails /></ProtectedRoute>} />

                {/* Admin routes */}
                <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPanel /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </Layout>
          </BrowserRouter>
          </CartProvider>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
