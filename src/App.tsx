import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ServiceSelection from "./pages/customer/ServiceSelection";
import TemplateSelection from "./pages/customer/TemplateSelection";
import OrderForm from "./pages/customer/OrderForm";
import OTPVerification from "./pages/customer/OTPVerification";
import OrderSuccess from "./pages/customer/OrderSuccess";
import OrderTracking from "./pages/customer/OrderTracking";
import DesignerLogin from "./pages/designer/DesignerLogin";
import DesignerOrders from "./pages/designer/DesignerOrders";
import DesignerOrderDetails from "./pages/designer/DesignerOrderDetails";
import AdminPanel from "./pages/admin/AdminPanel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/services" element={<ServiceSelection />} />
              <Route path="/templates/:serviceType" element={<TemplateSelection />} />
              <Route path="/order/:templateId" element={<OrderForm />} />
              <Route path="/verify-otp" element={<OTPVerification />} />
              <Route path="/order-success" element={<OrderSuccess />} />
              <Route path="/track-order/:orderId" element={<OrderTracking />} />
              <Route path="/designer/login" element={<DesignerLogin />} />
              <Route path="/designer/orders" element={<DesignerOrders />} />
              <Route path="/designer/orders/:orderId" element={<DesignerOrderDetails />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
