import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Accessibility,
  Baby,
  Bell,
  Camera,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  Headphones,
  Languages,
  Landmark,
  MapPin,
  Mic,
  Navigation,
  PackageCheck,
  ParkingCircle,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  Toilet,
  Train,
  Utensils,
  WalletCards
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  AIChat,
  type AIChatPromptRequest,
  DemoDataBadge,
  Donut,
  MapPanel,
  OrderCard,
  PageHeader,
  RecommendReasonCard,
  Section,
  SpotCard,
  StatusTag,
  TicketOption,
  Timeline,
  TrustBar,
  VoucherPreview
} from "../components/common";
import {
  cityStats,
  foods,
  heroImage,
  orders,
  packages,
  scenicSpots,
  spotImages,
  ticketOptions,
  ticketSlots,
  timelineDays
} from "../data/mockData";
import type { AiResponse, GeneratedItineraryResponse, Order, PaymentRecord, Poi, PoiCategory, RouteResult, StatusTone, TicketLock, TicketProduct, TicketSlot, TimelineItem } from "../types";
import { createOrder, createPayment, fetchOrders, fetchPayment, fetchPoi, fetchPois, fetchRoute, fetchTicketOptions, generateItinerary, lockTickets, simulateSandboxPayment } from "../services/apiClient";
import { mergeOrders, orderStatusLabel, pickLatestUsableOrder, readOrders, saveOrder, saveOrders, updateOrderStatus } from "../services/orderService";
import { triggerOperation } from "../services/operationService";
import { filterRecommendedPois, poiToScenicSpot, recommendationFilters, type RecommendationFilter, statusForStock } from "../services/poiService";
import { validateTicketSelection } from "../services/ticketService";
import { addDaysISO, monthDay, todayISO, upcomingDatesISO } from "../utils/demoDates";
import { flatMeters, orderOpenTourBy } from "../utils/tour";
import { clearTourIntent, readTourIntent, saveTourIntent } from "../services/tourIntentService";
import { BRAND_HERO_EYEBROW, BRAND_NAME } from "../config/brand";
import {
  DEFAULT_CITY_CENTER,
  DEFAULT_CITY_ID,
  DEFAULT_CITY_NAME,
  DEFAULT_CITY_OFFICIAL_NAME,
  DEFAULT_TICKET_DEMO_POI_ID,
  DEFAULT_TICKET_POI_NAME,
  DEFAULT_TICKET_REAL_POI_ID,
  DEFAULT_TICKET_ROUTE
} from "../config/city";

const featureShortcuts = [
  ["智能导览", "景点导览 · 语音讲解", Navigation, "/map"],
  ["生成行程", "AI定制 · 专属路线", Sparkles, "/plan"],
  ["多语翻译", "入境游客服务", Languages, "/assistant"],
  ["票务预约", "门票 · 演出 · 套餐", Ticket, DEFAULT_TICKET_ROUTE]
] as const;

const serviceItems = ["卫生间", "停车场", "母婴室", "无障碍", "充电宝", "游客中心", "行李寄存", "直通车"];

const assistantHotQuestions = [
  "武汉一日游最佳路线推荐",
  "武汉必吃的本地美食",
  "黄鹤楼门票演示怎么走？",
  "江汉关博物馆怎么去？"
] as const;

const assistantQuickActions = [
  { label: "行程规划", prompt: "请按少排队、适合老人和半日游帮我规划黄鹤楼路线" },
  { label: "景点导览", prompt: "请推荐黄鹤楼、江汉关和湖北省博物馆的导览重点" },
  { label: "票务预约", prompt: "帮我预约黄鹤楼上午票，带老人少排队" },
  { label: "酒店预订", prompt: "黄鹤楼附近有哪些适合家庭出行的酒店和交通建议？" },
  { label: "交通出行", prompt: "从黄鹤楼到江汉关博物馆怎么走，尽量少走路" },
  { label: "美食推荐", prompt: "黄鹤楼附近有什么武汉本地美食，适合亲子和老人" }
] as const;

const mapLayerItems = [
  { label: "景点", icon: Landmark, tone: "green" },
  { label: "卫生间", icon: Toilet, tone: "blue" },
  { label: "母婴室", icon: Baby, tone: "purple" },
  { label: "停车场", icon: ParkingCircle, tone: "cyan" },
  { label: "无障碍设施", icon: Accessibility, tone: "orange" },
  { label: "餐饮", icon: Utensils, tone: "gold" }
] as const;

type MapLayerLabel = (typeof mapLayerItems)[number]["label"];

const immersiveStats = [
  { label: "全景点位", value: "24", desc: "支持楼内外导览", icon: Navigation },
  { label: "讲解内容", value: "68", desc: "故事、典故、建筑", icon: Headphones },
  { label: "互动任务", value: "12", desc: "打卡与收藏成就", icon: Sparkles }
] as const;

const immersiveScenes = [
  {
    name: DEFAULT_TICKET_POI_NAME,
    badge: "5A景区",
    location: "武昌 · 蛇山",
    duration: "45分钟",
    crowd: "舒适",
    image: spotImages.yellowCraneTower,
    summary: "从楼顶观江、名楼故事到蛇山风景，适合首次到访游客快速建立江城文化脉络。",
    tags: ["登楼观江", "历史典故", "AR导览"],
    hotspots: [
      { title: "楼顶观江", desc: "长江视野", x: 47, y: 18 },
      { title: "名楼故事", desc: "历史典故", x: 22, y: 42 },
      { title: "城市复原", desc: "重看江城变迁", x: 76, y: 36 },
      { title: "蛇山风景", desc: "武汉城市地标", x: 36, y: 72 },
      { title: "荆楚文化", desc: "楼阁历史与建筑", x: 70, y: 68 }
    ],
    route: ["楼顶观江", "名楼故事", "城市复原", "荆楚文化"],
    stories: [
      ["观江视野", "看长江、龟蛇锁大江与武昌城景的空间关系。"],
      ["名楼源流", "从诗词、迁建与城市记忆理解黄鹤楼。"],
      ["建筑细节", "识别飞檐、斗拱、彩绘与楼阁形制。"]
    ]
  },
  {
    name: "江汉关博物馆",
    badge: "近代建筑",
    location: "江汉 · 江滩",
    duration: "35分钟",
    crowd: "适中",
    image: spotImages.jianghanGuan,
    summary: "以开埠历史、钟楼建筑和江汉路城市漫游为主线，适合夜游前的轻量文化导览。",
    tags: ["近代城市", "钟楼建筑", "Citywalk"],
    hotspots: [
      { title: "钟楼立面", desc: "建筑细节", x: 44, y: 24 },
      { title: "开埠记忆", desc: "近代城市", x: 22, y: 48 },
      { title: "江汉路口", desc: "Citywalk起点", x: 68, y: 42 },
      { title: "江滩延展", desc: "夜游串联", x: 74, y: 72 }
    ],
    route: ["钟楼立面", "开埠记忆", "城市商业", "江滩延展"],
    stories: [
      ["汉口开埠", "理解近代商业、码头和城市格局形成。"],
      ["钟楼建筑", "快速看懂立面比例与历史符号。"],
      ["江滩夜游", "把博物馆、江汉路和江滩路线串起来。"]
    ]
  },
  {
    name: "湖北省博物馆",
    badge: "文化深读",
    location: "武昌 · 东湖",
    duration: "60分钟",
    crowd: "较少",
    image: spotImages.hubeiMuseum,
    summary: "围绕楚文化、青铜器与编钟体验组织讲解，适合亲子家庭和文化深度游用户。",
    tags: ["楚文化", "馆藏重点", "亲子友好"],
    hotspots: [
      { title: "楚文化导览", desc: "核心展陈", x: 34, y: 26 },
      { title: "编钟体验", desc: "声音互动", x: 62, y: 30 },
      { title: "青铜器", desc: "器物故事", x: 25, y: 62 },
      { title: "亲子路线", desc: "低强度参观", x: 70, y: 68 }
    ],
    route: ["楚文化导览", "编钟体验", "青铜器", "亲子路线"],
    stories: [
      ["曾侯乙编钟", "用声音互动理解礼乐文化。"],
      ["楚文化线索", "把展厅内容串成可记忆的参观路径。"],
      ["亲子任务", "用问答和打卡降低展陈理解门槛。"]
    ]
  },
  {
    name: "汉口江滩夜游",
    badge: "夜游推荐",
    location: "汉口 · 江滩",
    duration: "40分钟",
    crowd: "舒适",
    image: spotImages.hankouRiverfront,
    summary: "以灯光、江景、码头和城市天际线为体验核心，适合晚间散步、拍照和套餐联动。",
    tags: ["夜景", "拍照", "商旅联动"],
    hotspots: [
      { title: "江滩灯光", desc: "夜景主视角", x: 38, y: 22 },
      { title: "观江台", desc: "拍照点", x: 58, y: 36 },
      { title: "码头记忆", desc: "城市故事", x: 24, y: 66 },
      { title: "餐饮联动", desc: "夜宵推荐", x: 72, y: 70 }
    ],
    route: ["江滩灯光", "观江台", "码头记忆", "餐饮联动"],
    stories: [
      ["江景机位", "给出夜景拍摄角度和步行动线。"],
      ["码头记忆", "补充汉口商业与江运故事。"],
      ["夜游套餐", "联动餐饮、酒店和返程提醒。"]
    ]
  }
] as const;

const ticketUseSteps = [
  {
    title: "提交订单",
    desc: "确认票种、日期、时段与数量，系统会先为你锁定库存。",
    note: "请在倒计时内完成支付",
    icon: ShoppingBag
  },
  {
    title: "获取凭证",
    desc: "支付成功后生成电子二维码，并同步到订单详情与我的行程。",
    note: "支持二维码或身份证核验",
    icon: PackageCheck
  },
  {
    title: "扫码入园",
    desc: "按预约时段到达景区入口，出示凭证即可核销入园。",
    note: "建议提前 15 分钟到达",
    icon: QrCode
  },
  {
    title: "快乐游玩",
    desc: "入园后可继续使用导览、讲解、路线与周边推荐服务。",
    note: "退改规则可在订单详情查看",
    icon: Sparkles
  }
] as const;

const ticketHeroFacts = [
  { label: "游客评分", value: "4.8", desc: "12,856 条评价", icon: Star },
  { label: "开放时间", value: "08:00-17:30", desc: "建议提前 15 分钟到达", icon: Clock3 },
  { label: "演示票价", value: "￥40 起", desc: "sandbox 库存，不代表真实出票", icon: Ticket }
] as const;

type OpeningPeriodSummary = {
  label: string;
  time: string;
  meta: string;
};

function summarizeOpeningHours(openingHours?: string): { periods: OpeningPeriodSummary[]; notice: string } {
  const source = openingHours?.replace(/\s+/g, " ").trim();

  if (!source) {
    return {
      periods: [{ label: "开放信息", time: "以官方公告为准", meta: "建议出发前再次确认" }],
      notice: "开放、售票与入园时间以景区官方公告为准。"
    };
  }

  const readPeriod = (label: "日场" | "夜场") => {
    const time = source.match(new RegExp(`${label}[^；;。]*?(\\d{1,2}:\\d{2})\\s*[-–—至到]\\s*(\\d{1,2}:\\d{2})`));
    if (!time) return undefined;

    const sale = source.match(new RegExp(`${label}[^；;。]*?最晚售票\\s*(\\d{1,2}:\\d{2})`));
    const entry = source.match(new RegExp(`${label}[^；;。]*?最晚(?:进入|入园)\\s*(\\d{1,2}:\\d{2})`));
    const meta = [
      sale ? `售票至 ${sale[1]}` : undefined,
      entry ? `入园至 ${entry[1]}` : undefined
    ].filter(Boolean).join(" / ");

    return {
      label,
      time: `${time[1]}-${time[2]}`,
      meta: meta || "以现场公告为准"
    };
  };

  const periods = [readPeriod("日场"), readPeriod("夜场")].filter(Boolean) as OpeningPeriodSummary[];

  if (!periods.length) {
    const chunks = source.split(/[；;]/).map((item) => item.trim()).filter(Boolean).slice(0, 2);
    return {
      periods: chunks.length ? chunks.map((chunk, index) => ({
        label: index === 0 ? "开放" : "补充",
        time: chunk.match(/\d{1,2}:\d{2}\s*[-–—至到,，]\s*\d{1,2}:\d{2}/)?.[0] ?? chunk.slice(0, 18),
        meta: "出发前再次确认"
      })) : [{ label: "开放信息", time: source.slice(0, 18), meta: "出发前再次确认" }],
      notice: "具体开放日期、节假日安排和入园规则以官方公告为准。"
    };
  }

  return {
    periods,
    notice: source.includes("门票不互通")
      ? "日场与夜场门票不互通，请按入园时段购买对应票种。"
      : "开放、售票与入园时间以景区官方公告为准。"
  };
}

function splitSuitableGroups(suitableFor?: string) {
  return (suitableFor ?? "历史文化爱好者 / 城市地标打卡 / 亲子家庭 / 摄影爱好者")
    .split(/[\/、，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

const tripTimelineItems = [
  { date: monthDay(todayISO()), time: "09:00", place: "武汉站", desc: "高铁到达，行李寄存已提醒", status: "已出票", tone: "green" },
  { date: monthDay(todayISO()), time: "10:15", place: "黄鹤楼", desc: "sandbox 票务演示预约", status: "已预约", tone: "gold" },
  { date: monthDay(todayISO()), time: "15:30", place: "江汉关博物馆", desc: "与江汉路 Citywalk 串联", status: "已加入", tone: "blue" },
  { date: monthDay(addDaysISO(2)), time: "15:20", place: "汉口站", desc: "返程车票与提醒已同步", status: "已出票", tone: "green" }
] as const;

export function HomePage() {
  return (
    <>
      <section className="hero home-hero" style={{ "--hero-image": `url(${heroImage})` } as React.CSSProperties}>
        <div className="home-hero-grid">
          <div className="hero-content hero-left home-hero-content">
            <span className="hero-eyebrow">{BRAND_HERO_EYEBROW}</span>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              {BRAND_NAME}
            </motion.h1>
            <p className="hero-lead">{DEFAULT_CITY_NAME}城市级智慧文旅服务平台，把 AI 咨询、票务演示、智能导览、行程规划与运营调度连成一条可信赖的服务链路。</p>
            <div className="home-command">
              <div className="search-pill">
                <Sparkles color="var(--green)" />
                <input aria-label="AI 文旅问答入口" placeholder="问问今天怎么玩、怎么走、订什么..." />
                <Link className="icon-btn" to="/assistant" aria-label="进入 AI 旅行助手"><Navigation size={19} /></Link>
              </div>
              <div className="home-trust-row">
                {["sandbox票务", "实时客流", "多语服务", "运营联动"].map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          </div>
          <div className="home-action-board" aria-label="核心功能入口">
            <div className="home-action-board-head">
              <span>Core Services</span>
              <strong>一站式文旅服务</strong>
            </div>
            {featureShortcuts.map(([title, desc, Icon, path], index) => (
              <Link className="home-action" key={title} to={path}>
                <span className="home-action-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="home-action-icon"><Icon size={21} /></span>
                <span className="home-action-copy">
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
              </Link>
            ))}
          </div>
          <div className="hero-kpis">
            {cityStats.map((item) => (
              <div className="hero-kpi" key={item.label}>
                <span className="muted">{item.label}</span>
                <b>{item.value}</b>
                <small>{item.hint}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="container home-stack grid" style={{ gap: 18 }}>
        <div className="split">
          <Section title="今日推荐" subtitle="结合天气、客流、库存与偏好重排" className="feature-section" action={<Link className="subtle-link" to="/recommend">查看更多</Link>}>
            <div className="grid grid-2">
              {scenicSpots.slice(0, 4).map((spot) => <SpotCard key={spot.name} spot={spot} compact />)}
            </div>
          </Section>
          <Section title="AI旅行助手" subtitle="可解释、可修改、可确认" className="assistant-preview">
            <div className="grid">
              {["推荐好玩好去处", "规划专属行程路线", "查询交通与天气", "预订门票与服务"].map((item) => (
                <div className="reason-row" key={item}>
                  <span><CheckCircle2 size={15} /></span>
                  <div><strong>{item}</strong><p className="muted">工具调用、来源与库存状态同步展示。</p></div>
                </div>
              ))}
              <Link className="primary-btn" to="/assistant">开始问 AI</Link>
            </div>
          </Section>
        </div>
        <div className="grid grid-3 home-service-grid">
          <Section title="热门路线" subtitle="路线含距离、交通和拥堵提示">
            {[
              ["黄鹤楼经典一日游", "约 7.8 公里，步行+地铁", "人少舒适"],
              ["江汉关近代城市线", "江汉关 + 江滩 + 夜市", "夜景推荐"],
              ["博物馆亲子路线", "湖北省博物馆 + 武汉博物馆", "舒适"]
            ].map(([line, desc, tag]) => (
              <div className="reason-row" key={line}>
                <span><Navigation size={15} /></span>
                <div><strong>{line}</strong><p className="muted">{desc}</p><StatusTag tone={tag === "夜景推荐" ? "purple" : "green"}>{tag}</StatusTag></div>
              </div>
            ))}
          </Section>
          <Section title="景区服务" subtitle="地图式设施搜索">
            <div className="grid grid-2">
              {serviceItems.map((item) => <button className="ghost-btn" key={item}>{item}</button>)}
            </div>
          </Section>
          <Section title="演出/赛事联动" subtitle="票务后自动推荐餐饮酒店">
            {["黄鹤楼夜间导览演示", "武汉江滩音乐活动", "武汉主场赛事联动"].map((item) => (
              <div className="spot-card compact" key={item}>
                <img src={spotImages.jianghanGuan} alt={item} />
                <div><strong>{item}</strong><p className="muted">含夜游、接驳与餐饮券</p><Link className="primary-btn" to="/packages">查看套餐</Link></div>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </>
  );
}

export function AssistantPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("文本提问");
  const [latestPrompt, setLatestPrompt] = useState("initial-demo");
  const [latestAgent, setLatestAgent] = useState<AiResponse | undefined>();
  const [promptRequest, setPromptRequest] = useState<AIChatPromptRequest | undefined>();
  const handleAgentResult = useCallback((result: AiResponse, prompt: string) => {
    setLatestPrompt(prompt);
    setLatestAgent(result);
    // Hand the resolved stops to the map page (智能导览) so the planned
    // tour survives navigation.
    if (result.mapStops && result.mapStops.length >= 2) {
      saveTourIntent({ source: "assistant", label: prompt, stops: result.mapStops });
    }
  }, []);
  const openTourInMap = useCallback(() => {
    triggerOperation({ scope: "visitor", type: "assistant.open_map", label: "在导览中查看", metadata: { prompt: latestPrompt } });
    navigate("/map");
  }, [latestPrompt, navigate]);
  const runAssistantPrompt = useCallback((prompt: string) => {
    setLatestPrompt(prompt);
    setPromptRequest({ id: Date.now(), text: prompt, autoSubmit: true });
    triggerOperation({ scope: "visitor", type: "assistant.quick_prompt", label: "快捷提问", metadata: { prompt } });
  }, []);
  const toolCalls = latestAgent?.toolCalls ?? [];
  const latestCards = latestAgent?.cards ?? [];
  const confidence = latestAgent ? `${(latestAgent.confidence * 100).toFixed(0)}%` : "待生成";
  return (
    <div className="container wide-split assistant-layout">
      <div style={{ gridColumn: "1 / -1" }}>
        <PageHeader title="AI旅行助手" subtitle="文本、语音、拍照识别与菜单翻译统一入口，展示工具调用状态与可执行推荐卡片" />
      </div>
      <aside className="grid assist-rail">
        <Section title="AI旅行助手" subtitle="多模态问答" className="rail-section">
          <div className="assistant-mode-grid">
            {[
              ["文本提问", Sparkles],
              ["语音问答", Mic],
              ["拍照识别", Camera],
              ["菜单翻译", Utensils],
              ["交通出行", Train],
              ["实时天气", Bell]
            ].map(([label, Icon]) => (
              <button className={`${mode === label ? "primary-btn" : "ghost-btn"} mode-button`} onClick={() => setMode(label as string)} key={label as string}>
                <Icon size={18} />{label as string}
              </button>
            ))}
          </div>
        </Section>
        <Section title="我的行程" className="rail-section" action={<DemoDataBadge />}>
          <strong>武汉文化深度游</strong>
          <p className="muted">3 个景点、2 个活动，已保存至 {todayISO()}</p>
          <Link className="ghost-btn" to="/me">查看行程</Link>
        </Section>
      </aside>
      <main className="assistant-main">
        <AIChat
          onResult={handleAgentResult}
          promptRequest={promptRequest}
          onPromptRequestConsumed={() => setPromptRequest(undefined)}
        />
      </main>
      <aside className="grid assist-rail">
        <Section title="热门问题" className="rail-section" action={<button className="ghost-btn">换一换</button>}>
          {assistantHotQuestions.map((q) => (
            <button className="ghost-btn rail-prompt-btn" key={q} onClick={() => runAssistantPrompt(q)}>
              {q}
            </button>
          ))}
        </Section>
        <Section title="快捷操作" className="rail-section">
          <div className="assistant-action-grid">
            {assistantQuickActions.map((item) => <button className="ghost-btn" key={item.label} onClick={() => runAssistantPrompt(item.prompt)}>{item.label}</button>)}
          </div>
        </Section>
        <Section title="Agent 实时状态" className="rail-section">
          <div className="agent-status-head">
            <StatusTag tone={latestAgent ? "green" : "orange"}>置信 {confidence}</StatusTag>
            <span className="agent-status-question" title={latestPrompt === "initial-demo" ? "演示初始消息" : latestPrompt}>
              {latestPrompt === "initial-demo" ? "演示初始消息" : latestPrompt}
            </span>
          </div>
          <div className="agent-status-list">
            {toolCalls.length ? toolCalls.map((tool, toolIndex) => (
              <div className={`agent-status-row ${tool.status}`} key={`${tool.name}-${toolIndex}`}>
                <span className="agent-status-dot" aria-hidden="true" />
                <div className="agent-status-copy">
                  <strong>
                    {tool.name}
                    <em>{tool.status === "success" ? "完成" : tool.status === "failed" ? "失败" : "跳过"}</em>
                  </strong>
                  <small title={tool.summary}>{tool.summary}</small>
                </div>
              </div>
            )) : <p className="muted">发送问题后会展示 POI、路线、天气和票务候选工具调用状态。</p>}
          </div>
          {latestAgent?.sourceNote ? (
            <details className="agent-source-note">
              <summary>数据来源与免责说明</summary>
              <p>{latestAgent.sourceNote}</p>
            </details>
          ) : null}
        </Section>
        {latestCards.length ? (
          <Section title="可执行推荐" className="rail-section">
            <div className="rail-reco-list">
              {(latestAgent?.mapStops?.length ?? 0) >= 2 ? (
                <>
                  <button className="primary-btn rail-map-btn" onClick={openTourInMap} type="button">
                    <MapPin size={15} /> 在智能导览中查看（{latestAgent!.mapStops!.length} 个地点）
                  </button>
                  <button className="ghost-btn rail-map-btn" onClick={() => { triggerOperation({ scope: "visitor", type: "assistant.open_plan", label: "生成行程规划", metadata: { prompt: latestPrompt } }); navigate("/plan"); }} type="button">
                    <CalendarCheck size={15} /> 用这些地点生成行程
                  </button>
                </>
              ) : null}
              {latestCards.slice(0, 3).map((card) => (
                <Link className="rail-reco-card" key={card.id} to={card.href ?? "/plan"}>
                  <span className="rail-reco-copy">
                    <strong title={card.title}>{card.title}</strong>
                    <small title={card.subtitle}>{card.subtitle}</small>
                  </span>
                  {card.actionLabel ? <span className="rail-reco-action">{card.actionLabel}</span> : null}
                </Link>
              ))}
            </div>
          </Section>
        ) : null}
      </aside>
    </div>
  );
}

export function RecommendPage() {
  const [filter, setFilter] = useState<RecommendationFilter>("全部推荐");
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPois({ cityId: DEFAULT_CITY_ID, limit: 100 })
      .then((items) => {
        if (!alive) return;
        setPois(items);
        setError(items.length ? "" : "没有找到真实 POI，请稍后再试。");
      })
      .catch(() => {
        if (alive) setError("真实 POI 服务暂不可用，已保留演示推荐。");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredPois = useMemo(() => filterRecommendedPois(pois, filter).slice(0, 10), [filter, pois]);
  const filtered = filteredPois.length ? filteredPois.map(poiToScenicSpot) : filter === "美食" ? foods : scenicSpots;
  const hasFilteredPois = filteredPois.length > 0;
  const filterHint = filter === "全部推荐" ? "全部真实 POI 按评分排序" : `已按「${filter}」重排推荐结果`;
  return (
    <div className="container split recommend-layout">
      <main className="grid">
        <div className="dashboard-title">
          <div>
            <h1>个性化推荐</h1>
            <p className="muted">基于你的偏好与实时情境，为你筛选最合适的{DEFAULT_CITY_NAME}文旅体验</p>
          </div>
          <div className="filters">
            {recommendationFilters.map((item) => (
              <button className={filter === item ? "primary-btn" : "ghost-btn"} onClick={() => setFilter(item)} key={item}>{item}</button>
            ))}
          </div>
        </div>
        <Section title={`为你找到 ${loading ? "..." : filtered.length} 个推荐`} className="recommend-results-section" action={<StatusTag tone="blue">{hasFilteredPois ? "真实 POI + 演示情境" : "fallback/demo"}</StatusTag>}>
          <p className="muted">{filterHint}</p>
          {error ? <p className="muted">{error}</p> : null}
          {!loading && pois.length > 0 && !hasFilteredPois ? <p className="muted">当前筛选暂无真实 POI 命中，先展示演示推荐。</p> : null}
          <div className="recommend-results-grid">
            {filtered.map((item) => "crowd" in item ? <SpotCard key={item.name} spot={item} /> : (
              <article className="card spot-card" key={item.name}>
                <img src={item.image} alt={item.name} />
                <div>
                  <div className="spot-head"><h3>{item.name}</h3><span className="rating">★ {item.rating}</span></div>
                  <div className="filters tiny-gap">{item.tags.map((tag) => <StatusTag key={tag} tone="slate">{tag}</StatusTag>)}<StatusTag tone="orange">人均 ￥{item.price}</StatusTag></div>
                  <p className="reason">为什么推荐你：{item.reason}</p>
                  <Link className="primary-btn" to={DEFAULT_TICKET_ROUTE}>立即预订</Link>
                </div>
              </article>
            ))}
          </div>
        </Section>
        <Section title="推荐策略透明度" subtitle="展示 AI 辅助决策依据，而不是只给列表">
          <div className="grid grid-3">
            {["偏好匹配 92%", "拥堵风险低", "库存可预约", "天气适配", "同行人友好", "距当前位置近"].map((item) => (
              <div className="empty-state" key={item}><Sparkles color="var(--blue)" /><strong>{item}</strong></div>
            ))}
          </div>
        </Section>
      </main>
      <aside className="grid recommend-aside">
        <Section title="我的偏好" className="preference-panel">
          <div className="preference-card">
            <div className="preference-identity">
              <span className="preference-avatar">雨</span>
              <div>
                <span className="preference-kicker">旅行画像</span>
                <h2>张小雨</h2>
                <StatusTag tone="gold">Lv.5 资深旅行家</StatusTag>
              </div>
            </div>
            <div className="preference-metrics" aria-label="偏好概览">
              {[
                ["92%", "偏好匹配"],
                ["4", "核心标签"],
                ["低", "排队偏好"]
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="preference-tags">
              {["文化体验", "历史古迹", "美食爱好者", "亲子出游"].map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <button className="ghost-btn"><Sparkles size={16} />编辑偏好</button>
          </div>
        </Section>
        <Section title="当前位置与天气" className="weather-panel">
          <div className="weather-hero">
            <div>
              <span className="weather-location"><MapPin size={15} />当前位置</span>
              <h2>{DEFAULT_CITY_NAME} · 武昌区</h2>
              <p className="muted">蛇山-黄鹤楼片区 · 更新于 05:20</p>
            </div>
            <div className="weather-temp">
              <strong>26°</strong>
              <span>晴</span>
            </div>
          </div>
          <div className="filters tiny-gap">
            <StatusTag tone="orange">体感 28℃</StatusTag>
            <StatusTag tone="green">空气优 AQI 32</StatusTag>
            <StatusTag tone="blue">适合户外步行</StatusTag>
          </div>
          <div className="weather-metric-grid">
            {[
              ["湿度", "62%", "体感略闷"],
              ["东南风", "2级", "江边微风"],
              ["降水概率", "12%", "无需雨具"],
              ["紫外线", "中等", "建议防晒"],
              ["能见度", "12 km", "适合远眺"],
              ["舒适度", "82/100", "步行友好"]
            ].map(([label, value, hint]) => (
              <div className="weather-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{hint}</small>
              </div>
            ))}
          </div>
          <div className="weather-route-advice">
            {[
              ["上午", "登楼观江", "光线清晰，客流相对平稳"],
              ["午后", "博物馆/室内", "避开日晒与热门点高峰"],
              ["傍晚", "江滩漫步", "风力舒适，适合拍照"]
            ].map(([time, title, desc]) => (
              <div key={time}>
                <span>{time}</span>
                <strong>{title}</strong>
                <small>{desc}</small>
              </div>
            ))}
          </div>
          <div className="weather-alert">
            <ShieldCheck size={16} />
            <p><strong>AI 建议：</strong>今日优先安排黄鹤楼、蛇山步道与江滩线；儿童和老人建议每 45 分钟安排一次休息点。</p>
          </div>
        </Section>
        <RecommendReasonCard />
      </aside>
    </div>
  );
}

function buildClientFallbackPlan(days: number, walking: string): GeneratedItineraryResponse {
  const boundedDays = Math.min(5, Math.max(1, days));
  const items = Array.from({ length: boundedDays }).flatMap((_, index) => {
    const day = `Day ${index + 1}`;
    const source = timelineDays[day] ?? timelineDays[`Day ${((index % 3) + 1)}`] ?? timelineDays["Day 1"];
    return (source ?? []).map((item) => ({ ...item, day, note: "前端兜底行程" }));
  });
  const totalPerPerson = 1600 + boundedDays * 360 + (walking === "挑战" ? 120 : 0);
  return {
    cityId: DEFAULT_CITY_ID,
    days: boundedDays,
    nights: Math.max(boundedDays - 1, 0),
    title: `${DEFAULT_CITY_NAME} ${boundedDays}日${Math.max(boundedDays - 1, 0)}晚 文化深度游`,
    preferences: ["历史文化", "亲子游", walking],
    summary: [`可步行比例 ${walking === "轻松" ? 72 : walking === "挑战" ? 58 : 64}%`, "热门点错峰 3 处", `亲子休息点 ${boundedDays + 2} 个`, "票务可预约 4 项"],
    reasons: ["当前为前端兜底行程；点击立即生成行程后由服务端 Itinerary Agent 重新编排。", "兜底数据仅用于页面初始展示，不代表已完成 agent 生成。"],
    constraints: [
      { label: "出行天数", value: `${boundedDays}天`, status: "提醒", tone: "orange" },
      { label: "预算", value: `约 ￥${totalPerPerson.toLocaleString()} / 人`, status: totalPerPerson <= 3000 ? "通过" : "提醒", tone: totalPerPerson <= 3000 ? "green" : "orange" },
      { label: "同行", value: "2 位成人 · 1 位儿童", status: "通过", tone: "green" },
      { label: "步行强度", value: walking, status: "通过", tone: "green" }
    ],
    budget: {
      totalPerPerson,
      days: boundedDays,
      breakdown: [
        { name: "住宿", value: 44, fill: "#6fa88a" },
        { name: "门票", value: 24, fill: "#d8b96a" },
        { name: "餐饮", value: 20, fill: "#c9975d" },
        { name: "交通", value: 12, fill: "#7ba7c8" }
      ]
    },
    items,
    sourceNote: "前端兜底行程，等待服务端 Itinerary Agent 生成。",
    toolCalls: [
      { name: "Itinerary Agent", status: "skipped", summary: "尚未触发服务端生成" }
    ]
  };
}

function groupItineraryItems(items: GeneratedItineraryResponse["items"]) {
  return items.reduce<Record<string, TimelineItem[]>>((groups, item) => {
    const { day, poiId: _poiId, note: _note, ...timelineItem } = item;
    groups[day] = [...(groups[day] ?? []), timelineItem];
    return groups;
  }, {});
}

const PLAN_INTEREST_OPTIONS = ["历史文化", "自然风光", "美食体验", "亲子游", "拍照打卡"];

export function PlanPage() {
  const navigate = useNavigate();
  const [day, setDay] = useState("Day 1");
  const [tripDays, setTripDays] = useState(3);
  const [walking, setWalking] = useState("适中");
  const [interests, setInterests] = useState<string[]>(["历史文化", "亲子游"]);
  // Stops handed over from the AI assistant (or the map page) anchor the
  // generated plan until the visitor dismisses them.
  const [planIntent, setPlanIntent] = useState(() => {
    const intent = readTourIntent();
    return intent?.source === "assistant" ? intent : undefined;
  });
  const [generatedMessage, setGeneratedMessage] = useState("正在准备服务端 Itinerary Agent...");
  const [plan, setPlan] = useState<GeneratedItineraryResponse>(() => buildClientFallbackPlan(3, "适中"));
  const planDays = useMemo(() => groupItineraryItems(plan.items), [plan.items]);
  const visibleDays = useMemo(() => Array.from({ length: tripDays }, (_, index) => `Day ${index + 1}`), [tripDays]);
  const updateTripDays = (next: number) => {
    const bounded = Math.min(5, Math.max(1, next));
    setTripDays(bounded);
    setPlan(buildClientFallbackPlan(bounded, walking));
    setGeneratedMessage("出行天数已调整，请点击「立即生成行程」刷新服务端 Agent 方案。");
    const currentDayNumber = Number(day.replace("Day ", ""));
    if (currentDayNumber > bounded) {
      setDay(`Day ${bounded}`);
    }
  };
  const updateWalking = (next: string) => {
    setWalking(next);
    setPlan(buildClientFallbackPlan(tripDays, next));
    setGeneratedMessage("步行强度已调整，请点击「立即生成行程」刷新服务端 Agent 方案。");
  };
  const toggleInterest = (interest: string) => {
    setInterests((current) => current.includes(interest)
      ? current.filter((item) => item !== interest)
      : [...current, interest]);
    setGeneratedMessage("兴趣偏好已调整，请点击「立即生成行程」刷新服务端 Agent 方案。");
  };
  const generatePlan = async (options?: { intent?: ReturnType<typeof readTourIntent> }) => {
    const intent = options?.intent !== undefined ? options.intent : planIntent;
    setGeneratedMessage(intent
      ? `正在基于 AI 助手的 ${intent.stops.length} 个推荐地点编排行程...`
      : "正在调用服务端 Itinerary Agent：POI 编排、路线、天气、票务候选...");
    try {
      const result = await generateItinerary({
        cityId: DEFAULT_CITY_ID,
        days: tripDays,
        preferences: [...interests, walking],
        stops: intent?.stops
      });
      setPlan(result);
      setTripDays(result.days);
      setDay("Day 1");
      setGeneratedMessage(`Agent 已生成 ${result.days} 天 ${result.items.length} 个日程节点：${result.sourceNote}`);
      // Persist the final plan stops so the map page (智能导览) can render
      // exactly this itinerary, day by day for multi-day plans.
      if (result.mapStops && result.mapStops.length >= 2) {
        saveTourIntent({
          source: "itinerary",
          label: result.title,
          stops: result.mapStopsByDay?.[0]?.stops ?? result.mapStops,
          days: result.mapStopsByDay
        });
      }
    } catch (error) {
      setGeneratedMessage(error instanceof Error ? `服务端生成失败：${error.message}` : "服务端生成失败。");
    }
  };
  const dismissPlanIntent = () => {
    setPlanIntent(undefined);
    setGeneratedMessage("已脱离 AI 助手推荐地点，点击「立即生成行程」按偏好重新编排。");
  };
  useEffect(() => {
    void generatePlan();
    // 初次进入页面即拉取服务端 agent 方案；后续参数调整由用户点击按钮触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const activeTimeline = planDays[day] ?? planDays["Day 1"] ?? [];
  return (
    <div className="container wide-split plan-layout">
      <div style={{ gridColumn: "1 / -1" }}>
        <PageHeader title={`${DEFAULT_CITY_NAME}${tripDays}日游智能规划`} subtitle="结合天气、营业时间、交通时长、票务演示库存与同行偏好生成可执行行程" />
      </div>
      <aside className="card card-pad planner-panel">
        <div className="section-title"><h2>行程设置</h2><button className="subtle-link" onClick={() => { setTripDays(3); setDay("Day 1"); setWalking("适中"); setInterests(["历史文化", "亲子游"]); setGeneratedMessage("行程设置已重置。"); }}>清空</button></div>
        {planIntent ? (
          <div className="map-intent-banner">
            <div className="map-intent-copy">
              <strong>基于 AI 助手的 {planIntent.stops.length} 个推荐地点</strong>
              <small title={planIntent.label}>{planIntent.label}</small>
            </div>
            <button className="map-intent-close" onClick={dismissPlanIntent} type="button">改用偏好</button>
          </div>
        ) : null}
        <div className="step-title"><span>1</span><strong>出行天数</strong></div>
        <div className="filters"><button className="ghost-btn" onClick={() => updateTripDays(tripDays - 1)} disabled={tripDays <= 1}>-</button><button className="field">{tripDays} 天</button><button className="ghost-btn" onClick={() => updateTripDays(tripDays + 1)} disabled={tripDays >= 5}>+</button></div>
        <div className="step-title"><span>2</span><strong>预算（人均）</strong></div>
        <div className="grid grid-2 planner-value-grid"><div className="field planner-value-field">￥2000</div><div className="field planner-value-field">￥3000</div></div>
        <div className="step-title"><span>3</span><strong>同行人</strong></div>
        <div className="field planner-value-field planner-people-field">2 位成人 · 1 位儿童</div>
        <div className="step-title"><span>4</span><strong>兴趣偏好（可多选）</strong></div>
        <div className="filters">{PLAN_INTEREST_OPTIONS.map((interest) => (
          <button
            className={interests.includes(interest) ? "primary-btn" : "ghost-btn"}
            key={interest}
            onClick={() => toggleInterest(interest)}
            type="button"
          >
            {interest}
          </button>
        ))}</div>
        <div className="step-title"><span>5</span><strong>步行强度</strong></div>
        <div className="filters">{["轻松", "适中", "挑战"].map((item) => <button className={walking === item ? "primary-btn" : "ghost-btn"} onClick={() => updateWalking(item)} key={item}>{item}</button>)}</div>
        <button className="primary-btn" style={{ width: "100%", marginTop: 20 }} onClick={() => void generatePlan()}><Sparkles size={17} /> 立即生成行程</button>
        {generatedMessage ? <p className="muted">{generatedMessage}</p> : null}
      </aside>
      <main className="grid">
        <Section
          title={plan.title}
          subtitle={`服务端 Agent 生成 · ${plan.sourceNote}`}
          action={<div className="filters">
            {(plan.mapStops?.length ?? 0) >= 2 ? (
              <button className="primary-btn" onClick={() => navigate("/map")} type="button"><MapPin size={16} />在导览中查看</button>
            ) : null}
            <button className="ghost-btn" onClick={() => void generatePlan()}><RefreshCcw size={16} />重新生成</button>
          </div>}
        >
          <div className="planner-summary-strip">
            {plan.summary.map((item) => <span key={item}>{item}</span>)}
          </div>
          <div className="filters" style={{ marginBottom: 14 }}>
            {visibleDays.map((d) => <button key={d} onClick={() => setDay(d)} className={day === d ? "primary-btn" : "ghost-btn"}>{d}</button>)}
            <StatusTag tone="green">20-28℃ 空气优</StatusTag>
          </div>
          <Timeline items={activeTimeline} />
        </Section>
      </main>
      <aside className="grid">
        <Section title="推荐理由" className="decision-panel">
          {plan.reasons.map((reason) => <p key={reason}><CheckCircle2 color="var(--green)" size={16} /> {reason}</p>)}
        </Section>
        <Section title="约束条件已满足" className="decision-panel">
          {plan.constraints.map((item) => <p key={`${item.label}-${item.value}`}><StatusTag tone={item.tone}>{item.status}</StatusTag> {item.label}：{item.value}</p>)}
        </Section>
        <Section title="预计费用（人均）" className="budget-panel">
          <h2 style={{ color: "var(--green)", margin: 0 }}>￥{plan.budget.totalPerPerson.toLocaleString()} <small>/{plan.budget.days}天</small></h2>
          <Donut data={plan.budget.breakdown} />
          <Link className="primary-btn" to="/packages" style={{ width: "100%" }}>一键预订景点门票 + 酒店 + 交通</Link>
        </Section>
      </aside>
    </div>
  );
}

export function SpotDetailPage() {
  const tabs = ["景点概览", "票务信息", "游览指南", "周边推荐", "用户评价", "常见问题"];
  const [tab, setTab] = useState(tabs[0]);
  const [poi, setPoi] = useState<Poi | undefined>();
  const [nearby, setNearby] = useState<Poi[]>([]);
  const [audioNotice, setAudioNotice] = useState("");

  useEffect(() => {
    fetchPoi(DEFAULT_TICKET_REAL_POI_ID).then(setPoi);
    fetchPois({ cityId: DEFAULT_CITY_ID, category: "景点", limit: 5 }).then(setNearby);
  }, []);

  const detail = poi ? poiToScenicSpot(poi) : scenicSpots[0];
  const openingSummary = summarizeOpeningHours(poi?.openingHours);
  const suitableGroups = splitSuitableGroups(poi?.suitableFor);
  const crowdTone = detail.crowd === "舒适" || detail.crowd === "较少" ? "green" : detail.crowd === "适中" ? "orange" : "red";
  const overviewItems = [
    { label: "数据来源", value: poi?.source?.provider ?? "fallback/demo" },
    { label: "所属城市", value: DEFAULT_CITY_OFFICIAL_NAME },
    { label: "坐标系", value: poi?.coordinateSystem ?? "GCJ-02" },
    { label: "地址", value: poi?.address ?? "武汉市武昌区蛇山西山坡特1号", wide: true }
  ];
  const startAudioGuide = (label: string) => {
    setAudioNotice(`${label}已进入演示播放队列：当前为本地讲解文案与音频入口，不调用真实第三方语音服务。`);
    triggerOperation({ scope: "visitor", type: "guide.audio", label, metadata: { poi: detail.name } });
  };
  return (
    <div className="container grid spot-detail-page">
      <div className="split spot-detail-intro">
        <section className="hero spot-detail-hero" style={{ margin: 0, borderRadius: 8, "--hero-image": `url(${detail.image})` } as React.CSSProperties}>
          <div className="hero-content hero-left spot-detail-hero-copy">
            <div className="filters">{detail.tags.slice(0, 3).map((tag) => <StatusTag key={tag} tone={tag.includes("国家") ? "green" : "slate"}>{tag}</StatusTag>)}</div>
            <h1>{detail.name}</h1>
            <p>{poi?.description ?? "江南三大名楼之一，适合登楼远眺长江、了解荆楚文化与武汉城市地标故事。"}</p>
            <div className="filters spot-detail-actions">
              <Link className="primary-btn" to="/plan">加入行程</Link>
              <Link className="primary-btn" to={DEFAULT_TICKET_ROUTE}>立即预约</Link>
              <button className="ghost-btn" onClick={() => startAudioGuide("语音导览")}><Headphones size={16} />语音导览</button>
            </div>
          </div>
        </section>
        <aside className="card card-pad spot-overview-card">
          <div className="spot-overview-head">
            <span>景点概览</span>
            <h2>{detail.name}</h2>
            <p>{detail.tags.slice(0, 2).join(" · ") || "城市文旅点位"}</p>
          </div>
          <dl className="spot-overview-grid">
            {overviewItems.map((item) => (
              <div className={item.wide ? "wide" : undefined} key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="spot-overview-map">
            <MapPanel compact scenic pois={poi ? [poi] : []} />
          </div>
        </aside>
      </div>
      <div className="tab-strip">
        {tabs.map((item) => <button className={tab === item ? "primary-btn" : "ghost-btn"} key={item} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="grid spot-detail-facts">
        <Section title="开放时间" subtitle="日场、夜场分开入园" className="spot-fact-card spot-opening-card">
          <div className="opening-summary">
            {openingSummary.periods.map((period) => (
              <div className="opening-period" key={period.label}>
                <span>{period.label}</span>
                <strong>{period.time}</strong>
                <small>{period.meta}</small>
              </div>
            ))}
          </div>
          <p className="spot-note">{openingSummary.notice}</p>
          <div className="spot-fact-footer">
            <StatusTag tone={crowdTone}>当前客流 {detail.crowd}</StatusTag>
            <span>建议提前 15 分钟到达入口</span>
          </div>
        </Section>
        <Section title="建议游玩时长" className="spot-fact-card spot-duration-card">
          <div className="fact-metric">
            <strong>{poi?.suggestedDuration ?? detail.duration ?? "2-3 小时"}</strong>
            <span>登楼观景 + 文化展陈</span>
          </div>
          <p className="muted">深度游览可按体力、天气和排队情况弹性调整。</p>
        </Section>
        <Section title="适合人群" className="spot-fact-card spot-audience-card">
          <div className="audience-chip-list">
            {suitableGroups.map((group) => <StatusTag key={group} tone="slate">{group}</StatusTag>)}
          </div>
          <p className="muted">偏轻量城市观光，适合与周边 Citywalk 或江滩路线串联。</p>
        </Section>
        <Section title="AI讲解" className="spot-fact-card spot-audio-card">
          <p>已生成 3 段主题音频，覆盖名楼故事、长江与武汉、荆楚文化。</p>
          <div className="audio-topic-list">
            {["名楼故事", "长江武汉", "荆楚文化"].map((topic) => <span key={topic}>{topic}</span>)}
          </div>
          <button className="ghost-btn" onClick={() => startAudioGuide("开始讲解")}><Headphones size={16} />开始讲解</button>
          {audioNotice ? <p className="muted">{audioNotice}</p> : null}
        </Section>
      </div>
      <div className="split">
        <Section title="票务与地图位置" className="ticket-map-section">
          <div className="ticket-map-grid">
            {[
              ["成人票候选", "黄鹤楼 sandbox", 40],
              ["儿童/学生票候选", "黄鹤楼演示票", 20],
              ["语音讲解演示包", "登楼观江讲解", 30]
            ].map(([title, desc, price]) => (
              <div className="ticket-map-option" key={title}>
                <span><Ticket size={15} /></span>
                <div>
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </div>
                <b>￥{price}</b>
                <Link className="subtle-link" to={DEFAULT_TICKET_ROUTE}>预订</Link>
              </div>
            ))}
          </div>
          <div className="ticket-map-preview">
            <MapPanel compact scenic pois={poi ? [poi] : []} />
          </div>
        </Section>
        <Section title="周边推荐" className="spot-nearby-section">
          {(nearby.length ? nearby.map(poiToScenicSpot) : scenicSpots.slice(1, 5)).map((spot) => <SpotCard key={spot.name} spot={spot} compact />)}
        </Section>
      </div>
    </div>
  );
}

export function TicketBookingPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<TicketProduct[]>([]);
  const [slots, setSlots] = useState<TicketSlot[]>([]);
  const [ticket, setTicket] = useState<TicketProduct | undefined>();
  const [slot, setSlot] = useState<TicketSlot | undefined>();
  const [date, setDate] = useState(() => todayISO());
  const [count, setCount] = useState(2);
  const [message, setMessage] = useState("");
  const [lock, setLock] = useState<TicketLock | undefined>();
  const [lockSeconds, setLockSeconds] = useState(0);
  const amount = (ticket?.price ?? 40) * count + 30;

  useEffect(() => {
    fetchTicketOptions(DEFAULT_TICKET_DEMO_POI_ID, date).then(({ products: nextProducts, slots: nextSlots }) => {
      setProducts(nextProducts);
      setSlots(nextSlots);
      setTicket((current) => nextProducts.find((product) => product.id === current?.id) ?? nextProducts[0]);
      setSlot((current) => nextSlots.find((item) => item.id === current?.id) ?? nextSlots[0]);
      setLock(undefined);
      setMessage("");
    });
  }, [date]);

  useEffect(() => {
    if (!lock || lock.status !== "active") {
      setLockSeconds(0);
      return undefined;
    }
    const update = () => setLockSeconds(Math.max(0, Math.floor((new Date(lock.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [lock]);

  const submitOrder = async () => {
    if (!ticket || !slot) return;
    const validation = validateTicketSelection(ticket, slot, count);
    if (validation) {
      setMessage(validation);
      return;
    }
    try {
      setMessage("正在锁定库存...");
      const nextLock = await lockTickets({ productId: ticket.id, slotId: slot.id, visitDate: date, quantity: count });
      setLock(nextLock);
      const order = await createOrder({
        title: `${DEFAULT_TICKET_POI_NAME} ${ticket.name} x${count}`,
        poiId: DEFAULT_TICKET_DEMO_POI_ID,
        ticketId: ticket.id,
        ticketName: ticket.name,
        slotId: slot.id,
        slotTime: slot.time,
        visitDate: date,
        quantity: count,
        amount,
        lockId: nextLock.id,
        image: spotImages.yellowCraneTower,
        visitorInfo: ([
          { name: "张小文", credentialType: "id-card", credentialNo: "330***********1234" },
          { name: "李小明", credentialType: "id-card", credentialNo: "330***********5678" }
        ] as const).slice(0, count)
      });
      saveOrder(order);
      navigate("/pay");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "锁票或下单失败，请稍后重试。");
    }
  };
  return (
    <div className="container grid ticket-page">
      <section className="hero booking-hero" style={{ margin: 0, borderRadius: 8, "--hero-image": `url(${spotImages.yellowCraneTower})` } as React.CSSProperties}>
        <div className="hero-content hero-left booking-hero-copy">
          <Link className="subtle-link booking-hero-back" to="/spot/yellow-crane-tower">返回景点详情</Link>
          <div className="booking-hero-title">
            <span className="hero-eyebrow">Sandbox Scenic Booking</span>
            <h1>{DEFAULT_CITY_NAME}文旅演示票务 · {DEFAULT_TICKET_POI_NAME}</h1>
            <p>基于黄鹤楼真实 POI 做票务链路演示，电子凭证、支付和库存均为 sandbox 流程，不代表真实官方库存或真实扣款。</p>
          </div>
          <div className="booking-hero-facts" aria-label={`${DEFAULT_TICKET_POI_NAME}预约关键数据`}>
            {ticketHeroFacts.map((item) => {
              const Icon = item.icon;
              return (
                <div className="booking-hero-fact" key={item.label}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.desc}</small>
                </div>
              );
            })}
          </div>
          <div className="filters booking-hero-tags">
            <StatusTag tone="blue">5A景区</StatusTag>
            <StatusTag tone="gold">江城地标</StatusTag>
            <StatusTag tone="slate">历史文化名楼</StatusTag>
          </div>
          <div className="booking-hero-actions">
            <a className="primary-btn" href="#ticket-options"><Ticket size={16} />立即预约</a>
            <Link className="ghost-btn" to="/map"><MapPin size={16} />查看导航</Link>
            <Link className="ghost-btn" to="/immersive"><Headphones size={16} />智能讲解</Link>
          </div>
        </div>
        <div className="booking-hero-visual">
          <img src={spotImages.yellowCraneTower} alt={`${DEFAULT_TICKET_POI_NAME}景区实景`} />
          <div className="booking-hero-visual-card">
            <span>今日推荐时段</span>
            <strong>上午登楼观江</strong>
            <small>演示建议：上午客流更平稳，适合登楼远眺长江与武昌城景。</small>
          </div>
        </div>
      </section>
      <div className="booking-meta-row">
        {[
          ["演示库存", "sandbox 候选库存"],
          ["实名预约", "入园信息可追溯"],
          ["15分钟锁票", "提交后保留库存"],
          ["电子凭证", "二维码/身份证核销"]
        ].map(([title, desc]) => (
          <div key={title}>
            <strong>{title}</strong>
            <span>{desc}</span>
          </div>
        ))}
      </div>
      <div className="split">
        <main className="card card-pad booking-panel" id="ticket-options">
          <div className="step-title"><span>1</span><strong>选择票种</strong></div>
          <div className="grid grid-5">{(products.length ? products : ticketOptions.map((item, index) => ({ id: item.name, poiId: DEFAULT_TICKET_DEMO_POI_ID, name: item.name, desc: item.desc, price: item.price, stock: 80 - index * 8, status: index === 3 ? "low" : index === 4 ? "verify" : "available" } as TicketProduct))).map((option) => {
            const stock = statusForStock(option.status);
            return <TicketOption key={option.id} title={option.name} desc={option.desc} price={option.price} stock={stock.label} selected={ticket?.id === option.id} onClick={() => setTicket(option)} />;
          })}</div>
          <div className="step-title"><span>2</span><strong>选择日期</strong></div>
          <div className="grid grid-5">{upcomingDatesISO(5).map((d) => <button className={date === d ? "primary-btn" : "ghost-btn"} key={d} onClick={() => setDate(d)}>{d}</button>)}</div>
          <div className="step-title"><span>3</span><strong>选择入园时段</strong></div>
          <div className="grid grid-5">{(slots.length ? slots : ticketSlots.map((item, index) => ({ id: item.time, time: item.time, stock: 80 - index * 10, status: item.tone === "orange" ? "low" : "available" } as TicketSlot))).map((item) => {
            const stock = statusForStock(item.status);
            return <button key={item.id} onClick={() => setSlot(item)} className={slot?.id === item.id ? "primary-btn" : "ghost-btn"}>{item.time}<br /><small>{stock.label}</small></button>;
          })}</div>
          <div className="step-title"><span>4</span><strong>选择数量</strong></div>
          <div className="filters">
            <button className="ghost-btn" onClick={() => setCount(Math.max(1, count - 1))}>-</button>
            <div className="field">{count} 张</div>
            <button className="ghost-btn" onClick={() => setCount(count + 1)}>+</button>
            <StatusTag tone={ticket ? statusForStock(ticket.status).tone : "green"}>{ticket ? statusForStock(ticket.status).label : "库存充足"}</StatusTag>
          </div>
          <div className="step-title"><span>5</span><strong>电子凭证预览</strong></div>
          <VoucherPreview
            title={`${DEFAULT_CITY_NAME}文旅演示票务 · ${DEFAULT_TICKET_POI_NAME}`}
            ticketName={ticket?.name ?? "成人票"}
            visitDate={date}
            slotTime={slot?.time ?? "08:00-10:00"}
            quantity={count}
            amount={amount}
            gate="黄鹤楼景区西门"
            holderNames={["张小文", "李小明"]}
          />
        </main>
        <aside className="grid order-summary">
          <Section title="订单信息" className="order-summary-card">
            <div className="booking-summary-spot">
              <img src={spotImages.yellowCraneTower} alt={DEFAULT_TICKET_POI_NAME} />
              <div className="booking-summary-spot-copy">
                <h3>{DEFAULT_CITY_NAME}文旅演示票务 · {DEFAULT_TICKET_POI_NAME}</h3>
                <div className="booking-summary-meta">
                  <span><Clock3 size={14} /> 08:00-17:30</span>
                  <StatusTag tone="blue">5A景区</StatusTag>
                </div>
              </div>
            </div>
            <p>入园日期：<strong>{date}</strong></p>
            <p>入园时段：<strong>{slot?.time ?? "08:00-10:00"}</strong></p>
            <p>票种数量：<strong>{ticket?.name ?? "成人票"} x {count}</strong></p>
            {lock ? <p><StatusTag tone={lock.status === "active" ? "green" : "orange"}>锁票{lock.status}</StatusTag> 剩余 {Math.floor(lockSeconds / 60)}:{String(lockSeconds % 60).padStart(2, "0")}</p> : null}
            <hr />
            <p>票价明细：￥{ticket?.price ?? 40} x {count}</p>
            <p>登楼观江 + 语音讲解演示包：￥30</p>
            <h2 style={{ color: "var(--red)" }}>￥{amount}</h2>
            {message ? <p className="muted" style={{ color: "var(--red)" }}>{message}</p> : null}
            <button className="primary-btn" style={{ width: "100%" }} onClick={submitOrder}>提交订单</button>
            <p className="muted"><ShieldCheck size={16} /> sandbox 演示流程，不代表真实出票或真实支付。</p>
          </Section>
          <Section title="使用流程">
            <div className="ticket-flow-grid">
              {ticketUseSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div className="ticket-flow-card" key={step.title}>
                    <div className="ticket-flow-head">
                      <span>{index + 1}</span>
                      <Icon size={18} />
                    </div>
                    <strong>{step.title}</strong>
                    <p>{step.desc}</p>
                    <small>{step.note}</small>
                  </div>
                );
              })}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}

export function TicketDetailPage() {
  const [order, setOrder] = useState<Order | undefined>();

  useEffect(() => {
    let alive = true;
    const localOrders = readOrders();
    setOrder(pickLatestUsableOrder(localOrders));
    fetchOrders().then((remoteOrders) => {
      if (!alive) return;
      const merged = mergeOrders(remoteOrders, localOrders);
      saveOrders(merged);
      setOrder(pickLatestUsableOrder(merged));
    });
    return () => {
      alive = false;
    };
  }, []);

  const displayTitle = order?.title ?? `${DEFAULT_CITY_NAME}文旅演示票务 · ${DEFAULT_TICKET_POI_NAME}`;
  const displayDate = order?.visitDate ?? todayISO();
  const displaySlot = order?.slotTime ?? "08:00-10:00";
  const displayQuantity = order?.quantity ?? 2;
  const reminderItems = [
    ["天气", "26℃ 晴，空气优", "适合户外步行"],
    ["交通", "地铁 5 号线司门口黄鹤楼站出", "步行约 12 分钟"],
    ["核验", "请携带有效身份证件", "按预约时段入园"],
    ["说明", "sandbox 演示票务", "真实规则以景区官方公告为准"]
  ];
  const relatedServices = [
    ["江汉关夜游导览", "￥55起", "夜游路线"],
    ["黄鹤楼登楼讲解", "￥38起", "语音导览"],
    [`${DEFAULT_CITY_NAME}一日游精品路线`, "￥198起", "错峰行程"]
  ];

  return (
    <div className="container grid ticket-detail-page">
      <PageHeader title="旅行票务详情" subtitle="电子凭证、订单进度、出行提醒、使用规则与退改说明集中查看" />
      <div className="split ticket-detail-layout">
      <main className="grid">
        <Section title="已支付 · 待使用" subtitle="出行前请携带有效身份证件，按预约时段入园" className="ticket-credential-section">
          <div className="ticket-credential-grid">
            <div className="ticket-brief">
              <img src={order?.image ?? spotImages.yellowCraneTower} alt={DEFAULT_TICKET_POI_NAME} />
              <div className="ticket-brief-copy">
                <StatusTag tone="green">已支付</StatusTag>
                <h2>{displayTitle}</h2>
                <div className="ticket-brief-meta">
                  <span><CalendarCheck size={15} />{displayDate}</span>
                  <span><Clock3 size={15} />{displaySlot}</span>
                  <span><MapPin size={15} />黄鹤楼景区西门</span>
                </div>
              </div>
              <div className="ticket-brief-count">
                <strong>{displayQuantity}</strong>
                <span>张票</span>
              </div>
            </div>
            <VoucherPreview
              title={`${DEFAULT_CITY_NAME}文旅演示票务 · ${DEFAULT_TICKET_POI_NAME}`}
              ticketName={order?.ticketName ?? "成人票"}
              visitDate={displayDate}
              slotTime={displaySlot}
              quantity={displayQuantity}
              amount={order?.amount}
              gate="黄鹤楼景区西门"
              holderNames={order?.visitorInfo?.map((visitor) => visitor.name) ?? ["张小文", "李小明"]}
            />
          </div>
        </Section>
        <Section title="订单进度">
          <div className="trust-bar">
            {[`下单 ${monthDay(todayISO())} 09:15`, `支付成功 ${monthDay(todayISO())} 09:16`, `出票成功 ${monthDay(todayISO())} 09:16`].map((item) => <div key={item}><CheckCircle2 /><strong>{item}</strong><span>系统已完成</span></div>)}
          </div>
        </Section>
        <div className="grid grid-3">
          {["使用规则：预约日期与时段内核销，凭二维码或身份证入园。", "退改说明：未使用可在入园前 23:59 申请退款。", "发票信息：支持电子发票，订单完成后可在线申请。"].map((item) => <Section key={item} title={item.split("：")[0]}><p>{item}</p></Section>)}
        </div>
      </main>
      <aside className="grid ticket-detail-aside">
        <Section title="出行提醒" className="travel-reminder-panel" action={<DemoDataBadge />}>
          <div className="travel-reminder-list">
            {reminderItems.map(([label, title, desc]) => (
              <div className="travel-reminder-item" key={label}>
                <StatusTag tone="blue">{label}</StatusTag>
                <div>
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="推荐关联服务" className="related-service-panel">
          <div className="related-service-list">
            {relatedServices.map(([title, price, tag]) => (
              <div className="related-service-item" key={title}>
                <div>
                  <StatusTag tone="gold">{tag}</StatusTag>
                  <strong>{title}</strong>
                  <span>{price}</span>
                </div>
                <button className="ghost-btn">预订</button>
              </div>
            ))}
          </div>
        </Section>
      </aside>
      </div>
    </div>
  );
}

export function PayPage() {
  const [method, setMethod] = useState("微信支付");
  const [paid, setPaid] = useState(false);
  const [order, setOrder] = useState<Order | undefined>();
  const [payment, setPayment] = useState<PaymentRecord | undefined>();
  const [paymentMessage, setPaymentMessage] = useState("");
  const fallbackOrder = useMemo<Order>(() => {
    const now = new Date().toISOString();
    return {
      id: `DEMO${Date.now()}`,
      title: orders[0].title,
      status: "pending_payment",
      amount: orders[0].amount,
      visitDate: todayISO(),
      slotTime: "08:00-10:00",
      image: orders[0].image,
      poiId: DEFAULT_TICKET_DEMO_POI_ID,
      ticketId: "demo-ticket",
      ticketName: "成人票",
      slotId: "demo-slot",
      quantity: 2,
      paymentProvider: "mock",
      visitorInfo: [
        { name: "张小文", credentialType: "id-card", credentialNo: "330***********1234" },
        { name: "李小明", credentialType: "id-card", credentialNo: "330***********5678" }
      ],
      createdAt: now,
      updatedAt: now
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const localOrders = readOrders();
    setOrder(localOrders.find((item) => item.status === "pending_payment") ?? pickLatestUsableOrder(localOrders));
    fetchOrders().then((remoteOrders) => {
      if (!alive) return;
      const merged = mergeOrders(remoteOrders, localOrders);
      saveOrders(merged);
      setOrder(merged.find((item) => item.status === "pending_payment") ?? pickLatestUsableOrder(merged));
    });
    return () => {
      alive = false;
    };
  }, []);

  const pay = async () => {
    const activeOrder = order ?? fallbackOrder;
    if (!order) {
      saveOrder(activeOrder);
      setOrder(activeOrder);
    }
    try {
      setPaymentMessage("正在创建服务端支付...");
      const created = await createPayment(activeOrder.id);
      setPayment(created);
      if (created.provider !== "sandbox") {
        setPaymentMessage(`已创建 ${created.provider} 支付，请等待 provider 回调。`);
        return;
      }
      setPaymentMessage("等待 sandbox provider 回调...");
      const nextPayment = await simulateSandboxPayment(created.id, "paid");
      const latestPayment = await fetchPayment(nextPayment.id);
      setPayment(latestPayment);
      const remoteOrders = await fetchOrders();
      const latestOrder = remoteOrders.find((item) => item.id === activeOrder.id) ?? activeOrder;
      saveOrders(mergeOrders(remoteOrders, readOrders(), [latestOrder]));
      setOrder(latestOrder);
      setPaid(latestPayment.status === "paid");
      setPaymentMessage(`服务端支付状态：${latestPayment.status}`);
    } catch (error) {
      const next = updateOrderStatus(activeOrder.id, "paid") ?? {
        ...activeOrder,
        status: "paid" as const,
        voucherCode: activeOrder.voucherCode ?? `V${activeOrder.id.slice(-8)}`,
        updatedAt: new Date().toISOString()
      };
      saveOrder(next);
      setOrder(next);
      setPaid(true);
      setPaymentMessage(error instanceof Error ? `服务端支付不可用，已切换本地演示 fallback：${error.message}` : "服务端支付不可用，已切换本地演示 fallback。");
    }
  };

  const displayOrder = order ?? fallbackOrder;
  return (
    <div className="container split">
      <main className="card card-pad">
        <div className="section-title">
          <h1>订单确认</h1>
          <p><ShieldCheck color="var(--blue)" /> 请在 <strong style={{ color: "var(--orange)" }}>14:52</strong> 内完成支付，超时订单将自动取消</p>
        </div>
        <div className="step-title"><span>1</span><strong>已选产品</strong></div>
        <OrderCard order={{ id: displayOrder.id, title: displayOrder.title, status: order ? orderStatusLabel(order.status) : "待支付", amount: displayOrder.amount, date: `${displayOrder.visitDate} ${displayOrder.slotTime}`, image: displayOrder.image }} />
        <div className="step-title"><span>2</span><strong>游客信息</strong></div>
        {["张小文（成人） 身份证 330***********1234", "李小明（成人） 身份证 330***********5678"].map((item) => <div className="field" key={item}>{item}</div>)}
        <div className="step-title"><span>3</span><strong>优惠券</strong></div>
        <p><StatusTag tone="orange">景区通用券</StatusTag> 满100减10 <strong style={{ color: "var(--red)" }}>-￥10</strong></p>
        <div className="step-title"><span>4</span><strong>支付方式</strong></div>
        <div className="grid grid-3">
          {["微信支付", "支付宝支付", "银行卡支付"].map((item) => <button key={item} className={method === item ? "select-card selected" : "select-card"} onClick={() => setMethod(item)}><WalletCards /> <strong>{item}</strong><span>{item === "微信支付" ? "推荐" : "支持储蓄卡/信用卡"}</span></button>)}
        </div>
        <button className="primary-btn" style={{ marginTop: 18, width: "100%" }} onClick={pay}><CreditCard size={18} /> 演示支付 ￥{displayOrder.amount}</button>
        <TrustBar />
      </main>
      <aside className="grid">
        <Section title="订单金额明细">
          <p>{order?.ticketName ?? "成人票"} x {order?.quantity ?? 2} <b style={{ float: "right" }}>￥{Math.max(0, displayOrder.amount - 30)}</b></p>
          <p>语音讲解演示包 <b style={{ float: "right" }}>￥30</b></p>
          <p>优惠券 <b style={{ float: "right", color: "var(--red)" }}>￥0</b></p>
          <h2 style={{ color: "var(--red)" }}>￥{displayOrder.amount}</h2>
        </Section>
        <Section title="支付状态">
          {paid ? <div className="empty-state"><CheckCircle2 color="var(--green)" size={52} /><h2>服务端沙箱支付成功</h2><p>支付状态由 API 维护，电子凭证已同步到「我的行程」。</p><Link className="primary-btn" to="/ticket/detail">查看票务详情</Link></div> : <p className="muted">当前选择：{method}。点击后会创建服务端 sandbox 支付，不会产生真实扣款。</p>}
          {payment ? <p className="muted">支付流水：{payment.id} · {payment.provider} · {payment.status}</p> : null}
          {paymentMessage ? <p className="muted">{paymentMessage}</p> : null}
        </Section>
        <Section title="退改规则">
          <p>未使用可随时申请退，订单部分使用后不支持部分退款。改期可在使用日前一天 23:59 前申请。</p>
        </Section>
      </aside>
    </div>
  );
}

export function MePage() {
  const [tab, setTab] = useState("全部行程");
  const [profileSection, setProfileSection] = useState("我的行程");
  const [storedOrders, setStoredOrders] = useState<Order[]>([]);
  const profileStats = [
    { value: "12", label: "收藏" },
    { value: "8", label: "关注" },
    { value: "3", label: "优惠券" }
  ];
  const profileMenu = ["我的行程", "订单管理", "我的收藏", "消息通知", "账户设置"];

  useEffect(() => {
    fetchOrders().then((remoteOrders) => {
      const merged = mergeOrders(remoteOrders, readOrders());
      saveOrders(merged);
      setStoredOrders(merged);
    });
  }, []);

  const orderCards = storedOrders.length
    ? storedOrders.map((order) => ({ id: order.id, title: order.title, status: orderStatusLabel(order.status), amount: order.amount, date: `${order.visitDate} ${order.slotTime}`, image: order.image }))
    : orders;
  return (
    <div className="container wide-split me-layout">
      <aside className="card card-pad profile-sidebar" aria-label="个人中心导航">
        <div className="profile-card">
          <span className="avatar" />
          <h2>张小文</h2>
          <StatusTag tone="blue">Lv4 旅行达人</StatusTag>
          <div className="profile-stats" aria-label="个人数据概览">
            {profileStats.map((item) => (
              <div className="profile-stat" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <nav className="profile-menu" aria-label="个人中心菜单">
          {profileMenu.map((item) => <button className={profileSection === item ? "primary-btn" : "ghost-btn"} onClick={() => setProfileSection(item)} key={item}>{item}</button>)}
        </nav>
      </aside>
      <main className="grid">
        <div className="dashboard-title">
          <div><h1>{profileSection}</h1><p className="muted">轻松管理你的出行计划、订单状态、电子凭证与出行提醒</p></div>
          <button className="primary-btn"><Plus size={16} /> 新建行程</button>
        </div>
        {profileSection !== "我的行程" ? <Section title={profileSection}><p className="muted">{profileSection}视图已打开，当前展示演示账户数据。</p></Section> : null}
        <div className="tab-strip">{["全部行程", "即将出行", "进行中", "已完成", "已取消"].map((item) => <button className={tab === item ? "primary-btn" : "ghost-btn"} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
        <Section title={`即将出行（${Math.min(orderCards.length, 2)}）`}>
          {orderCards.slice(0, 2).map((order) => <OrderCard key={order.id} order={order} />)}
        </Section>
        <Section title="我的订单">
          <div className="grid grid-5">
            {["全部订单 24", "待支付 2", "待使用 5", "已完成 15", "退款/售后 2"].map((item) => <div className="empty-state" key={item}>{item}</div>)}
          </div>
          {orderCards.map((order) => <OrderCard key={order.id} order={order} />)}
        </Section>
      </main>
      <aside className="grid">
        <Section title="行程时间轴" className="trip-timeline-panel">
          <div className="trip-timeline">
            {tripTimelineItems.map((item, index) => (
              <article className="trip-timeline-item" key={`${item.date}-${item.time}-${item.place}`}>
                <span className="trip-timeline-node">{index + 1}</span>
                <time className="trip-timeline-time" dateTime={`2026-${item.date}T${item.time}:00`}>
                  <strong>{item.time}</strong>
                  <span>{item.date}</span>
                </time>
                <div className="trip-timeline-copy">
                  <strong>{item.place}</strong>
                  <small>{item.desc}</small>
                </div>
                <StatusTag tone={item.tone}>{item.status}</StatusTag>
              </article>
            ))}
          </div>
        </Section>
        <Section title="我的收藏">
          {scenicSpots.slice(0, 3).map((spot) => <SpotCard key={spot.name} spot={spot} compact />)}
        </Section>
      </aside>
    </div>
  );
}

export function PackagesPage() {
  const [cart, setCart] = useState(2);
  const selectedPackages = packages.slice(0, cart);
  const subtotal = selectedPackages.reduce((total, pack) => total + pack.price, 0);
  const discount = selectedPackages.length >= 2 ? 120 : 0;
  const payable = Math.max(subtotal - discount, 0);
  const formatCurrency = (value: number) => `￥${value.toLocaleString("zh-CN")}`;

  return (
    <div className="container split">
      <main className="grid">
        <section className="hero packages-hero" style={{ "--hero-image": `url(${spotImages.night})` } as React.CSSProperties}>
          <div className="packages-hero-copy">
            <span className="packages-hero-eyebrow">活动推荐</span>
            <h1><span>商旅联动</span><span>套餐推荐</span></h1>
            <p>一站式预订，多品类组合，可报销更省心。让景区、餐饮、酒店与交通形成联动消费。</p>
            <div className="packages-hero-tags" aria-label="套餐能力">
              {["景区门票", "餐饮券", "酒店套餐", "交通接驳"].map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
        </section>
        <Section title="精选套餐推荐" className="package-section" action={<div className="filters"><button className="ghost-btn">门票+酒店</button><button className="ghost-btn">演出+夜游</button><button className="ghost-btn">出行日期</button></div>}>
          <div className="package-grid">
            {packages.map((pack) => (
              <article className="card package-card" key={pack.name}>
                <div className="package-media">
                  <img src={pack.image} alt={pack.name} />
                  <StatusTag tone="blue">{pack.type}</StatusTag>
                </div>
                <div className="package-copy">
                  <h3>{pack.name}</h3>
                  <p className="muted">{pack.desc}</p>
                  <div className="package-tags">{pack.tags.map((tag) => <StatusTag key={tag} tone="slate">{tag}</StatusTag>)}</div>
                </div>
                <div className="package-buy">
                  <div className="package-price">
                    <strong>￥{pack.price}</strong>
                    <span>套餐价 / 起</span>
                    <small>立省 ￥{pack.save}</small>
                    <del>原价 ￥{pack.origin}</del>
                  </div>
                  <button className="ghost-btn" onClick={() => setCart((current) => Math.min(packages.length, current + 1))}><Plus size={16} />加入清单</button>
                </div>
              </article>
            ))}
          </div>
        </Section>
      </main>
      <aside className="grid packages-aside">
        <Section title="我的行程清单" className="cart-panel" action={<button className="subtle-link" onClick={() => setCart(0)}>清空</button>}>
          <div className="cart-list">
            {selectedPackages.map((pack) => (
              <article className="cart-item" key={pack.name}>
                <img src={pack.image} alt={pack.name} />
                <div className="cart-item-copy">
                  <strong>{pack.name}</strong>
                  <span>出行日期：{addDaysISO(1)}</span>
                </div>
                <b>{formatCurrency(pack.price)}</b>
              </article>
            ))}
          </div>
          <div className="cart-summary">
            <p><span>商品总额</span><b>{formatCurrency(subtotal)}</b></p>
            <p><span>优惠券</span><b className="discount">-{formatCurrency(discount)}</b></p>
            <div className="cart-total">
              <span>应付合计</span>
              <strong>{formatCurrency(payable)}</strong>
            </div>
            <Link className={`primary-btn cart-checkout ${selectedPackages.length ? "" : "disabled-link"}`} to={selectedPackages.length ? "/pay" : "/packages"}>去结算（{selectedPackages.length}）</Link>
          </div>
        </Section>
        <Section title="发票信息">
          <p>增值税电子普通发票（个人/单位），支持订单完成后在线申请。</p>
        </Section>
      </aside>
    </div>
  );
}

export function ImmersivePage() {
  const [scene, setScene] = useState(DEFAULT_TICKET_POI_NAME);
  const [notice, setNotice] = useState("");
  const activeScene = immersiveScenes.find((item) => item.name === scene) ?? immersiveScenes[0];
  const runImmersiveAction = (label: string) => {
    setNotice(`${label}状态已更新，当前保留在「${scene}」场景。`);
    triggerOperation({ scope: "visitor", type: label.includes("AR") ? "ar.demo" : "immersive.demo", label, metadata: { scene } });
  };
  return (
    <div className="container immersive-page">
      <section className="immersive-hero" style={{ "--hero-image": `url(${activeScene.image})` } as React.CSSProperties}>
        <div className="immersive-hero-copy">
          <span className="hero-eyebrow">AR / VR IMMERSIVE GUIDE</span>
          <h1>沉浸式体验</h1>
          <p>全景导览、历史场景复原、数字讲解与互动打卡统一管理，让游客先看懂、再会玩、最后能带走行程结果。</p>
          <div className="filters">
            {activeScene.tags.map((tag) => <StatusTag key={tag} tone="gold">{tag}</StatusTag>)}
          </div>
        </div>
        <div className="immersive-hero-panel" aria-label="沉浸体验能力概览">
          {immersiveStats.map(({ label, value, desc, icon: Icon }) => (
            <div className="immersive-stat" key={label}>
              <span><Icon size={18} /></span>
              <strong>{value}</strong>
              <p>{label}</p>
              <small>{desc}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="immersive-layout">
        <aside className="grid immersive-rail">
          <Section title="选择场景" subtitle="按目的地切换全景脚本" className="immersive-scene-panel">
            <div className="immersive-scene-list">
              {immersiveScenes.map((item, index) => (
                <button
                  key={item.name}
                  className={`immersive-scene-card ${scene === item.name ? "active" : ""}`}
                  onClick={() => setScene(item.name)}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.name}</strong>
                  <small>{item.location} · {item.duration}</small>
                </button>
              ))}
            </div>
          </Section>
          <Section title="体验状态" subtitle="当前导览服务状态" className="immersive-status-panel">
            {[
              ["全景资源", "已同步"],
              ["语音讲解", "普通话 / EN"],
              ["打卡任务", "12 个可用"],
              ["行程联动", "可加入"]
            ].map(([label, value], index) => (
              <div className="immersive-status-row" key={label}>
                <span><CheckCircle2 size={15} /></span>
                <strong>{label}</strong>
                <small>{value}</small>
                <StatusTag tone={index === 1 ? "blue" : "green"}>{index === 1 ? "多语" : "正常"}</StatusTag>
              </div>
            ))}
          </Section>
        </aside>

        <main className="immersive-main">
          <div className="dashboard-title immersive-title">
            <div>
              <h1>{activeScene.name} · 全景导览台</h1>
              <p className="muted">{activeScene.summary}</p>
            </div>
            <div className="filters">
              <button className="ghost-btn" type="button"><Search size={16} />搜索故事</button>
              <button className="ghost-btn" type="button">热门景点</button>
              <button className="ghost-btn" type="button">夜游灯光秀</button>
            </div>
          </div>

          <section className="immersive-stage-card" aria-label={`${activeScene.name}全景导览`}>
            <div className="immersive-stage-head">
              <div>
                <StatusTag tone="blue">{activeScene.badge}</StatusTag>
                <StatusTag tone="green">当前客流{activeScene.crowd}</StatusTag>
              </div>
              <span><Clock3 size={15} /> 推荐体验 {activeScene.duration}</span>
            </div>
            <div className="ar-stage immersive-stage" style={{ "--stage-image": `url(${activeScene.image})` } as React.CSSProperties}>
              {activeScene.hotspots.map((item) => (
                <button
                  className="ar-hotspot"
                  key={item.title}
                  onClick={() => runImmersiveAction(`${item.title}热点`)}
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  type="button"
                >
                  <span>{item.title}</span>
                  <small>{item.desc}</small>
                </button>
              ))}
              <div className="immersive-stage-overlay">
                <div>
                  <strong>{activeScene.name}</strong>
                  <p>历史、建筑与路线节点已整理成分段导览。</p>
                </div>
                <button className="primary-btn" onClick={() => runImmersiveAction("开始沉浸导览")} type="button">
                  <Headphones size={16} /> 开始导览
                </button>
              </div>
            </div>
          </section>

          <Section title="推荐体验场景 / 故事" subtitle="按当前场景生成可讲、可走、可收藏的内容卡片" className="immersive-story-section">
            <div className="immersive-story-grid">
              {activeScene.stories.map(([title, desc], index) => (
                <article className="immersive-story-card" key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                  <button className="subtle-link" onClick={() => runImmersiveAction(`${title}故事`)} type="button">播放故事</button>
                </article>
              ))}
            </div>
          </Section>
        </main>

        <aside className="grid immersive-detail">
          <Section
            title={activeScene.name}
            subtitle={activeScene.location}
            className="immersive-detail-panel"
            action={<StatusTag tone="blue">{activeScene.badge}</StatusTag>}
          >
            <p>{activeScene.summary}</p>
            {notice ? <p className="immersive-notice">{notice}</p> : null}
            <div className="immersive-facts">
              <div><Star size={16} /><strong>4.8</strong><span>游客评分</span></div>
              <div><Ticket size={16} /><strong>可预约</strong><span>票务联动</span></div>
              <div><MapPin size={16} /><strong>{activeScene.duration}</strong><span>推荐时长</span></div>
            </div>
            <div className="immersive-route-list" aria-label={`${activeScene.name}导览节点`}>
              {activeScene.route.map((item, i) => (
                <div className="immersive-route-item" key={item}>
                  <span>{i + 1}</span>
                  <strong>{item}</strong>
                  <button className="icon-btn" aria-label={`${item}语音讲解`} onClick={() => runImmersiveAction(`${item}语音讲解`)} type="button">
                    <Headphones size={15} />
                  </button>
                </div>
              ))}
            </div>
            <Link className="primary-btn immersive-wide-action" to="/spot/yellow-crane-tower">
              <Navigation size={16} /> 进入全景
            </Link>
            <div className="grid grid-2 immersive-action-grid">
              {["AR导览", "加入行程", "分享", "收藏"].map((item) => (
                <button className="ghost-btn" key={item} onClick={() => runImmersiveAction(item)} type="button">{item}</button>
              ))}
            </div>
          </Section>
          <Section title="周边联动" subtitle="导览完成后的下一步" className="immersive-link-panel">
            {scenicSpots.slice(0, 3).map((spot) => (
              <div className="immersive-link-row" key={spot.name}>
                <img src={spot.image} alt={spot.name} />
                <div>
                  <strong>{spot.name}</strong>
                  <small>{spot.duration} · {spot.crowd}</small>
                </div>
              </div>
            ))}
          </Section>
        </aside>
      </div>
    </div>
  );
}

// Each route mode drives its own POI selection (category + search radius),
// so switching modes genuinely changes which places the tour visits.
const MAP_MODE_POI_SEARCH: Record<string, { category: PoiCategory; radius: number }> = {
  "最短路": { category: "景点", radius: 15000 },
  "轻松走": { category: "公园自然", radius: 8000 },
  "亲子游": { category: "亲子游", radius: 15000 },
  "文化深读": { category: "文化艺术", radius: 12000 },
  "无障碍": { category: "景点", radius: 6000 }
};

export function MapPage() {
  const [mode, setMode] = useState("最短路");
  const [activeLayers, setActiveLayers] = useState<Set<MapLayerLabel>>(() => new Set(mapLayerItems.map((item) => item.label)));
  const [pois, setPois] = useState<Poi[]>([]);
  const [route, setRoute] = useState<RouteResult | undefined>();
  const [mapNotice, setMapNotice] = useState("");
  const [routeRefreshTick, setRouteRefreshTick] = useState(0);
  // Which stop the detail panel shows; driven by marker / list clicks.
  const [selectedIndex, setSelectedIndex] = useState(0);
  // A plan handed over from the AI assistant takes priority over the
  // mode-based default selection until the visitor dismisses it.
  const [tourIntent, setTourIntent] = useState(() => readTourIntent());
  // Multi-day plans tour one day at a time.
  const [intentDayIndex, setIntentDayIndex] = useState(0);
  const intentDays = (tourIntent?.days?.length ?? 0) > 1 ? tourIntent!.days! : undefined;
  const dismissTourIntent = () => {
    clearTourIntent();
    setTourIntent(undefined);
    setIntentDayIndex(0);
  };

  useEffect(() => {
    setSelectedIndex(0);
    if (tourIntent) {
      const dayStops = intentDays?.[Math.min(intentDayIndex, intentDays.length - 1)]?.stops;
      const sourceStops = dayStops?.length ? dayStops : tourIntent.stops;
      const stops = orderOpenTourBy(sourceStops, (stop) => stop);
      setPois(stops.map((stop, index) => ({
        id: `tour-intent-${index}`,
        name: stop.name ?? `地点 ${index + 1}`,
        cityId: DEFAULT_CITY_ID,
        category: "景点",
        tags: [tourIntent.source === "assistant" ? "AI 推荐" : "行程规划"],
        lng: stop.lng,
        lat: stop.lat,
        coordinateSystem: "GCJ-02"
      })));
      return;
    }
    // City-center radius search keeps the tour walkable (a city-wide query
    // surfaces far-suburb landmarks that walking routes cannot reach), and
    // POIs are tour-ordered BEFORE numbering so marker numbers, the nearby
    // list and the drawn route all share one visiting order.
    const search = MAP_MODE_POI_SEARCH[mode] ?? MAP_MODE_POI_SEARCH["最短路"];
    let alive = true;
    fetchPois({ cityId: DEFAULT_CITY_ID, category: search.category, limit: 5, ...DEFAULT_CITY_CENTER, radius: search.radius })
      .then((list) => {
        if (alive) setPois(orderOpenTourBy(list, (poi) => ({ lng: poi.lng, lat: poi.lat })));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tourIntent, intentDayIndex]);

  useEffect(() => {
    // Route through the exact POIs shown on the map, in marker order.
    const stops = pois.length >= 2
      ? pois.map((poi) => ({ name: poi.name, lng: poi.lng, lat: poi.lat }))
      : undefined;
    fetchRoute({
      cityId: DEFAULT_CITY_ID,
      mode: "walking",
      preferences: [mode],
      ...(stops ? { origin: stops[0], waypoints: stops.slice(1, -1), destination: stops[stops.length - 1] } : {})
    }).then(setRoute).catch(() => setRoute(undefined));
  }, [mode, pois, routeRefreshTick]);

  const routeSummary = route ? `约 ${(route.distanceMeters / 1000).toFixed(1)} 公里 · ${route.durationMinutes} 分钟 · ${route.provider}${route.fallback ? " fallback" : ""}` : "路线服务加载中";
  // Detail panel follows the clicked marker / list row.
  const selectedPoi = pois[selectedIndex] ?? pois[0];
  const selectedSpot = selectedPoi ? poiToScenicSpot(selectedPoi) : undefined;
  const selectedDistanceKm = selectedPoi ? flatMeters(DEFAULT_CITY_CENTER, selectedPoi) / 1000 : undefined;
  const selectedWalkMinutes = selectedDistanceKm !== undefined ? Math.max(1, Math.round((selectedDistanceKm * 1000) / 75)) : undefined;
  const selectedSupportsTickets = Boolean(selectedPoi?.name.includes("黄鹤楼"));
  const toggleLayer = (label: MapLayerLabel) => {
    setActiveLayers((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };
  const runMapAction = (label: string) => {
    if (label === "重排") {
      setRouteRefreshTick((tick) => tick + 1);
      setMapNotice(route && !route.fallback
        ? `已按「${mode}」重新计算路线，使用 ${route.provider} 实时路网数据。`
        : `已按「${mode}」重新计算路线（当前为本地降级估算，请检查后端与地图 key）。`);
    } else {
      setMapNotice(`${label}已打开演示结果：客流与语音讲解均为本地演示，不代表真实第三方能力。`);
    }
    triggerOperation({ scope: "visitor", type: label === "重排" ? "route.reorder" : label.includes("语音") ? "guide.audio" : "traffic.realtime", label, metadata: { mode } });
  };

  return (
    <div className="map-layout map-fullscreen" aria-label="智能导览地图工作台">
      <h1 className="sr-only">智能导览</h1>
      <MapPanel scenic pois={pois} route={route} onMarkerClick={setSelectedIndex} />
      <div className="map-overlay-grid">
        <aside className="map-surface map-control-panel" aria-label="路线与图层控制">
          {tourIntent ? (
            <div className="map-intent-banner">
              <div className="map-intent-copy">
                <strong>{tourIntent.source === "assistant" ? "来自 AI 助手的规划" : "来自行程规划"}</strong>
                <small title={tourIntent.label}>{tourIntent.label}</small>
                {intentDays ? (
                  <div className="map-intent-days" role="tablist" aria-label="按天切换导览">
                    {intentDays.map((group, index) => (
                      <button
                        className={`map-intent-day ${index === intentDayIndex ? "active" : ""}`}
                        key={group.day}
                        onClick={() => setIntentDayIndex(index)}
                        role="tab"
                        aria-selected={index === intentDayIndex}
                        type="button"
                      >
                        {group.day}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button className="map-intent-close" onClick={dismissTourIntent} aria-label="退出该规划，恢复模式推荐" type="button">恢复推荐</button>
            </div>
          ) : null}
          <div className="map-panel-title">
            <div>
              <h2>路线模式</h2>
              <span>按同行人、体力与兴趣重排</span>
            </div>
          </div>
          <div className="map-mode-grid">
            {["最短路", "轻松走", "亲子游", "文化深读", "无障碍"].map((item) => <button className={mode === item ? "primary-btn" : "ghost-btn"} key={item} onClick={() => setMode(item)}>{item}</button>)}
          </div>
          <div className="map-panel-divider" />
          <div className="map-panel-title">
            <div>
              <h2>地图图层</h2>
              <span>筛选当前可见服务点</span>
            </div>
          </div>
          <div className="layer-list map-layer-list">
            {mapLayerItems.map((item) => {
              const Icon = item.icon;
              const selected = activeLayers.has(item.label);
              return (
                <button className={`layer-toggle ${selected ? "selected" : ""}`} aria-pressed={selected} key={item.label} onClick={() => toggleLayer(item.label)}>
                  <span className={`layer-icon ${item.tone}`} aria-hidden="true"><Icon size={16} /></span>
                  <span className="layer-copy">
                    <strong>{item.label}</strong>
                    <small>{selected ? "已显示" : "已隐藏"}</small>
                  </span>
                  <span className="layer-switch" aria-hidden="true"><span /></span>
                </button>
              );
            })}
          </div>
          <div className="map-alert-card">
            <StatusTag tone="red">较拥挤 76%</StatusTag> <DemoDataBadge label="客流为演示估算" />
            <p>黄鹤楼核心区预计 10:00-13:00 进入高峰。</p>
            <button className="ghost-btn" onClick={() => runMapAction("查看实时客流")}>查看实时客流</button>
            {mapNotice ? <p className="muted">{mapNotice}</p> : null}
          </div>
        </aside>

        <aside className="map-surface map-place-panel" aria-label={`${selectedPoi?.name ?? "景点"}详情`}>
          {selectedPoi && selectedSpot ? (
            <>
              <div className="map-place-head">
                <div>
                  <h2>{selectedPoi.name}</h2>
                  <p>距市中心约 {selectedDistanceKm?.toFixed(1)} 公里 · 步行约 {selectedWalkMinutes} 分钟（直线估算）</p>
                </div>
                <StatusTag tone={selectedSpot.crowd === "舒适" ? "green" : "orange"}>{selectedSpot.crowd}</StatusTag>
              </div>
              <img className="map-place-image" src={selectedSpot.image} alt={selectedPoi.name} />
              <div className="scenic-callout-tags">
                <StatusTag>{selectedPoi.category}</StatusTag>
                {selectedPoi.tags.slice(0, 2).map((tag) => <StatusTag tone="orange" key={tag}>{tag}</StatusTag>)}
                <DemoDataBadge label="客流为演示估算" />
              </div>
              {selectedSupportsTickets ? (
                <div className="scenic-callout-info">
                  <div className="scenic-price-head">
                    <span><Ticket size={14} />演示票价</span>
                  </div>
                  <div className="scenic-price-grid">
                    <span>成人 <b>￥40</b></span>
                    <span>学生 <b>￥20</b></span>
                  </div>
                  <p><ShieldCheck size={14} />sandbox 演示价，非官方真实票价。</p>
                </div>
              ) : (
                <div className="scenic-callout-info">
                  <p><MapPin size={14} />{selectedPoi.address ?? "地址以地图标注为准"}</p>
                  <p><ShieldCheck size={14} />该景点未接入 sandbox 演示票务，门票与预约以官方渠道为准。</p>
                </div>
              )}
              <div className="scenic-callout-actions">
                {selectedSupportsTickets
                  ? <Link className="primary-btn" to={DEFAULT_TICKET_ROUTE}><Navigation size={17} />去预约</Link>
                  : <button className="primary-btn" onClick={() => runMapAction(`前往${selectedPoi.name}`)} type="button"><Navigation size={17} />去这里</button>}
                <button className="ghost-btn" onClick={() => runMapAction("语音讲解")}><Headphones size={16} />语音讲解</button>
              </div>
              <div className="map-nearby-list">
                <h3>本线路站点</h3>
                {pois.map((poi, index) => {
                  const spot = poiToScenicSpot(poi);
                  return (
                    <button
                      className={`map-nearby-row ${index === selectedIndex ? "active" : ""}`}
                      key={poi.id}
                      onClick={() => setSelectedIndex(index)}
                      type="button"
                    >
                      <img src={spot.image} alt={poi.name} />
                      <span>
                        <strong>{index + 1}. {poi.name}</strong>
                        <small>{spot.crowd} · {poi.rating ? `★ ${poi.rating}` : poi.category}</small>
                      </span>
                      <b>{index === selectedIndex ? "查看中" : "查看"}</b>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="muted">线路站点加载中...</p>
          )}
        </aside>

        <section className="map-surface map-route-panel" aria-label="推荐路线">
          <div className="map-panel-title map-route-title">
            <div>
              <h2>推荐路线（{mode}）</h2>
              <span>{routeSummary}</span>
            </div>
            <button className="ghost-btn" onClick={() => runMapAction("重排")}><RefreshCcw size={16} />重排</button>
          </div>
          {mapNotice ? <p className="muted">{mapNotice}</p> : null}
          {route?.failureReason ? <p className="muted">{route.failureReason}</p> : null}
        </section>
      </div>
    </div>
  );
}
