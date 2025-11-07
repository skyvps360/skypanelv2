import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  ImpersonationProvider,
  useImpersonation,
} from "./contexts/ImpersonationContext";
import { ImpersonationBanner } from "./components/admin/ImpersonationBanner";
import { ImpersonationLoadingOverlay } from "./components/admin/ImpersonationLoadingOverlay";
import { setupAutoLogout } from "@/lib/api";
import { useEffect } from "react";

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
});
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import VPS from "./pages/VPS";
import Billing from "./pages/Billing";
import InvoiceDetail from "./pages/InvoiceDetail";
import TransactionDetail from "./pages/TransactionDetail";
import BillingPaymentSuccess from "./pages/BillingPaymentSuccess";
import BillingPaymentCancel from "./pages/BillingPaymentCancel";
import Support from "./pages/Support";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import VPSDetail from "./pages/VPSDetail";
import VpsSshConsole from "./pages/VpsSshConsole";
import AppLayout from "./components/AppLayout";
import ActivityPage from "./pages/Activity";
import ApiDocs from "./pages/ApiDocs";
import FAQ from "./pages/FAQ";
import AboutUs from "./pages/AboutUs";
import Contact from "./pages/Contact";
import Status from "./pages/Status";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Pricing from "./pages/Pricing";
import SSHKeys from "./pages/SSHKeys";
import PaaS from "./pages/PaaS";
import PaaSAppDetail from "./pages/PaaSAppDetail";

import AdminUserDetail from "./pages/admin/AdminUserDetail";

// Component to handle impersonation banner display
function ImpersonationWrapper({ children }: { children: React.ReactNode }) {
  const {
    isImpersonating,
    impersonatedUser,
    exitImpersonation,
    isExiting,
    isStarting,
    startingProgress,
    startingMessage,
    startingTargetUser,
  } = useImpersonation();

  return (
    <>
      {isImpersonating && impersonatedUser && (
        <ImpersonationBanner
          impersonatedUser={impersonatedUser}
          onExitImpersonation={exitImpersonation}
          isExiting={isExiting}
        />
      )}
      {isStarting && (
        <ImpersonationLoadingOverlay
          targetUser={
            startingTargetUser ||
            impersonatedUser || {
              name: "User",
              email: "Loading...",
              role: "user",
            }
          }
          progress={startingProgress}
          message={startingMessage}
        />
      )}
      <div style={{ paddingTop: isImpersonating ? "60px" : "0" }}>
        {children}
      </div>
    </>
  );
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ImpersonationWrapper>
      <AppLayout>{children}</AppLayout>
    </ImpersonationWrapper>
  );
}

function StandaloneProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <ImpersonationWrapper>{children}</ImpersonationWrapper>;
}

// Admin Route Component (requires authenticated admin role)
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ImpersonationWrapper>
      <AppLayout>{children}</AppLayout>
    </ImpersonationWrapper>
  );
}

// Public Route Component (redirect to dashboard if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Component to setup auto-logout inside Router context
function AutoLogoutSetup() {
  const { logout } = useAuth();

  useEffect(() => {
    setupAutoLogout(logout);
  }, [logout]);

  return null;
}

function AppRoutes() {
  return (
    <>
      <AutoLogoutSetup />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vps"
          element={
            <ProtectedRoute>
              <VPS />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vps/:id"
          element={
            <ProtectedRoute>
              <VPSDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vps/:id/ssh"
          element={
            <StandaloneProtectedRoute>
              <VpsSshConsole />
            </StandaloneProtectedRoute>
          }
        />
        <Route
          path="/ssh-keys"
          element={
            <ProtectedRoute>
              <SSHKeys />
            </ProtectedRoute>
          }
        />
        <Route
          path="/paas"
          element={
            <ProtectedRoute>
              <PaaS />
            </ProtectedRoute>
          }
        />
        <Route
          path="/paas/:id"
          element={
            <ProtectedRoute>
              <PaaSAppDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/invoice/:id"
          element={
            <ProtectedRoute>
              <InvoiceDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/transaction/:id"
          element={
            <ProtectedRoute>
              <TransactionDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/payment/success"
          element={
            <ProtectedRoute>
              <BillingPaymentSuccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/payment/cancel"
          element={
            <ProtectedRoute>
              <BillingPaymentCancel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <Support />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <ActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/user/:id"
          element={
            <AdminRoute>
              <AdminUserDetail />
            </AdminRoute>
          }
        />
        <Route
          path="/api-docs"
          element={
            <ProtectedRoute>
              <ApiDocs />
            </ProtectedRoute>
          }
        />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/status" element={<Status />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ImpersonationProvider>
            <Router>
              <AppRoutes />
              <Toaster position="bottom-right" richColors closeButton />
            </Router>
          </ImpersonationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
