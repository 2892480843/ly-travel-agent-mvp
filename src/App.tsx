import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PageLoader } from "./components/common";
import { AppShell } from "./components/layout/AppShell";
import { DEFAULT_TICKET_ROUTE, LEGACY_TICKET_ROUTE } from "./config/city";
import { canAccess, fetchCurrentAuth, getCurrentUser, loginAsRole, roleLabel } from "./services/authService";
import type { DemoUser, Role } from "./types";

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
  const [switchingRole, setSwitchingRole] = useState<Role | undefined>();
  const suggestedRoles = getSuggestedRoles(location.pathname);
  const defaultDemoRole = suggestedRoles[0];
  const rolePinnedByQuery = new URLSearchParams(location.search).has("role");

  useEffect(() => {
    let alive = true;
    const listener = (event: Event) => {
      setUser((event as CustomEvent<DemoUser>).detail);
    };
    window.addEventListener("ly:role-change", listener);
    fetchCurrentAuth().then((state) => {
      if (!alive) return;
      setUser(state.user);
      setLoading(false);
    });
    return () => {
      alive = false;
      window.removeEventListener("ly:role-change", listener);
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (loading || switchingRole || rolePinnedByQuery || canAccess(location.pathname, user.role) || !defaultDemoRole) {
      return;
    }

    // Demo entry points should open with the role that matches the protected page.
    setSwitchingRole(defaultDemoRole);
    loginAsRole(defaultDemoRole)
      .then((state) => setUser(state.user))
      .finally(() => setSwitchingRole(undefined));
  }, [defaultDemoRole, loading, location.pathname, rolePinnedByQuery, switchingRole, user.role]);

  if (loading) {
    return <PageLoader label="正在校验访问权限" />;
  }

  if (switchingRole) {
    return <PageLoader label={`正在进入${roleLabel(switchingRole)}演示角色`} />;
  }

  if (!canAccess(location.pathname, user.role)) {
    const switchToRole = async (role: Role) => {
      setSwitchingRole(role);
      try {
        const state = await loginAsRole(role);
        setUser(state.user);
      } finally {
        setSwitchingRole(undefined);
      }
    };

    return (
      <div className="container grid">
        <section className="card card-pad empty-state">
          <h1>当前角色无权访问</h1>
          <p className="muted">你当前是{roleLabel(user.role)}，可切换到具备权限的演示角色后继续进入当前后台页面。</p>
          <div className="filters">
            {suggestedRoles.map((role) => (
              <button
                className="primary-btn"
                disabled={switchingRole !== undefined}
                key={role}
                onClick={() => void switchToRole(role)}
              >
                {switchingRole === role ? "正在切换..." : `以${roleLabel(role)}进入`}
              </button>
            ))}
            <NavigateButton />
          </div>
        </section>
      </div>
    );
  }
  return children;
}

function getSuggestedRoles(pathname: string): Role[] {
  if (pathname === "/merchant") return ["merchant", "admin"];
  if (pathname.startsWith("/admin/review")) return ["reviewer", "operator", "admin"];
  if (pathname.startsWith("/admin")) return ["operator", "admin"];
  return ["admin"];
}

function NavigateButton() {
  return (
    <button className="ghost-btn" onClick={() => window.history.back()}>
      返回上一页
    </button>
  );
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
          <Route path="/spot/yellow-crane-tower" element={<SpotDetailPage />} />
          <Route path="/spot/lingyin" element={<Navigate to="/spot/yellow-crane-tower" replace />} />
          <Route path={DEFAULT_TICKET_ROUTE} element={<TicketBookingPage />} />
          <Route path={LEGACY_TICKET_ROUTE} element={<Navigate to={DEFAULT_TICKET_ROUTE} replace />} />
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
