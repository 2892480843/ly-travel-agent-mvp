import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  Camera,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Mic,
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
import { DEFAULT_CITY_CENTER, DEFAULT_CITY_NAME, DEFAULT_TICKET_POI_NAME, DEFAULT_TICKET_ROUTE } from "../config/city";
import { askTravelAssistant } from "../services/aiService";
import { triggerOperation } from "../services/operationService";

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
    <div className="dashboard-title page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="filters page-header-actions">{actions}</div> : null}
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
    <section className={`section-panel ${className}`}>
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="section-action">{action}</div> : null}
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
  action,
  className = ""
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card card-pad chart-card ${className}`.trim()}>
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
        <p className="reason"><span className="reason-label">为什么推荐你：</span>{spot.reason}</p>
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
            <div className="itinerary-card-body">
              <div className="itinerary-card-head">
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

type ChatMessage = {
  role: "user" | "ai";
  text: string;
  result?: AiResponse;
};

export type AIChatPromptRequest = {
  id: number;
  text: string;
  autoSubmit?: boolean;
};

export function AIChat({
  onResult,
  promptRequest,
  onPromptRequestConsumed
}: {
  onResult?: (result: AiResponse, prompt: string) => void;
  promptRequest?: AIChatPromptRequest;
  onPromptRequestConsumed?: () => void;
} = {}) {
  const shouldReduceMotion = useReducedMotion();
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "user", text: "武汉一日游，有哪些必去景点和美食推荐？" },
    {
      role: "ai",
      text: "为你生成经典轻松路线：黄鹤楼 → 黄鹤楼公园 → 江汉关博物馆 → 汉口江滩。当前客流为演示估算，建议上午登楼、下午江滩慢游。",
      result: {
        text: "为你生成经典轻松路线：黄鹤楼 → 黄鹤楼公园 → 江汉关博物馆 → 汉口江滩。当前客流为演示估算，建议上午登楼、下午江滩慢游。",
        cards: [],
        toolCalls: [
          { name: "POI 搜索", status: "success", summary: "命中武汉真实 POI 候选" },
          { name: "路线提示", status: "success", summary: "已按轻松游约束生成" }
        ],
        confidence: 0.78,
        sourceNote: "演示初始消息；票务、价格、开放时间以官方接口为准。"
      }
    },
    { role: "user", text: "帮我把黄鹤楼加入预约，并避开排队高峰。" },
    {
      role: "ai",
      text: "已为你选择 08:00-10:00 sandbox 候选时段，成人票 2 张。请进入订单确认页核对游客信息；本系统当前只做演示支付。",
      result: {
        text: "已为你选择 08:00-10:00 sandbox 候选时段，成人票 2 张。请进入订单确认页核对游客信息；本系统当前只做演示支付。",
        cards: [{ id: "ticket-yellow-crane-tower", title: "黄鹤楼上午票", subtitle: "08:00-10:00 · sandbox 演示库存", href: DEFAULT_TICKET_ROUTE, actionLabel: "去确认" }],
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
      onResult?.(result, clean);
      setMessages((prev) => [...prev, { role: "ai", text: result.text, result }]);
    } catch {
      const fallback = "服务暂时不可用，已保留你的问题。建议先查看推荐页或票务页继续演示。";
      setMessages((prev) => [...prev, { role: "ai", text: fallback }]);
    } finally {
      setLoading(false);
    }
  };

  const activateDemoTool = (label: "语音输入" | "拍照识别") => {
    if (label === "语音输入") {
      setInput("请帮我规划一条少排队的黄鹤楼游览路线");
    } else {
      const result: AiResponse = {
        text: "已识别示例图片为黄鹤楼相关场景，可继续询问票务、路线或讲解内容。",
        cards: [{ id: "vision-demo-yellow-crane", title: "黄鹤楼识别结果", subtitle: "拍照识别为演示能力，未上传真实图片", href: "/spot/yellow-crane-tower", actionLabel: "查看详情" }],
        toolCalls: [{ name: "拍照识别", status: "success", summary: "返回本地演示识别结果" }],
        confidence: 0.72,
        sourceNote: "当前仅使用本地示例识别说明，不代表真实图像识别或第三方视觉服务结果。"
      };
      onResult?.(result, label);
      setMessages((prev) => [...prev, {
        role: "ai",
        text: result.text,
        result
      }]);
    }
    triggerOperation({ scope: "visitor", type: label === "语音输入" ? "voice.demo" : "vision.demo", label });
  };

  useEffect(() => {
    if (!promptRequest) return;
    setInput(promptRequest.text);
    if (promptRequest.autoSubmit) {
      void submit(promptRequest.text);
    }
    onPromptRequestConsumed?.();
    // submit intentionally reads the latest loading state; prompt ids prevent repeats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptRequest?.id]);

  useEffect(() => {
    const initialResult = [...messages].reverse().find((message) => message.role === "ai" && message.result)?.result;
    if (initialResult) {
      onResult?.(initialResult, "initial-demo");
    }
    // Only publish the seeded demo state once for the surrounding page chrome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: shouldReduceMotion ? "auto" : "smooth" });
  }, [messages.length, loading, shouldReduceMotion]);

  return (
    <div className="card card-pad chat-shell">
      <div className="chat" ref={chatRef} aria-label="AI 对话记录">
        {messages.map((message, index) => (
          <motion.div
            className={`bubble ${message.role === "user" ? "user" : "ai"}`}
            key={`${message.role}-${index}`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          >
            {message.role === "ai" ? (
              <div className="chat-message-head">
                <span className="chat-avatar"><Bot size={16} /></span>
                <div>
                  <strong>AI助手</strong>
                  <small>10:{32 + index}</small>
                </div>
              </div>
            ) : null}
            <p className="chat-message-text">{message.text}</p>
            {message.role === "ai" ? (
              <>
                <div className="tool-row chat-tool-row">
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
                  <div className="chat-result-grid">
                    {message.result.cards.map((card) => (
                      <a className="chat-result-card" href={card.href ?? "#"} key={card.id}>
                        {card.image ? <img src={card.image} alt={card.title} /> : (
                          <span className="chat-result-icon"><CalendarCheck size={24} /></span>
                        )}
                        <span className="chat-result-copy">
                          <strong>{card.title}</strong>
                          <p className="muted">{card.subtitle}</p>
                        </span>
                        {card.actionLabel ? <span className="chat-result-action">{card.actionLabel}<ChevronRight size={15} /></span> : null}
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.result ? (
                  <div className="chat-source-note">
                    <span className="chat-confidence">
                      <small>置信度</small>
                      <strong>{(message.result.confidence * 100).toFixed(0)}%</strong>
                    </span>
                    <div className="chat-source-copy">
                      <ShieldCheck size={14} />
                      <p>{message.result.sourceNote}</p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </motion.div>
        ))}
        {loading ? (
          <motion.div className="bubble ai is-loading" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}>
            <div className="chat-message-head">
              <span className="chat-avatar"><Bot size={16} /></span>
              <div>
                <strong>AI助手</strong>
                <small>检索中</small>
              </div>
            </div>
            <p><Loader2 size={14} /> 正在检索 POI、票务与路线候选...</p>
          </motion.div>
        ) : null}
      </div>
      <div className="search-pill compact-input chat-composer">
        <span className="chat-composer-icon"><Bot size={18} /></span>
        <textarea
          aria-label="输入旅行助手问题"
          placeholder="请输入你的问题..."
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className="chat-composer-tools" aria-label="输入辅助">
          <button className="chat-tool-btn" type="button" aria-label="语音输入" onClick={() => activateDemoTool("语音输入")}><Mic size={17} /></button>
          <button className="chat-tool-btn" type="button" aria-label="拍照识别" onClick={() => activateDemoTool("拍照识别")}><Camera size={17} /></button>
        </div>
        <button className="icon-btn" aria-label="发送问题" disabled={loading || !input.trim()} onClick={() => void submit()}><Send size={18} /></button>
      </div>
    </div>
  );
}

export function TrafficChart({ type = "line" }: { type?: "line" | "area" | "bar"; }) {
  const chartProps = { data: trafficData, margin: { top: 12, right: 18, left: 8, bottom: 8 } };
  const tooltipStyle = { borderRadius: 8, border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" };
  const axisTick = { fill: "var(--muted)", fontSize: 12, fontWeight: 800 };
  return (
    <ResponsiveContainer width="100%" height={250}>
      {type === "bar" ? (
        <BarChart {...chartProps} barCategoryGap="24%" barGap={8}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde7de" />
          <XAxis dataKey="time" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis width={48} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="today" name="今日客流" fill="#7ba7c8" maxBarSize={24} radius={[8, 8, 0, 0]} />
          <Bar dataKey="ai" name="AI触达" fill="#83b8ad" maxBarSize={24} radius={[8, 8, 0, 0]} />
        </BarChart>
      ) : type === "area" ? (
        <AreaChart {...chartProps}>
          <defs>
            <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7ba7c8" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#7ba7c8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde7de" />
          <XAxis dataKey="time" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis width={48} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area dataKey="today" name="今日客流" stroke="#7ba7c8" fill="url(#trafficFill)" strokeWidth={3} />
        </AreaChart>
      ) : (
        <LineChart {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde7de" />
          <XAxis dataKey="time" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis width={48} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="today" name="今日" stroke="#7ba7c8" strokeWidth={3} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="yesterday" name="昨日" stroke="#cbd6cf" strokeWidth={3} dot={false} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

export function FunnelPanel() {
  const totalValue = channelData[0]?.value ?? 0;
  const rows = channelData.map((entry, index) => {
    const previousValue = channelData[index - 1]?.value;
    const stepRateValue = previousValue ? (entry.value / previousValue) * 100 : 100;
    const retentionRateValue = totalValue ? (entry.value / totalValue) * 100 : 0;
    const dropRateValue = previousValue ? 100 - stepRateValue : 0;
    return {
      ...entry,
      index,
      conversionRate: `${stepRateValue.toFixed(2)}%`,
      dropRate: `${Math.max(dropRateValue, 0).toFixed(2)}%`,
      retentionRate: `${retentionRateValue.toFixed(2)}%`,
      retentionWidth: `${Math.max(retentionRateValue, 3).toFixed(2)}%`
    };
  });
  const lastRow = rows.at(-1);
  const finalRate = lastRow?.retentionRate ?? "0.00%";

  return (
    <div className="funnel-panel conversion-funnel-panel">
      <div className="conversion-funnel-summary" aria-label="预约到游览转化总览">
        <span>最终转化率</span>
        <strong>{finalRate}</strong>
        <small>
          {totalValue.toLocaleString()} 访问中，{(lastRow?.value ?? 0).toLocaleString()} 完成二次消费
        </small>
      </div>
      <div className="conversion-funnel-steps" aria-label="转化步骤明细">
        {rows.map((entry) => (
          <article
            className="conversion-funnel-step"
            key={entry.name}
            style={{ "--fill": entry.fill, "--bar": entry.retentionWidth } as CSSProperties}
          >
            <div className="conversion-step-head">
              <span className="conversion-funnel-index">{String(entry.index + 1).padStart(2, "0")}</span>
              <span className="conversion-funnel-copy">
                <strong>{entry.name}</strong>
                <small>总量留存 {entry.retentionRate}</small>
              </span>
              <b>{entry.value.toLocaleString()}</b>
            </div>
            <div className="conversion-step-track" aria-hidden="true">
              <span />
            </div>
            <div className="conversion-step-foot">
              <span>{entry.index === 0 ? "总访问基数" : `较上一步 ${entry.conversionRate}`}</span>
              <em>{entry.index === 0 ? "起点阶段" : `流失 ${entry.dropRate}`}</em>
            </div>
          </article>
        ))}
      </div>
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
  const staticPins = [
    ["黄鹤楼", 52, 54, "blue"],
    ["江汉关", 68, 38, "cyan"],
    ["汉口江滩", 74, 30, "blue"],
    ["湖北省博物馆", 38, 42, "green"],
    ["武汉动物园", 24, 70, "orange"],
    ["保成路夜市", 60, 72, "red"]
  ];
  const amapKey = import.meta.env.VITE_AMAP_JS_KEY?.trim() ?? "";
  const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim() ?? "";
  const amapServiceHost = import.meta.env.VITE_AMAP_SERVICE_HOST?.trim() ?? "";
  const points = useMemo(() => mapMarkerPoints(route, pois), [pois, route]);
  const overlayKey = useMemo(() => points.map((point) => `${point.lng},${point.lat},${point.name ?? ""}`).join("|"), [points]);
  const routePathKey = useMemo(() => (route?.points ?? []).map((point) => `${point.lng},${point.lat}`).join("|"), [route?.points]);
  const center = points[0] ?? route?.points[0] ?? { ...DEFAULT_CITY_CENTER, name: DEFAULT_CITY_NAME };
  useEffect(() => {
    if (!amapKey || !containerRef.current) {
      setMapState("fallback");
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
      .catch(() => {
        if (cancelled) return;
        setMapState("fallback");
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

function mapMarkerPoints(route: RouteResult | undefined, pois: Poi[]): MapPoint[] {
  if (pois.length) return pois.map((poi) => ({ name: poi.name, lng: poi.lng, lat: poi.lat }));
  const namedRoutePoints = route?.points.filter((point) => Boolean(point.name)) ?? [];
  if (namedRoutePoints.length) return namedRoutePoints;
  return [
    { name: "黄鹤楼", lng: 114.302409, lat: 30.544404 },
    { name: "江汉关博物馆", lng: 114.292416, lat: 30.57909 },
    { name: "汉口江滩-观江台", lng: 114.308085, lat: 30.601017 }
  ];
}

function renderAmapOverlays(AMap: AMapNamespace, map: AMapInstance, points: MapPoint[], routePoints: MapPoint[]) {
  map.clearMap();
  const overlays: AMapOverlay[] = [];
  const path = routePoints.length ? routePoints : points;
  if (path.length > 1) {
    overlays.push(new AMap.Polyline({
      path: path.map((point) => [point.lng, point.lat]),
      strokeColor: "#7ba7c8",
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
      <img src={order.image ?? spotImages.yellowCraneTower} alt={order.title} />
      <div className="order-card-main">
        <StatusTag tone={order.status === "待支付" ? "orange" : order.status === "已确认" ? "green" : "blue"}>{order.status}</StatusTag>
        <h3>{order.title}</h3>
        <p className="muted">{order.date}</p>
      </div>
      <div className="order-card-action">
        <b>￥{order.amount}</b>
        <a className="ghost-btn" href="/ticket/detail">查看凭证</a>
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

type VoucherPreviewProps = {
  title?: string;
  ticketName?: string;
  visitDate?: string;
  slotTime?: string;
  quantity?: number;
  amount?: number;
  gate?: string;
  holderNames?: string[];
  validUntil?: string;
};

export function VoucherPreview({
  title = `武汉文旅演示票务 · ${DEFAULT_TICKET_POI_NAME}`,
  ticketName = "成人票",
  visitDate = "2026-06-06",
  slotTime = "08:00-10:00",
  quantity = 2,
  amount,
  gate = "黄鹤楼景区西门",
  holderNames = ["张小文", "李小明"],
  validUntil
}: VoucherPreviewProps = {}) {
  const slotEnd = slotTime.includes("-") ? slotTime.split("-")[1] : "";
  const validityText = validUntil ?? (slotEnd ? `${slotEnd} 前有效` : "预约时段内有效");
  const visitors = Array.from({ length: quantity }, (_, index) => holderNames[index] ?? `第 ${index + 1} 位游客`);
  const details = [
    { label: "入园日期", value: visitDate },
    { label: "入园时段", value: slotTime },
    { label: "票数", value: `${quantity} 张` },
    { label: "核验入口", value: gate },
    { label: "有效期", value: validityText },
    ...(amount ? [{ label: "订单金额", value: `￥${amount}`, emphasis: true }] : [])
  ];

  return (
    <div className="voucher">
      <div className="voucher-qr">
        <QrCode size={104} />
        <span>动态核验码</span>
      </div>
      <div className="voucher-content">
        <div className="voucher-header">
          <StatusTag tone="green">入园凭证，仅供演示</StatusTag>
          <h3>{title} {ticketName}</h3>
          <p className="muted">仅用于 sandbox 流程演示，不代表真实出票、真实库存或官方支付凭证。</p>
        </div>
        <div className="voucher-detail-grid">
          {details.map((item) => (
            <div className={`voucher-detail-item ${item.emphasis ? "emphasis" : ""}`} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="voucher-visitors" aria-label="入园人">
          {visitors.map((visitor) => <span key={visitor}><ShieldCheck size={14} />{visitor}</span>)}
        </div>
        <div className="voucher-alert">
          <CheckCircle2 size={18} />
          <span>请在预约时段前往指定入口核验，建议提前 15 分钟到达并携带有效身份证件。</span>
        </div>
      </div>
    </div>
  );
}

export function RecommendReasonCard() {
  const reasons = [
    ["浏览与收藏记录", "你最近浏览了黄鹤楼、湖北省博物馆、江汉关博物馆等文化体验点。"],
    ["实时情境信息", "当前天气适合户外活动，武汉核心点位客流低于周末均值。"],
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
  onAction,
  getRowKey,
  selectedRowKeys,
  onRowCheckedChange,
  onAllCheckedChange
}: {
  rows: string[][];
  columns: string[];
  action?: string;
  onAction?: (row: string[], index: number) => void;
  getRowKey?: (row: string[], index: number) => string;
  selectedRowKeys?: string[];
  onRowCheckedChange?: (row: string[], index: number, checked: boolean) => void;
  onAllCheckedChange?: (checked: boolean, rows: string[][]) => void;
}) {
  const controlledSelection = Array.isArray(selectedRowKeys);
  const rowKeyFor = (row: string[], index: number) => getRowKey?.(row, index) ?? `${row[0]}-${index}`;
  const allVisibleSelected = controlledSelection && rows.length > 0 && rows.every((row, index) => selectedRowKeys.includes(rowKeyFor(row, index)));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={controlledSelection ? allVisibleSelected : undefined}
                onChange={controlledSelection ? (event) => onAllCheckedChange?.(event.target.checked, rows) : undefined}
              />
            </th>
            {columns.map((column) => <th key={column}>{column}</th>)}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2} className="muted">暂无匹配数据</td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              <td>
                <input
                  type="checkbox"
                  checked={controlledSelection ? selectedRowKeys.includes(rowKeyFor(row, index)) : undefined}
                  defaultChecked={controlledSelection ? undefined : index === 0}
                  onChange={controlledSelection ? (event) => onRowCheckedChange?.(row, index, event.target.checked) : undefined}
                />
              </td>
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
        ["演示库存", "sandbox 票务流程，不代表真实库存", ShieldCheck],
        ["支付沙箱", "仅模拟支付链路，不产生真实扣款", CheckCircle2],
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
