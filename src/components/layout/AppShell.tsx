import { useEffect, useState } from "react";
import { Bell, ExternalLink, Globe2, HelpCircle, Menu, Search } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { routes } from "../../data/mockData";
import { BRAND_NAME, BRAND_NAV_TAGLINE } from "../../config/brand";
import { DEFAULT_TICKET_ROUTE } from "../../config/city";
import { demoUsers, fetchCurrentAuth, getCurrentUser, loginAsRole, roleLabel } from "../../services/authService";
import type { DemoUser, Role } from "../../types";

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
        <button className="nav-icon-btn" aria-label="运营告警"><Bell size={19} /></button>
        <span className="badge-dot">18</span>
        <span className="nav-meta"><HelpCircle size={19} /> 帮助中心</span>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin") || pathname === "/merchant";
  if (isAdmin) {
    return (
      <div className="admin-shell">
        <AdminSidebar />
        <main className="admin-main">
          <AdminTopBar />
          {children}
        </main>
      </div>
    );
  }
  return (
    <div className="app">
      <TopNav />
      <main className="page">{children}</main>
    </div>
  );
}
