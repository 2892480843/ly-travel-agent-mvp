import { useEffect, useState } from "react";
import { Bell, ExternalLink, Globe2, HelpCircle, Menu, Search } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { routes } from "../../data/mockData";
import { BRAND_NAME, BRAND_NAV_TAGLINE } from "../../config/brand";
import { DEFAULT_TICKET_ROUTE } from "../../config/city";
import { demoUsers, fetchCurrentAuth, getCurrentUser, loginAsRole, roleLabel } from "../../services/authService";
import { apiUrl } from "../../services/apiClient";
import { triggerOperation, type OperationEventDetail } from "../../services/operationService";
import { fetchServiceHealth, getLocalFallbackScopes, LOCAL_FALLBACK_EVENT, type ServiceHealth } from "../../services/serviceHealthService";
import { IS_LIVE } from "../../config/appEnv";
import type { DemoUser, OperationScope, Role } from "../../types";

const topPaths = ["/", "/assistant", "/map", "/plan", DEFAULT_TICKET_ROUTE, "/recommend", "/packages", "/admin/dashboard"];
const adminGroups = [
  "/admin/dashboard",
  "/admin/content",
  "/admin/knowledge",
  "/admin/campaigns",
  "/admin/review",
  "/admin/workflow",
  "/merchant"
];

export function TopNav() {
  const [user, setUser] = useState<DemoUser>(() => getCurrentUser());
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const listener = (event: Event) => setUser((event as CustomEvent<DemoUser>).detail);
    window.addEventListener("ly:role-change", listener);
    fetchCurrentAuth().then((state) => setUser(state.user));
    return () => window.removeEventListener("ly:role-change", listener);
  }, []);
  return (
    <header className="top-nav">
      <NavLink to="/" className="brand">
        <span className="logo" />
        <span className="brand-copy">
          {BRAND_NAME}
          <small>{BRAND_NAV_TAGLINE}</small>
        </span>
      </NavLink>
      <nav className={`nav-links ${navOpen ? "open" : ""}`} aria-label="游客端主导航">
        {topPaths.map((path) => {
          const route = routes.find((item) => item.path === path)!;
          const Icon = route.icon;
          const label = route.label
            .replace("游客端首页", "首页")
            .replace("AI旅行助手", "AI助手")
            .replace("平台导航", "智能导览")
            .replace("武汉三日游规划", "行程规划")
            .replace("黄鹤楼预约", "票务预约")
            .replace("个性化推荐", "推荐")
            .replace("智能套餐", "商旅联动")
            .replace("运营看板", "运营入口");
          return (
            <NavLink key={path} to={path} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={() => setNavOpen(false)}>
              <Icon size={16} />
              <span>{label}</span>
              {path === "/admin/dashboard" ? <ExternalLink size={14} /> : null}
            </NavLink>
          );
        })}
      </nav>
      <div className="nav-actions">
        <span className="nav-meta"><Globe2 size={17} /> 简中 / EN</span>
        <button className="nav-icon-btn" aria-label="查看通知"><Bell size={18} /></button>
        <select className="field role-select" aria-label="切换演示角色" value={user.role} onChange={(event) => loginAsRole(event.target.value as Role).then((state) => setUser(state.user))}>
          {demoUsers.map((item) => <option key={item.role} value={item.role}>{roleLabel(item.role)}</option>)}
        </select>
        <span className="avatar" aria-hidden="true" />
        <button className="mobile-menu nav-icon-btn" aria-label="展开导航菜单" aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}>
          <Menu size={22} />
        </button>
      </div>
    </header>
  );
}

export function AdminSidebar() {
  const [user, setUser] = useState<DemoUser>(() => getCurrentUser());
  useEffect(() => {
    const listener = (event: Event) => setUser((event as CustomEvent<DemoUser>).detail);
    window.addEventListener("ly:role-change", listener);
    fetchCurrentAuth().then((state) => setUser(state.user));
    return () => window.removeEventListener("ly:role-change", listener);
  }, []);
  return (
    <aside className="side">
      <NavLink to="/admin/dashboard" className="brand">
        <span className="logo" aria-hidden="true" />
        <span className="brand-copy">
          {BRAND_NAME}
          <small>{BRAND_NAV_TAGLINE}</small>
        </span>
      </NavLink>
      <nav aria-label="运营端侧边导航">
        {adminGroups.map((path) => {
          const item = routes.find((route) => route.path === path)!;
          return (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
              <item.icon size={19} />
              {item.label}
              {item.path === "/admin/review" ? <em>12</em> : null}
            </NavLink>
          );
        })}
      </nav>
      <div className="side-visual" aria-label="运营态势摘要">
        <div className="side-visual-copy">
          <span>今日态势</span>
          <strong>客流平稳</strong>
          <div className="side-visual-metrics">
            <span><b>45s</b><small>延迟</small></span>
            <span><b>98%</b><small>在线</small></span>
          </div>
        </div>
      </div>
      <div className="side-foot">
        <span className="avatar" />
        <div>
          <strong>{user.name}</strong>
          <div>{roleLabel(user.role)} · 演示鉴权</div>
        </div>
      </div>
    </aside>
  );
}

function AdminTopBar() {
  return (
    <header className="admin-top">
      <label className="admin-search">
        <Search size={17} />
        <input aria-label="运营台全局搜索" placeholder="搜索商户、订单、知识库、工单..." />
      </label>
      <div className="nav-actions">
        <button className="nav-icon-btn notification-btn" aria-label="运营告警，18 条待处理">
          <Bell size={19} />
          <span className="badge-dot" aria-hidden="true">18</span>
        </button>
        <span className="nav-meta"><HelpCircle size={19} /> 帮助中心</span>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin") || pathname === "/merchant";
  useAutoOperationFallback(pathname);

  if (isAdmin) {
    return (
      <div className="admin-shell">
        <AdminSidebar />
        <main className="admin-main">
          <AdminTopBar />
          {children}
        </main>
        <OperationToast />
      </div>
    );
  }
  return (
    <div className="app">
      <TopNav />
      <ServiceHealthBanner />
      <main className="page">{children}</main>
      <OperationToast />
    </div>
  );
}

const PROVIDER_LABELS: Record<string, string> = { map: "地图", ai: "AI 助手", payment: "支付", ticket: "票务" };
const FALLBACK_SCOPE_LABELS: Record<string, string> = {
  pois: "景点数据",
  route: "路线规划",
  tickets: "票务",
  orders: "订单",
  auth: "登录",
  metrics: "运营指标",
  operations: "操作回执"
};

// Only rendered in live mode: a real deployment must never silently pass
// demo/fallback data off as production data.
function ServiceHealthBanner() {
  const [health, setHealth] = useState<ServiceHealth | undefined>();
  const [fallbackScopes, setFallbackScopes] = useState<string[]>(() => getLocalFallbackScopes());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!IS_LIVE) return;
    let alive = true;
    fetchServiceHealth(apiUrl("/api/health")).then((result) => {
      if (alive) setHealth(result);
    });
    const listener = (event: Event) => {
      setFallbackScopes((event as CustomEvent<{ scopes: string[] }>).detail.scopes);
    };
    window.addEventListener(LOCAL_FALLBACK_EVENT, listener);
    return () => {
      alive = false;
      window.removeEventListener(LOCAL_FALLBACK_EVENT, listener);
    };
  }, []);

  if (!IS_LIVE || dismissed) return null;

  const unreachable = health?.reachable === false;
  const demoProviders = Object.entries(health?.providers ?? {})
    .filter(([, mode]) => mode !== "live")
    .map(([key]) => PROVIDER_LABELS[key] ?? key);
  const fallbackLabels = fallbackScopes.map((scope) => FALLBACK_SCOPE_LABELS[scope] ?? scope);

  let tone: "danger" | "warning" | undefined;
  let message = "";
  if (unreachable) {
    tone = "danger";
    message = "无法连接后端服务：当前展示的内容为本地演示数据，不代表真实业务状态。";
  } else if (fallbackLabels.length) {
    tone = "warning";
    message = `部分请求已降级为本地演示数据：${[...new Set(fallbackLabels)].join("、")}。`;
  } else if (demoProviders.length) {
    tone = "warning";
    message = `以下能力当前为演示/降级模式：${demoProviders.join("、")}。生产使用前请完成真实服务接入。`;
  }
  if (!tone) return null;

  return (
    <div className={`service-health-banner ${tone}`} role="alert">
      <span>{message}</span>
      <button onClick={() => setDismissed(true)} aria-label="关闭服务状态提示" type="button">知道了</button>
    </div>
  );
}

function OperationToast() {
  const [notice, setNotice] = useState<OperationEventDetail | undefined>();

  useEffect(() => {
    let timer: number | undefined;
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<OperationEventDetail>).detail;
      setNotice(detail);
      window.clearTimeout(timer);
      if (detail.status !== "pending") {
        timer = window.setTimeout(() => setNotice(undefined), 3600);
      }
    };
    window.addEventListener("ly:operation-result", listener);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("ly:operation-result", listener);
    };
  }, []);

  if (!notice) return null;

  return (
    <div className={`operation-toast ${notice.status}`} role="status" aria-live="polite">
      <span>{notice.message}</span>
      {notice.result?.downloadUrl ? <a href={apiUrl(notice.result.downloadUrl)} target="_blank" rel="noreferrer">下载</a> : null}
    </div>
  );
}

function useAutoOperationFallback(pathname: string) {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : undefined;
      const button = target?.closest("button");
      if (!button || button.disabled || button.closest(".operation-toast")) return;
      if (shouldIgnoreAutoOperation(button)) return;

      const beforeUrl = window.location.href;
      const beforeMarkup = button.outerHTML;
      const label = getButtonLabel(button);
      if (!label) return;

      window.setTimeout(() => {
        if (!button.isConnected) return;
        const changed = window.location.href !== beforeUrl || button.outerHTML !== beforeMarkup;
        if (changed || shouldIgnoreAutoOperation(button)) return;
        triggerOperation({
          scope: scopeForPath(pathname),
          type: operationTypeForLabel(label),
          label,
          metadata: { pathname }
        });
      }, 180);
    };
    document.addEventListener("click", listener, true);
    return () => document.removeEventListener("click", listener, true);
  }, [pathname]);
}

function getButtonLabel(button: HTMLButtonElement) {
  return (button.dataset.operationLabel || button.getAttribute("aria-label") || button.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

function shouldIgnoreAutoOperation(button: HTMLButtonElement) {
  const label = getButtonLabel(button);
  if (!label || label === "-" || label === "+") return true;
  if (label.includes("核销")) return true;
  if (label === "立即生成行程" || label === "重新生成") return true;
  if (button.closest(".chat-quick-row") || button.closest(".assistant-mode-grid")) return true;
  if (button.closest(".map-mode-grid") || button.closest(".map-layer-list")) return true;
  if (button.closest(".chart-type-switch") || button.closest(".workflow-canvas")) return true;
  if (button.classList.contains("select-card") || button.classList.contains("mobile-menu")) return true;
  return ["提交订单", "演示支付", "保存并发起审核", "通过", "驳回", "取消"].includes(label);
}

function scopeForPath(pathname: string): OperationScope {
  if (pathname === "/merchant") return "merchant";
  if (pathname.startsWith("/admin")) return "admin";
  return "visitor";
}

function operationTypeForLabel(label: string) {
  if (label.includes("导出")) return "export";
  if (label.includes("日报") || label.includes("报告")) return "report";
  if (label.includes("批量")) return "batch";
  if (label.includes("重建")) return "knowledge.reindex";
  if (label.includes("新建")) return "create.demo";
  if (label.includes("发布配置")) return "workflow.publish";
  if (label.includes("保存")) return "save";
  if (label.includes("核销")) return "ticket.verify";
  if (label.includes("收藏")) return "favorite.toggle";
  if (label.includes("分享")) return "share";
  if (label.includes("拍照") || label.includes("识别")) return "vision.demo";
  if (label.includes("AR")) return "ar.demo";
  if (label.includes("预览")) return "preview.demo";
  if (label.includes("营销")) return "merchant.marketing";
  if (label.includes("实时客流")) return "traffic.realtime";
  if (label.includes("重排")) return "route.reorder";
  if (label.includes("语音") || label.includes("讲解")) return "guide.audio";
  if (label.includes("搜索") || label.includes("查询")) return "search";
  return "ui.action";
}
