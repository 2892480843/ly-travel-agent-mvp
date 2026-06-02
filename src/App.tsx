import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PageLoader } from "./components/common";
import { AppShell } from "./components/layout/AppShell";
import { canAccess, fetchCurrentAuth, getCurrentUser, roleLabel } from "./services/authService";
import type { DemoUser } from "./types";

const HomePage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.HomePage })));
const AssistantPage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.AssistantPage })));
const RecommendPage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.RecommendPage })));
const PlanPage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.PlanPage })));
const SpotDetailPage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.SpotDetailPage })));
const TicketBookingPage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.TicketBookingPage })));
const TicketDetailPage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.TicketDetailPage })));
const PayPage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.PayPage })));
const MePage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.MePage })));
const PackagesPage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.PackagesPage })));
const ImmersivePage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.ImmersivePage })));
const MapPage = lazy(() => import("./pages/TravelPages").then((module) => ({ default: module.MapPage })));
const DashboardPage = lazy(() => import("./pages/AdminPages").then((module) => ({ default: module.DashboardPage })));
const ContentPage = lazy(() => import("./pages/AdminPages").then((module) => ({ default: module.ContentPage })));
const KnowledgePage = lazy(() => import("./pages/AdminPages").then((module) => ({ default: module.KnowledgePage })));
const MerchantPage = lazy(() => import("./pages/AdminPages").then((module) => ({ default: module.MerchantPage })));
const CampaignsPage = lazy(() => import("./pages/AdminPages").then((module) => ({ default: module.CampaignsPage })));
const ReviewPage = lazy(() => import("./pages/AdminPages").then((module) => ({ default: module.ReviewPage })));
const WorkflowPage = lazy(() => import("./pages/AdminPages").then((module) => ({ default: module.WorkflowPage })));

function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [user, setUser] = useState<DemoUser>(() => getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchCurrentAuth().then((state) => {
      if (!alive) return;
      setUser(state.user);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [location.pathname]);

  if (loading) {
    return <PageLoader label="正在校验访问权限" />;
  }

  if (!canAccess(location.pathname, user.role)) {
    return (
      <div className="container grid">
        <section className="card card-pad empty-state">
          <h1>当前角色无权访问</h1>
          <p className="muted">你当前是{roleLabel(user.role)}，请切换到具备权限的演示角色。当前鉴权仅为前端演示，真实认证需后续接入。</p>
          <Navigate to="/" replace />
        </section>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/recommend" element={<RecommendPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/spot/lingyin" element={<SpotDetailPage />} />
          <Route path="/ticket/leifeng" element={<TicketBookingPage />} />
          <Route path="/ticket/detail" element={<TicketDetailPage />} />
          <Route path="/pay" element={<PayPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/immersive" element={<ImmersivePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/admin/content" element={<ProtectedRoute><ContentPage /></ProtectedRoute>} />
          <Route path="/admin/knowledge" element={<ProtectedRoute><KnowledgePage /></ProtectedRoute>} />
          <Route path="/merchant" element={<ProtectedRoute><MerchantPage /></ProtectedRoute>} />
          <Route path="/admin/campaigns" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
          <Route path="/admin/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
          <Route path="/admin/workflow" element={<ProtectedRoute><WorkflowPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
