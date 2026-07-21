import { Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { HelmetProvider } from "react-helmet-async";
import Layout from "@/components/layout/Layout";
import HomePage from "@/pages/HomePage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import DashboardPage from "@/pages/DashboardPage";
import GamesPage from "@/pages/GamesPage";
import BlackjackPage from "@/pages/BlackjackPage";
import RoulettePage from "@/pages/RoulettePage";
import SlotsPage from "@/pages/SlotsPage";
import CrashPage from "@/pages/CrashPage";
import BaccaratPage from "@/pages/BaccaratPage";
import PokerPage from "@/pages/PokerPage";
import AdminPage from "@/pages/AdminPage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import AdminUserPage from "@/pages/AdminUserPage";
import CashierPage from "@/pages/CashierPage";
import KycPage from "@/pages/KycPage";
import NotificationsPage from "@/pages/NotificationsPage";
import ProfilePage from "@/pages/ProfilePage";
import { useAuthStore } from "@/store/authStore";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <HelmetProvider>
    <AnimatePresence mode="wait">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />

          {/* Protected routes */}
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="games" element={<GamesPage />} />
          <Route
            path="games/blackjack"
            element={
              <ProtectedRoute>
                <BlackjackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="games/roulette"
            element={
              <ProtectedRoute>
                <RoulettePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="games/slots"
            element={
              <ProtectedRoute>
                <SlotsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="games/crash"
            element={
              <ProtectedRoute>
                <CrashPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="games/baccarat"
            element={
              <ProtectedRoute>
                <BaccaratPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="games/poker"
            element={
              <ProtectedRoute>
                <PokerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="cashier"
            element={
              <ProtectedRoute>
                <CashierPage />
              </ProtectedRoute>
            }
          />
          <Route path="admin/login" element={<AdminLoginPage />} />
          <Route
            path="admin/users/:userId"
            element={
              <ProtectedRoute>
                <AdminUserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="kyc"
            element={
              <ProtectedRoute>
                <KycPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </AnimatePresence>
    </HelmetProvider>
  );
}
