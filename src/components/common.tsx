import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  MessageSquareText,
  Navigation,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  X
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { AiResponse, MapPoint, MetricItem, Poi, RouteResult, ScenicSpot, StatusTone, TimelineItem, WorkflowNode } from "../types";
import { channelData, spotImages, trafficData, workflowNodes } from "../data/mockData";
import { askTravelAssistant } from "../services/aiService";

export function StatusTag({ children, tone = "blue" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function PageLoader({ label = "正在加载智慧文旅服务" }: { label?: string }) {
  return (
    <div className="container page-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="loader-hero">
        <span className="loader-mark" />
        <div>
          <strong>{label}</strong>
          <p className="muted">正在同步页面资源、票务状态与地图组件...</p>
        </div>
      </div>
      <div className="skeleton-grid">
        <span className="skeleton-line wide" />
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="dashboard-title">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="filters">{actions}</div> : null}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  action,
  children,
  className = ""
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card card-pad ${className}`}>
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {action ?? <span className="subtle-link">更多 <ChevronRight size={14} /></span>}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({ metric }: { metric: MetricItem }) {
  const Icon = metric.icon ?? Star;
  const negative = metric.delta.includes("-");
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.article className={`card metric metric-${metric.tone}`} whileHover={shouldReduceMotion ? undefined : { y: -4 }}>
      <div className="metric-icon">
        <Icon size={22} />
      </div>
      <div>
        <span className="muted">{metric.label}</span>
        <b>{metric.value}</b>
        <small className={negative ? "trend-good" : "trend-hot"}>{metric.delta}</small>
      </div>
    </motion.article>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  action
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="card card-pad chart-card">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SpotCard({ spot, compact = false }: { spot: ScenicSpot; compact?: boolean }) {
  const crowdTone: StatusTone = spot.crowd === "舒适" || spot.crowd === "较少" ? "green" : spot.crowd === "适中" ? "orange" : "red";
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.article className={`card spot-card ${compact ? "compact" : ""}`} whileHover={shouldReduceMotion ? undefined : { y: -4 }}>
      <img src={spot.image} alt={spot.name} />
      <div className="spot-body">
        <div className="spot-head">
          <h3>{spot.name}</h3>
          <span className="rating">★ {spot.rating}</span>
        </div>
        <div className="filters tiny-gap">
          <StatusTag tone={crowdTone}>{spot.crowd}</StatusTag>
          {spot.price ? <StatusTag tone="orange">￥{spot.price}</StatusTag> : <StatusTag tone="green">免费</StatusTag>}
          {spot.tags.slice(0, 2).map((tag) => <StatusTag key={tag} tone="slate">{tag}</StatusTag>)}
        </div>
        <p className="reason">为什么推荐你：{spot.reason}</p>
        {!compact ? (
          <div className="card-meta-row">
            <span><MapPin size={14} /> {spot.location}</span>
            <span><Clock3 size={14} /> {spot.duration}</span>
            <span>{spot.weather}</span>
          </div>
        ) : null}
      </div>
    </motion.article>
  );
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="timeline">
      {items.map((item) => (
        <div className="timeline-item" key={`${item.time}-${item.title}`}>
          <strong>{item.time}</strong>
          <motion.div className="card itinerary-card" whileHover={shouldReduceMotion ? undefined : { x: 3 }}>
            {item.image ? <img src={item.image} className="thumb" alt={item.title} /> : <div className="thumb placeholder"><Navigation size={24} /></div>}
            <div>
              <div className="spot-head">
                <h3>{item.title}</h3>
                <StatusTag tone={item.type === "food" ? "orange" : item.type === "traffic" ? "green" : "blue"}>{item.meta}</StatusTag>
              </div>
              <p className="muted">{item.subtitle}</p>
              <div className="filters tiny-gap">
                {item.tags.map((tag) => <StatusTag key={tag} tone={item.type === "food" ? "orange" : "slate"}>{tag}</StatusTag>)}
                {item.open ? <StatusTag tone="blue">开放 {item.open}</StatusTag> : null}
                {item.traffic ? <StatusTag tone="green">{item.traffic}</StatusTag> : null}
              </div>
            </div>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

const quickQuestions = ["西湖一日游，带老人，少排队", "帮我预约雷峰塔上午票", "推荐西湖周边亲子景点", "杭州最近有什么活动？"];

type ChatMessage = {
  role: "user" | "ai";
  text: string;
  result?: AiResponse;
};

export function AIChat() {
  const shouldReduceMotion = useReducedMotion();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "user", text: "西湖一日游，有哪些必去景点和美食推荐？" },
    {
      role: "ai",
      text: "为你生成经典轻松路线：断桥残雪 → 白堤 → 苏堤 → 雷峰塔 → 花港观鱼。当前湖滨客流舒适，建议上午步行、下午游船。",
      result: {
        text: "为你生成经典轻松路线：断桥残雪 → 白堤 → 苏堤 → 雷峰塔 → 花港观鱼。当前湖滨客流舒适，建议上午步行、下午游船。",
        cards: [],
        toolCalls: [
          { name: "POI 搜索", status: "success", summary: "命中杭州真实 POI 候选" },
          { name: "路线提示", status: "success", summary: "已按轻松游约束生成" }
        ],
        confidence: 0.78,
        sourceNote: "演示初始消息；票务、价格、开放时间以官方接口为准。"
      }
    },
    { role: "user", text: "帮我把雷峰塔加入预约，并避开排队高峰。" },
    {
      role: "ai",
      text: "已为你选择 08:00-10:00 候选时段，成人票 2 张，余票充足。请进入订单确认页核对游客信息；本系统当前只做演示支付。",
      result: {
        text: "已为你选择 08:00-10:00 候选时段，成人票 2 张，余票充足。请进入订单确认页核对游客信息；本系统当前只做演示支付。",
        cards: [{ id: "ticket-leifeng", title: "雷峰塔上午票", subtitle: "08:00-10:00 · 演示库存充足", href: "/ticket/leifeng", actionLabel: "去确认" }],
        toolCalls: [
          { name: "票务库存查询", status: "success", summary: "返回演示库存，真实库存以官方接口为准" }
        ],
        confidence: 0.81,
        sourceNote: "当前为演示票务候选，不代表真实锁票。"
      }
    }
  ]);

  const submit = async (value = input) => {
    const clean = value.trim();
    if (!clean || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: clean }]);
    setInput("");
    setLoading(true);
    try {
      const result = await askTravelAssistant(clean);
      setMessages((prev) => [...prev, { role: "ai", text: result.text, result }]);
    } catch {
      const fallback = "服务暂时不可用，已保留你的问题。建议先查看推荐页或票务页继续演示。";
      setMessages((prev) => [...prev, { role: "ai", text: fallback }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card card-pad chat-shell">
      <div className="chat-toolbar">
        <StatusTag tone="blue"><MessageSquareText size={14} /> 文本提问</StatusTag>
        <StatusTag tone="purple">语音 / 拍照 / 翻译</StatusTag>
        <span className="muted">内容由 AI 生成，关键票务以官方为准</span>
      </div>
      <div className="chat">
        {messages.map((message, index) => (
          <motion.div
            className={`bubble ${message.role === "user" ? "user" : "ai"}`}
            key={`${message.role}-${index}`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          >
            {message.role === "ai" ? <strong><Bot size={16} /> AI助手 10:{32 + index}</strong> : null}
            <p>{message.text}</p>
            {message.role === "ai" ? (
              <>
                <div className="tool-row">
                  {(message.result?.toolCalls ?? [
                    { name: "POI 知识库", status: "success", summary: "演示状态" },
                    { name: "票务库存", status: "success", summary: "演示状态" }
                  ]).map((tool) => (
                    <span className="tool-call" key={`${tool.name}-${tool.summary}`}>
                      {tool.status === "success" ? <CheckCircle2 size={14} /> : tool.status === "failed" ? <X size={14} /> : <Loader2 size={14} />}
                      {tool.name}：{tool.summary}
                    </span>
                  ))}
                </div>
                {message.result?.cards.length ? (
                  <div className="grid grid-2" style={{ marginTop: 12 }}>
                    {message.result.cards.map((card) => (
                      <a className="spot-card compact" href={card.href ?? "#"} key={card.id}>
                        {card.image ? <img src={card.image} alt={card.title} /> : <div className="thumb placeholder"><Sparkles size={22} /></div>}
                        <div>
                          <strong>{card.title}</strong>
                          <p className="muted">{card.subtitle}</p>
                          {card.actionLabel ? <StatusTag tone="blue">{card.actionLabel}</StatusTag> : null}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.result ? (
                  <p className="muted">置信度 {(message.result.confidence * 100).toFixed(0)}% · {message.result.sourceNote}</p>
                ) : null}
              </>
            ) : null}
          </motion.div>
        ))}
        {loading ? (
          <motion.div className="bubble ai is-loading" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}>
            <strong><Bot size={16} /> AI助手</strong>
            <p><Loader2 size={14} /> 正在检索 POI、票务与路线候选...</p>
          </motion.div>
        ) : null}
      </div>
      <div className="quick-row">
        {quickQuestions.map((question) => (
          <button key={question} className="chip" onClick={() => submit(question)}>{question}</button>
        ))}
      </div>
      <div className="search-pill compact-input">
        <Bot color="var(--blue)" />
        <input
          placeholder="请输入你的问题，也可以试试拍照识别、语音问路..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
        <button className="icon-btn" aria-label="发送问题" disabled={loading || !input.trim()} onClick={() => submit()}><Send size={18} /></button>
      </div>
    </div>
  );
}

export function TrafficChart({ type = "line" }: { type?: "line" | "area" | "bar"; }) {
  const chartProps = { data: trafficData, margin: { top: 8, right: 12, left: -18, bottom: 0 } };
  const tooltipStyle = { borderRadius: 8, border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" };
  return (
    <ResponsiveContainer width="100%" height={250}>
      {type === "bar" ? (
        <BarChart {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4edf7" />
          <XAxis dataKey="time" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="today" name="今日客流" fill="#176bff" radius={[8, 8, 0, 0]} />
          <Bar dataKey="ai" name="AI触达" fill="#16c7c7" radius={[8, 8, 0, 0]} />
        </BarChart>
      ) : type === "area" ? (
        <AreaChart {...chartProps}>
          <defs>
            <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#176bff" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#176bff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4edf7" />
          <XAxis dataKey="time" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area dataKey="today" name="今日客流" stroke="#176bff" fill="url(#trafficFill)" strokeWidth={3} />
        </AreaChart>
      ) : (
        <LineChart {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4edf7" />
          <XAxis dataKey="time" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="today" name="今日" stroke="#176bff" strokeWidth={3} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="yesterday" name="昨日" stroke="#b9c8da" strokeWidth={3} dot={false} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

export function FunnelPanel() {
  return (
    <div className="funnel-panel">
      {channelData.map((entry, index) => (
        <div className="funnel-step" key={entry.name} style={{ "--fill": entry.fill, "--w": `${100 - index * 12}%` } as CSSProperties}>
          <span>{entry.name}</span>
          <strong>{entry.value.toLocaleString()}</strong>
          {index > 0 ? <em>{((entry.value / channelData[index - 1].value) * 100).toFixed(2)}%</em> : null}
        </div>
      ))}
    </div>
  );
}

export function Donut({ data, height = 190 }: { data: Array<{ name: string; value: number; fill: string }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={4}>
          {data.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--line)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

type AMapOverlay = unknown;

type AMapInstance = {
  add: (overlay: AMapOverlay | AMapOverlay[]) => void;
  addControl: (control: unknown) => void;
  clearMap: () => void;
  destroy: () => void;
  setFitView: (overlays?: AMapOverlay[]) => void;
};

type AMapNamespace = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapInstance;
  Marker: new (options: Record<string, unknown>) => AMapOverlay;
  Pixel: new (x: number, y: number) => unknown;
  Polyline: new (options: Record<string, unknown>) => AMapOverlay;
  Scale: new () => unknown;
  ToolBar: new (options?: Record<string, unknown>) => unknown;
};

type AMapLoaderGlobal = {
  load: (options: { key: string; version: string; plugins?: string[] }) => Promise<AMapNamespace>;
};

type AMapWindow = Window & {
  AMapLoader?: AMapLoaderGlobal;
  _AMapSecurityConfig?: {
    securityJsCode?: string;
    serviceHost?: string;
  };
};

let amapLoaderPromise: Promise<AMapLoaderGlobal> | undefined;

export function MapPanel({
  compact = false,
  scenic = false,
  pois = [],
  route
}: {
  compact?: boolean;
  scenic?: boolean;
  pois?: Poi[];
  route?: RouteResult;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<AMapInstance | null>(null);
  const controlsAddedRef = useRef(false);
  const [mapState, setMapState] = useState<"fallback" | "loading" | "ready">("fallback");
  const [mapError, setMapError] = useState("");
  const staticPins = [
    ["雷峰塔", 58, 72, "blue"],
    ["苏堤春晓", 42, 45, "blue"],
    ["三潭印月", 61, 40, "cyan"],
    ["断桥残雪", 76, 22, "red"],
    ["灵隐寺", 20, 68, "green"],
    ["花港观鱼", 55, 58, "orange"]
  ];
  const amapKey = import.meta.env.VITE_AMAP_JS_KEY?.trim() ?? "";
  const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim() ?? "";
  const amapServiceHost = import.meta.env.VITE_AMAP_SERVICE_HOST?.trim() ?? "";
  const points = useMemo(() => mapPoints(route, pois), [pois, route]);
  const overlayKey = useMemo(() => points.map((point) => `${point.lng},${point.lat},${point.name ?? ""}`).join("|"), [points]);
  const routePathKey = useMemo(() => (route?.points ?? []).map((point) => `${point.lng},${point.lat}`).join("|"), [route?.points]);
  const center = points[0] ?? { lng: 120.148872, lat: 30.245185, name: "杭州西湖" };
  const routeTitle = route
    ? `推荐路线 | 约 ${(route.distanceMeters / 1000).toFixed(1)} 公里`
    : "高德地图 | 杭州文旅点位";
  const routeSubtitle = route
    ? `${route.durationMinutes} 分钟 · ${route.mode} · ${route.provider}${route.fallback ? " fallback" : ""}`
    : mapState === "ready" ? "高德 JSAPI 已加载 · GCJ-02 坐标" : "本地静态底图 · GCJ-02 坐标";

  useEffect(() => {
    if (!amapKey || !containerRef.current) {
      setMapState("fallback");
      setMapError("");
      return;
    }

    let cancelled = false;
    const win = window as AMapWindow;
    const securityConfig = {
      ...(win._AMapSecurityConfig ?? {})
    };
    if (amapSecurityCode) securityConfig.securityJsCode = amapSecurityCode;
    if (amapServiceHost) securityConfig.serviceHost = amapServiceHost;
    if (Object.keys(securityConfig).length > 0) win._AMapSecurityConfig = securityConfig;

    setMapState((current) => current === "ready" ? current : "loading");
    setMapError("");

    loadAmapLoader()
      .then((loader) => loader.load({
        key: amapKey,
        version: "2.0",
        plugins: ["AMap.Scale", "AMap.ToolBar"]
      }))
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new AMap.Map(containerRef.current, {
            center: [center.lng, center.lat],
            zoom: compact ? 13 : 12,
            viewMode: "2D"
          });
        }
        if (!controlsAddedRef.current) {
          mapRef.current.addControl(new AMap.Scale());
          if (!compact) mapRef.current.addControl(new AMap.ToolBar({ position: "RB" }));
          controlsAddedRef.current = true;
        }
        renderAmapOverlays(AMap, mapRef.current, points, route?.points ?? []);
        setMapState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMapState("fallback");
        setMapError(error instanceof Error ? error.message : "AMap JSAPI loading failed");
      });

    return () => {
      cancelled = true;
    };
  }, [amapKey, amapSecurityCode, amapServiceHost, center.lat, center.lng, compact, overlayKey, points, route?.points, routePathKey]);

  useEffect(() => {
    return () => {
      mapRef.current?.destroy();
      mapRef.current = null;
      controlsAddedRef.current = false;
    };
  }, []);

  const fallbackVisible = mapState !== "ready";

  return (
    <div className={`card map-panel ${compact ? "compact" : ""} ${scenic ? "scenic" : ""} ${mapState === "ready" ? "amap-ready" : ""}`}>
      <div ref={containerRef} className="amap-canvas" aria-label="高德地图" />
      {fallbackVisible ? (
        <div className="map-fallback" aria-hidden={mapState === "loading"}>
          <div className="map-line" />
          <div className="map-water" />
          {staticPins.map(([name, x, y, tone], index) => (
            <span
              className={`pin ${tone}`}
              key={name as string}
              style={{ left: `${x}%`, top: `${y}%` } as CSSProperties}
            >
              {index + 1} {name}
            </span>
          ))}
        </div>
      ) : null}
      <span className={`map-status ${mapState === "ready" ? "ready" : ""}`}>
        {mapState === "loading" ? "高德地图加载中" : mapState === "ready" ? "高德地图" : "本地底图"}
      </span>
      <div className="route-callout">
        <strong>{routeTitle}</strong>
        <span>{mapError ? `地图 SDK：${mapError}` : routeSubtitle}</span>
      </div>
    </div>
  );
}

function loadAmapLoader(): Promise<AMapLoaderGlobal> {
  const win = window as AMapWindow;
  if (win.AMapLoader) return Promise.resolve(win.AMapLoader);
  if (amapLoaderPromise) return amapLoaderPromise;

  amapLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-amap-loader='true']");
    if (existing) {
      existing.addEventListener("load", () => win.AMapLoader ? resolve(win.AMapLoader) : reject(new Error("AMapLoader is not available")));
      existing.addEventListener("error", () => reject(new Error("AMap loader script failed")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://webapi.amap.com/loader.js";
    script.async = true;
    script.dataset.amapLoader = "true";
    script.addEventListener("load", () => win.AMapLoader ? resolve(win.AMapLoader) : reject(new Error("AMapLoader is not available")));
    script.addEventListener("error", () => reject(new Error("AMap loader script failed")));
    document.head.appendChild(script);
  });

  return amapLoaderPromise;
}

function mapPoints(route: RouteResult | undefined, pois: Poi[]): MapPoint[] {
  if (route?.points.length) return route.points;
  if (pois.length) return pois.map((poi) => ({ name: poi.name, lng: poi.lng, lat: poi.lat }));
  return [
    { name: "雷峰塔", lng: 120.148234, lat: 30.233501 },
    { name: "苏堤春晓", lng: 120.141664, lat: 30.246586 },
    { name: "断桥残雪", lng: 120.156228, lat: 30.258601 }
  ];
}

function renderAmapOverlays(AMap: AMapNamespace, map: AMapInstance, points: MapPoint[], routePoints: MapPoint[]) {
  map.clearMap();
  const overlays: AMapOverlay[] = [];
  const path = routePoints.length ? routePoints : points;
  if (path.length > 1) {
    overlays.push(new AMap.Polyline({
      path: path.map((point) => [point.lng, point.lat]),
      strokeColor: "#176bff",
      strokeOpacity: 0.86,
      strokeWeight: 6,
      lineJoin: "round",
      lineCap: "round"
    }));
  }

  points.slice(0, 12).forEach((point, index) => {
    overlays.push(new AMap.Marker({
      position: [point.lng, point.lat],
      title: point.name ?? `点位 ${index + 1}`,
      offset: new AMap.Pixel(-18, -38),
      content: `<div class="amap-custom-pin"><span>${index + 1}</span>${escapeHtml(point.name ?? "点位")}</div>`
    }));
  });

  if (overlays.length) {
    map.add(overlays);
    map.setFitView(overlays);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char] ?? char);
}

export function OrderCard({ order }: { order: { id: string; title: string; status: string; amount: number; date: string; image?: string } }) {
  return (
    <article className="card order-card">
      <img src={order.image ?? spotImages.leifeng} alt={order.title} />
      <div>
        <StatusTag tone={order.status === "待支付" ? "orange" : order.status === "已确认" ? "green" : "blue"}>{order.status}</StatusTag>
        <h3>{order.title}</h3>
        <p className="muted">{order.date}</p>
        <div className="spot-head">
          <b>￥{order.amount}</b>
          <button className="ghost-btn">查看凭证</button>
        </div>
      </div>
    </article>
  );
}

export function TicketOption({
  title,
  desc,
  price,
  selected,
  onClick,
  stock
}: {
  title: string;
  desc: string;
  price: number;
  selected?: boolean;
  onClick?: () => void;
  stock?: string;
}) {
  return (
    <button className={`select-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{desc}</span>
      <b>{price === 0 ? "免费" : `￥${price}`}</b>
      {stock ? <small>{stock}</small> : null}
    </button>
  );
}

export function VoucherPreview() {
  return (
    <div className="voucher">
      <QrCode size={104} />
      <div>
        <StatusTag tone="green">入园凭证，仅供演示</StatusTag>
        <h3>杭州西湖景区 · 雷峰塔 成人票</h3>
        <p className="muted">入园日期：2026-06-06 · 入园时段：08:00-10:00 · 数量：2张</p>
        <p className="muted">凭二维码或身份证入园，截图无效，请勿泄露给他人。</p>
      </div>
    </div>
  );
}

export function RecommendReasonCard() {
  const reasons = [
    ["浏览与收藏记录", "你最近浏览了灵隐寺、雷峰塔、西塘古镇等文化体验点。"],
    ["实时情境信息", "当前天气适合户外活动，西湖核心区客流低于周末均值。"],
    ["智能算法匹配", "综合评分、距离、热度、库存与拥堵预测后生成排序。"]
  ];
  return (
    <Section title="为什么推荐给你" action={<Sparkles size={18} />}>
      <div className="grid">
        {reasons.map(([title, text], index) => (
          <div className="reason-row" key={title}>
            <span>{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <p className="muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ReviewTable({
  rows,
  columns,
  action = "查看",
  onAction
}: {
  rows: string[][];
  columns: string[];
  action?: string;
  onAction?: (row: string[], index: number) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th><input type="checkbox" /></th>
            {columns.map((column) => <th key={column}>{column}</th>)}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              <td><input type="checkbox" defaultChecked={index === 0} /></td>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>
                  {cellIndex === row.length - 1 && ["已通过", "已发布", "营业中"].some((value) => cell.includes(value)) ? <StatusTag tone="green">{cell}</StatusTag> :
                    cell.includes("待") || cell.includes("紧张") || cell.includes("失败") ? <StatusTag tone="orange">{cell}</StatusTag> :
                      cell.includes("驳回") || cell.includes("异常") ? <StatusTag tone="red">{cell}</StatusTag> : cell}
                </td>
              ))}
              <td><button className="ghost-btn" onClick={() => onAction?.(row, index)}>{action}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorkflowNodeCard({
  node,
  active,
  onClick
}: {
  node: WorkflowNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`workflow-node ${active ? "active" : ""}`}
      onClick={onClick}
      style={{ left: `${node.x}%`, top: `${node.y}%` } as CSSProperties}
    >
      <StatusTag tone={node.tone}>{node.type}</StatusTag>
      <h3>{node.title}</h3>
      <p>{node.sla}</p>
    </button>
  );
}

export function WorkflowCanvas({ selected, onSelect }: { selected: WorkflowNode; onSelect: (node: WorkflowNode) => void }) {
  return (
    <div className="card workflow-canvas">
      <svg className="workflow-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M50 12 L50 22 L22 44 M50 22 L50 44 M50 22 L78 44 M22 44 L50 64 M50 44 L50 64 M78 44 L50 64 M50 64 L50 82" />
      </svg>
      {workflowNodes.map((node) => (
        <WorkflowNodeCard key={node.id} node={node} active={selected.id === node.id} onClick={() => onSelect(node)} />
      ))}
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="drawer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="drawer-panel" initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }}>
            <div className="section-title">
              <h2>{title}</h2>
              <button className="ghost-btn" onClick={onClose}><X size={16} /> 关闭</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function TrustBar() {
  return (
    <div className="trust-bar">
      {[
        ["官方票源", "景区官方直售，放心预订", ShieldCheck],
        ["安全支付", "多重加密，资金更安全", CheckCircle2],
        ["随时查订单", "进度透明，行程无忧", Ticket]
      ].map(([title, desc, Icon]) => (
        <div key={title as string}>
          <Icon size={28} />
          <strong>{title as string}</strong>
          <span>{desc as string}</span>
        </div>
      ))}
    </div>
  );
}
