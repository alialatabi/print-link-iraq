import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/auth/AuthPage";
import ServiceSelection from "./pages/customer/ServiceSelection";
import TemplateSelection from "./pages/customer/TemplateSelection";
import OrderForm from "./pages/customer/OrderForm";
import OTPVerification from "./pages/customer/OTPVerification";
import OrderSuccess from "./pages/customer/OrderSuccess";
import OrderTracking from "./pages/customer/OrderTracking";
import MyOrders from "./pages/customer/MyOrders";
import DesignerLogin from "./pages/designer/DesignerLogin";
import DesignerOrders from "./pages/designer/DesignerOrders";
import DesignerOrderDetails from "./pages/designer/DesignerOrderDetails";
import AdminPanel from "./pages/admin/AdminPanel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Layout>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/services" element={<ServiceSelection />} />
                <Route path="/templates/:serviceType" element={<TemplateSelection />} />

                {/* Authenticated customer routes */}
                <Route path="/order/:templateId" element={<ProtectedRoute><OrderForm /></ProtectedRoute>} />
                <Route path="/verify-otp" element={<ProtectedRoute><OTPVerification /></ProtectedRoute>} />
                <Route path="/order-success" element={<ProtectedRoute><OrderSuccess /></ProtectedRoute>} />
                <Route path="/track-order/:orderId" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
                <Route path="/my-orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />

                {/* Designer routes */}
                <Route path="/designer/login" element={<DesignerLogin />} />
                <Route path="/designer/orders" element={<ProtectedRoute requiredRole="designer"><DesignerOrders /></ProtectedRoute>} />
                <Route path="/designer/orders/:orderId" element={<ProtectedRoute requiredRole="designer"><DesignerOrderDetails /></ProtectedRoute>} />

                {/* Admin routes */}
                <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPanel /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
