import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ArticlesPage from "./pages/ArticlesPage";
import ArticleDetailPage from "./pages/ArticleDetailPage";
import AccountUnlockPage from "./pages/AccountUnlockPage";
import NewTicketPage from "./pages/NewTicketPage";
import MyTicketsPage from "./pages/MyTicketsPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import TechnicianQueuePage from "./pages/TechnicianQueuePage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ajuda" element={<ArticlesPage />} />
          <Route path="/ajuda/:slug" element={<ArticleDetailPage />} />
          <Route path="/chamados/:id" element={<TicketDetailPage />} />
          <Route element={<ProtectedRoute allowedRoles={["EMPLOYEE"]} />}>
            <Route path="/desbloqueio" element={<AccountUnlockPage />} />
            <Route path="/chamados/novo" element={<NewTicketPage />} />
            <Route path="/meus-chamados" element={<MyTicketsPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["TECHNICIAN"]} />}>
            <Route path="/tecnico/chamados" element={<TechnicianQueuePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/inicio" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
