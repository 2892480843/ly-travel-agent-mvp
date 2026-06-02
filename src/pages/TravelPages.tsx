import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Baby,
  Bell,
  CalendarDays,
  Camera,
  Car,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Headphones,
  Hotel,
  Languages,
  MapPin,
  Mic,
  Navigation,
  PackageCheck,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  Train,
  Utensils,
  Video,
  WalletCards
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  AIChat,
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
import type { Order, PaymentRecord, Poi, RouteResult, StatusTone, TicketLock, TicketProduct, TicketSlot } from "../types";
import { createOrder, createPayment, fetchOrders, fetchPayment, fetchPoi, fetchPois, fetchRoute, fetchTicketOptions, lockTickets, simulateSandboxPayment } from "../services/apiClient";
import { getLatestOrder, orderStatusLabel, readOrders, saveOrder, updateOrderStatus } from "../services/orderService";
import { poiToScenicSpot, statusForStock } from "../services/poiService";
import { validateTicketSelection } from "../services/ticketService";

const featureShortcuts = [
  ["智能导览", "景点导览 · 语音讲解", Navigation, "/map"],
  ["生成行程", "AI定制 · 专属路线", Sparkles, "/plan"],
  ["多语翻译", "入境游客服务", Languages, "/assistant"],
  ["票务预约", "门票 · 演出 · 套餐", Ticket, "/ticket/leifeng"]
] as const;

const serviceItems = ["卫生间", "停车场", "母婴室", "无障碍", "充电宝", "游客中心", "行李寄存", "直通车"];

export function HomePage() {
  return (
    <>
      <section className="hero home-hero" style={{ "--hero-image": `url(${heroImage})` } as React.CSSProperties}>
        <div className="hero-content hero-left home-hero-content">
          <span className="hero-eyebrow">Hangzhou Culture Travel AI Platform</span>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            智游城市 乐享文旅体
          </motion.h1>
          <p>面向游客、景区运营方与商户的文旅智能体，从搜、问、订、游到评和复购，打通可执行的城市文旅服务链路。</p>
          <div className="search-pill">
            <Sparkles color="var(--blue)" />
            <input placeholder="问问今天怎么玩、怎么走、订什么..." />
            <Link className="icon-btn" to="/assistant"><Navigation size={19} /></Link>
          </div>
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
      </section>
      <div className="container home-stack grid" style={{ gap: 18 }}>
        <div className="shortcut-grid grid grid-4">
          {featureShortcuts.map(([title, desc, Icon, path]) => (
            <Link className="shortcut-card" key={title} to={path}>
              <Icon color="var(--blue)" size={30} />
              <h3>{title}</h3>
              <p className="muted">{desc}</p>
            </Link>
          ))}
        </div>
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
        <div className="grid grid-3">
          <Section title="热门路线" subtitle="路线含距离、交通和拥堵提示">
            {[
              ["西湖经典一日游", "约 8.2 公里，步行+游船", "人少舒适"],
              ["宋韵文化体验线", "清河坊 + 南宋御街 + 夜游", "夜景推荐"],
              ["运河夜游路线", "公交 + 步行 + 游船", "舒适"]
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
            {["《宋城千古情》今晚19:30", "杭州大运河音乐节", "浙江绿城主场赛事"].map((item) => (
              <div className="spot-card compact" key={item}>
                <img src={spotImages.hefang} alt={item} />
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
  const [mode, setMode] = useState("文本提问");
  return (
    <div className="container wide-split assistant-layout">
      <div style={{ gridColumn: "1 / -1" }}>
        <PageHeader title="AI旅行助手" subtitle="文本、语音、拍照识别与菜单翻译统一入口，展示工具调用状态与可执行推荐卡片" />
      </div>
      <aside className="grid assist-rail">
        <Section title="AI旅行助手" subtitle="多模态问答" className="rail-section">
          <div className="grid">
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
        <Section title="我的行程" className="rail-section">
          <strong>西湖文化深度游</strong>
          <p className="muted">3 个景点、2 个活动，已保存至 2026-06-06</p>
          <Link className="ghost-btn" to="/me">查看行程</Link>
        </Section>
      </aside>
      <main className="assistant-main">
        <AIChat />
      </main>
      <aside className="grid assist-rail">
        <Section title="热门问题" className="rail-section" action={<button className="ghost-btn">换一换</button>}>
          {["西湖一日游最佳路线推荐", "杭州必吃的十大美食", "雷峰塔门票多少钱？需要预约吗？", "灵隐寺怎么去？"].map((q) => <p key={q}>🔥 {q}</p>)}
        </Section>
        <Section title="快捷操作" className="rail-section">
          <div className="grid grid-2">
            {["行程规划", "景点导览", "票务预约", "酒店预订", "交通出行", "美食推荐"].map((item) => <button className="ghost-btn" key={item}>{item}</button>)}
          </div>
        </Section>
        <Section title="工具调用状态" className="rail-section">
          {["POI知识库已命中", "票务库存接口正常", "地图拥堵数据已同步"].map((item, i) => (
            <p key={item}><StatusTag tone={i === 1 ? "green" : "blue"}>{i === 1 ? "在线" : "完成"}</StatusTag> {item}</p>
          ))}
        </Section>
      </aside>
    </div>
  );
}

export function RecommendPage() {
  const [filter, setFilter] = useState("全部推荐");
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const category = filter === "美食" ? "美食" : filter === "全部推荐" ? "全部" : undefined;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPois({
      cityId: "hangzhou",
      category,
      tags: filter === "适合带娃" ? ["亲子"] : filter === "少排队" ? ["景点"] : filter === "夜游" ? ["夜生活"] : undefined,
      limit: 10
    })
      .then((items) => {
        if (!alive) return;
        setPois(items);
        setError(items.length ? "" : "没有找到匹配的真实 POI，请换个筛选条件。");
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
  }, [category, filter]);

  const filtered = pois.length ? pois.map(poiToScenicSpot) : filter === "美食" ? foods : scenicSpots;
  return (
    <div className="container split">
      <main className="grid">
        <div className="dashboard-title">
          <div>
            <h1>个性化推荐</h1>
            <p className="muted">基于你的偏好与实时情境，为你筛选最合适的杭州文旅体验</p>
          </div>
          <div className="filters">
            {["全部推荐", "适合带娃", "少排队", "夜游", "Citywalk", "美食"].map((item) => (
              <button className={filter === item ? "primary-btn" : "ghost-btn"} onClick={() => setFilter(item)} key={item}>{item}</button>
            ))}
          </div>
        </div>
        <Section title={`为你找到 ${loading ? "..." : filtered.length} 个推荐`} action={<StatusTag tone="blue">{pois.length ? "真实 POI + 演示情境" : "fallback/demo"}</StatusTag>}>
          {error ? <p className="muted">{error}</p> : null}
          <div className="grid grid-2">
            {filtered.map((item) => "crowd" in item ? <SpotCard key={item.name} spot={item} /> : (
              <article className="card spot-card" key={item.name}>
                <img src={item.image} alt={item.name} />
                <div>
                  <div className="spot-head"><h3>{item.name}</h3><span className="rating">★ {item.rating}</span></div>
                  <div className="filters tiny-gap">{item.tags.map((tag) => <StatusTag key={tag} tone="slate">{tag}</StatusTag>)}<StatusTag tone="orange">人均 ￥{item.price}</StatusTag></div>
                  <p className="reason">为什么推荐你：{item.reason}</p>
                  <button className="primary-btn">立即预订</button>
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
      <aside className="grid">
        <Section title="我的偏好">
          <div className="profile-card">
            <span className="avatar" />
            <h2>张小雨</h2>
            <StatusTag tone="gold">Lv.5 资深旅行家</StatusTag>
            <div className="filters">{["文化体验", "历史古迹", "美食爱好者", "亲子出游"].map((tag) => <StatusTag key={tag}>{tag}</StatusTag>)}</div>
            <button className="ghost-btn">编辑偏好</button>
          </div>
        </Section>
        <Section title="当前位置与天气">
          <h2>杭州 · 西湖区</h2>
          <p><StatusTag tone="orange">26℃ 晴</StatusTag> <StatusTag tone="green">空气优 AQI 32</StatusTag></p>
          <p className="muted">湿度 62%，东南风 2级，适合户外步行。</p>
        </Section>
        <RecommendReasonCard />
      </aside>
    </div>
  );
}

export function PlanPage() {
  const [day, setDay] = useState("Day 1");
  const [walking, setWalking] = useState("适中");
  return (
    <div className="container wide-split plan-layout">
      <div style={{ gridColumn: "1 / -1" }}>
        <PageHeader title="杭州三日游智能规划" subtitle="结合天气、营业时间、交通时长、票务库存与同行偏好生成可执行行程" />
      </div>
      <aside className="card card-pad planner-panel">
        <div className="section-title"><h2>行程设置</h2><button className="subtle-link">清空</button></div>
        <div className="step-title"><span>1</span><strong>出行天数</strong></div>
        <div className="filters"><button className="ghost-btn">-</button><button className="field">3 天</button><button className="ghost-btn">+</button></div>
        <div className="step-title"><span>2</span><strong>预算（人均）</strong></div>
        <div className="grid grid-2"><div className="field">￥2000</div><div className="field">￥3000</div></div>
        <div className="step-title"><span>3</span><strong>同行人</strong></div>
        <div className="field">2 位成人 · 1 位儿童</div>
        <div className="step-title"><span>4</span><strong>兴趣偏好</strong></div>
        <div className="filters">{["历史文化", "自然风光", "美食体验", "亲子游", "拍照打卡"].map((t) => <StatusTag key={t}>{t}</StatusTag>)}</div>
        <div className="step-title"><span>5</span><strong>步行强度</strong></div>
        <div className="filters">{["轻松", "适中", "挑战"].map((item) => <button className={walking === item ? "primary-btn" : "ghost-btn"} onClick={() => setWalking(item)} key={item}>{item}</button>)}</div>
        <button className="primary-btn" style={{ width: "100%", marginTop: 20 }}><Sparkles size={17} /> 立即生成行程</button>
      </aside>
      <main className="grid">
        <Section
          title="杭州 3日2晚 文化深度游"
          subtitle="行程由 AI 生成，可拖拽调整顺序，点击景点可换成同类型候选"
          action={<div className="filters"><button className="ghost-btn">调整偏好</button><button className="ghost-btn"><RefreshCcw size={16} />重新生成</button></div>}
        >
          <div className="filters" style={{ marginBottom: 14 }}>
            {Object.keys(timelineDays).map((d) => <button key={d} onClick={() => setDay(d)} className={day === d ? "primary-btn" : "ghost-btn"}>{d}</button>)}
            <StatusTag tone="green">20-28℃ 空气优</StatusTag>
          </div>
          <Timeline items={timelineDays[day]} />
        </Section>
      </main>
      <aside className="grid">
        <Section title="推荐理由">
          {["西湖、灵隐、运河三大核心体验一次玩到", "自然风光 + 人文历史 + 文化体验，节奏舒适", "错峰安排热门景点，优化游览顺序", "亲子友好，保留休息与室内替代点"].map((r) => <p key={r}><CheckCircle2 color="var(--green)" size={16} /> {r}</p>)}
        </Section>
        <Section title="约束条件已满足">
          {["出行天数：3天", "预算：￥2000 - ￥3000", "同行：2成人1儿童", "语言：中文（简体）"].map((item) => <p key={item}><StatusTag tone="green">通过</StatusTag> {item}</p>)}
        </Section>
        <Section title="预计费用（人均）">
          <h2 style={{ color: "var(--blue)", margin: 0 }}>￥2,680 <small>/3天</small></h2>
          <Donut data={[{ name: "住宿", value: 47, fill: "#176bff" }, { name: "门票", value: 28, fill: "#16c7c7" }, { name: "餐饮", value: 16, fill: "#ff9f32" }, { name: "交通", value: 9, fill: "#7c5cff" }]} />
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

  useEffect(() => {
    fetchPoi("hangzhou-b023b02842").then(setPoi);
    fetchPois({ cityId: "hangzhou", category: "景点", limit: 5 }).then(setNearby);
  }, []);

  const detail = poi ? poiToScenicSpot(poi) : scenicSpots[1];
  return (
    <div className="container grid">
      <div className="split">
        <section className="hero" style={{ margin: 0, borderRadius: 8, "--hero-image": `url(${detail.image})` } as React.CSSProperties}>
          <div className="hero-content hero-left">
            <div className="filters">{detail.tags.slice(0, 3).map((tag) => <StatusTag key={tag} tone={tag.includes("国家") ? "green" : "slate"}>{tag}</StatusTag>)}</div>
            <h1>{detail.name}</h1>
            <p>{poi?.description ?? "千年古刹，禅宗文化底蕴深厚。适合文化深读、祈福参访与飞来峰石刻联游。"}</p>
            <div className="filters">
              <Link className="primary-btn" to="/plan">加入行程</Link>
              <Link className="primary-btn" to="/ticket/leifeng">立即预约</Link>
              <button className="ghost-btn"><Headphones size={16} />语音导览</button>
            </div>
          </div>
        </section>
        <aside className="card card-pad">
          <h2>景点概览</h2>
          {[
            `数据来源：${poi?.source?.provider ?? "fallback/demo"}`,
            `所属城市：杭州市`,
            `地址：${poi?.address ?? "法云弄1号"}`,
            `坐标系：${poi?.coordinateSystem ?? "GCJ-02"}`
          ].map((item) => <p key={item}><StatusTag tone="slate">{item.split("：")[0]}</StatusTag> {item.split("：")[1]}</p>)}
          <MapPanel compact scenic pois={poi ? [poi] : []} />
        </aside>
      </div>
      <div className="tab-strip">
        {tabs.map((item) => <button className={tab === item ? "primary-btn" : "ghost-btn"} key={item} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="grid grid-4">
        <Section title="开放时间"><p>{poi?.openingHours ?? "以官方公告为准"}</p><StatusTag tone="green">当前客流 中等</StatusTag></Section>
        <Section title="建议游玩时长"><h2>{poi?.suggestedDuration ?? "2 - 3 小时"}</h2><p className="muted">深度游览可按体力和排队情况调整。</p></Section>
        <Section title="适合人群"><p>{poi?.suitableFor ?? "历史文化爱好者、亲子家庭、祈福礼佛人士、摄影爱好者。"}</p></Section>
        <Section title="AI讲解"><p>已生成「飞来峰造像」「灵隐禅宗」「江南寺院建筑」三段音频。</p><button className="ghost-btn"><Headphones size={16} />开始讲解</button></Section>
      </div>
      <div className="split">
        <Section title="票务与地图位置">
          {["灵隐寺香花券（含飞来峰） ￥45", "灵隐寺年卡 ￥180", "导游讲解服务 ￥100起"].map((item) => <p key={item}><Ticket size={16} color="var(--blue)" /> {item} <Link className="subtle-link" to="/ticket/leifeng">预订</Link></p>)}
          <MapPanel compact scenic pois={poi ? [poi] : []} />
        </Section>
        <Section title="周边推荐">
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
  const [date, setDate] = useState("2026-06-06");
  const [count, setCount] = useState(2);
  const [message, setMessage] = useState("");
  const [lock, setLock] = useState<TicketLock | undefined>();
  const [lockSeconds, setLockSeconds] = useState(0);
  const amount = (ticket?.price ?? 40) * count + 30;

  useEffect(() => {
    fetchTicketOptions("ticket-leifeng-demo", date).then(({ products: nextProducts, slots: nextSlots }) => {
      setProducts(nextProducts);
      setSlots(nextSlots);
      setTicket(nextProducts[0]);
      setSlot(nextSlots[0]);
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
        title: `雷峰塔 ${ticket.name} x${count}`,
        poiId: "ticket-leifeng-demo",
        ticketId: ticket.id,
        ticketName: ticket.name,
        slotId: slot.id,
        slotTime: slot.time,
        visitDate: date,
        quantity: count,
        amount,
        lockId: nextLock.id,
        image: spotImages.leifeng,
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
      <section className="hero booking-hero" style={{ margin: 0, borderRadius: 8, "--hero-image": `url(${spotImages.leifeng})` } as React.CSSProperties}>
        <div className="hero-content hero-left">
          <Link className="subtle-link" to="/spot/lingyin" style={{ color: "white" }}>返回景点</Link>
          <h1>杭州西湖景区 · 雷峰塔</h1>
          <p>4.8 分，12,856 条评价。登塔俯瞰西湖全景，支持官方票源预约、电子凭证核销与智能讲解套餐。</p>
          <div className="filters"><StatusTag tone="blue">5A景区</StatusTag><StatusTag tone="gold">西湖十景</StatusTag><StatusTag tone="slate">历史文化名塔</StatusTag></div>
        </div>
      </section>
      <div className="split">
        <main className="card card-pad booking-panel">
          <div className="step-title"><span>1</span><strong>选择票种</strong></div>
          <div className="grid grid-5">{(products.length ? products : ticketOptions.map((item, index) => ({ id: item.name, poiId: "ticket-leifeng-demo", name: item.name, desc: item.desc, price: item.price, stock: 80 - index * 8, status: index === 3 ? "low" : index === 4 ? "verify" : "available" } as TicketProduct))).map((option) => {
            const stock = statusForStock(option.status);
            return <TicketOption key={option.id} title={option.name} desc={option.desc} price={option.price} stock={stock.label} selected={ticket?.id === option.id} onClick={() => setTicket(option)} />;
          })}</div>
          <div className="step-title"><span>2</span><strong>选择日期</strong></div>
          <div className="grid grid-5">{["2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"].map((d) => <button className={date === d ? "primary-btn" : "ghost-btn"} key={d} onClick={() => setDate(d)}>{d}</button>)}</div>
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
          <VoucherPreview />
        </main>
        <aside className="grid order-summary">
          <Section title="订单信息" className="order-summary-card">
            <div className="spot-card compact">
              <img src={spotImages.leifeng} alt="雷峰塔" />
              <div><h3>杭州西湖景区 · 雷峰塔</h3><p className="muted">开放时间：08:00-17:30</p><StatusTag tone="blue">5A景区</StatusTag></div>
            </div>
            <p>入园日期：<strong>{date}</strong></p>
            <p>入园时段：<strong>{slot?.time ?? "08:00-10:00"}</strong></p>
            <p>票种数量：<strong>{ticket?.name ?? "成人票"} x {count}</strong></p>
            {lock ? <p><StatusTag tone={lock.status === "active" ? "green" : "orange"}>锁票{lock.status}</StatusTag> 剩余 {Math.floor(lockSeconds / 60)}:{String(lockSeconds % 60).padStart(2, "0")}</p> : null}
            <hr />
            <p>票价明细：￥{ticket?.price ?? 40} x {count}</p>
            <p>登塔观景 + 语音讲解：￥30</p>
            <h2 style={{ color: "var(--red)" }}>￥{amount}</h2>
            {message ? <p className="muted" style={{ color: "var(--red)" }}>{message}</p> : null}
            <button className="primary-btn" style={{ width: "100%" }} onClick={submitOrder}>提交订单</button>
            <p className="muted"><ShieldCheck size={16} /> 官方票源保障，支付安全放心</p>
          </Section>
          <Section title="使用流程">
            <div className="grid grid-4">
              {["提交订单", "获取凭证", "扫码入园", "快乐游玩"].map((item) => <div className="empty-state" key={item}>{item}</div>)}
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
    setOrder(getLatestOrder("paid") ?? getLatestOrder("ready_to_visit") ?? readOrders()[0]);
  }, []);

  return (
    <div className="container grid">
      <PageHeader title="旅行票务详情" subtitle="电子凭证、订单进度、出行提醒、使用规则与退改说明集中查看" />
      <div className="split">
      <main className="grid">
        <Section title="已支付 · 待使用" subtitle="出行前请携带有效身份证件，按预约时段入园">
          <div className="grid grid-2">
            <div className="spot-card">
              <img src={order?.image ?? spotImages.leifeng} alt="雷峰塔" />
              <div><h2>{order?.title ?? "杭州西湖景区 · 雷峰塔"}</h2><p>预约日期：{order?.visitDate ?? "2026-06-06"}</p><p>入园时段：{order?.slotTime ?? "08:00-10:00"}</p><p>入口：雷峰塔景区南门</p></div>
            </div>
            <VoucherPreview />
          </div>
        </Section>
        <Section title="订单进度">
          <div className="trust-bar">
            {["下单 06-02 23:15", "支付成功 06-02 23:16", "出票成功 06-02 23:16"].map((item) => <div key={item}><CheckCircle2 /><strong>{item}</strong><span>系统已完成</span></div>)}
          </div>
        </Section>
        <div className="grid grid-3">
          {["使用规则：预约日期与时段内核销，凭二维码或身份证入园。", "退改说明：未使用可在入园前 23:59 申请退款。", "发票信息：支持电子发票，订单完成后可在线申请。"].map((item) => <Section key={item} title={item.split("：")[0]}><p>{item}</p></Section>)}
        </div>
      </main>
      <aside className="grid">
        <Section title="出行提醒">
          {["今日天气 26℃ 晴，空气优", "地铁 4 号线水澄桥站 B 口出，步行约 12 分钟", "景区实行实名预约，请携带身份证原件入园"].map((item) => <p key={item}><StatusTag tone="blue">提醒</StatusTag> {item}</p>)}
        </Section>
        <Section title="推荐关联服务">
          {["西湖游船（环湖观光）￥55起", "雷峰塔登塔讲解 ￥38起", "西湖一日游精品团 ￥198起"].map((item) => <p key={item}>{item}<button className="ghost-btn">预订</button></p>)}
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

  useEffect(() => {
    setOrder(getLatestOrder("pending_payment") ?? readOrders()[0]);
  }, []);

  const pay = async () => {
    if (!order) return;
    try {
      setPaymentMessage("正在创建服务端支付...");
      const created = await createPayment(order.id);
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
      const latestOrder = remoteOrders.find((item) => item.id === order.id) ?? order;
      setOrder(latestOrder);
      saveOrder(latestOrder);
      setPaid(latestPayment.status === "paid");
      setPaymentMessage(`服务端支付状态：${latestPayment.status}`);
    } catch (error) {
      const next = updateOrderStatus(order.id, "paid");
      setOrder(next);
      setPaid(true);
      setPaymentMessage(error instanceof Error ? `服务端支付不可用，已切换本地演示 fallback：${error.message}` : "服务端支付不可用，已切换本地演示 fallback。");
    }
  };

  const displayOrder = order ?? {
    id: "demo",
    title: orders[0].title,
    status: "pending_payment",
    amount: orders[0].amount,
    visitDate: "2026-06-06",
    slotTime: "08:00-10:00",
    image: orders[0].image
  };
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
  const [storedOrders, setStoredOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchOrders().then((remoteOrders) => {
      setStoredOrders(remoteOrders.length ? remoteOrders : readOrders());
    });
  }, []);

  const orderCards = storedOrders.length
    ? storedOrders.map((order) => ({ id: order.id, title: order.title, status: orderStatusLabel(order.status), amount: order.amount, date: `${order.visitDate} ${order.slotTime}`, image: order.image }))
    : orders;
  return (
    <div className="container wide-split">
      <aside className="card card-pad">
        <div className="profile-card">
          <span className="avatar" />
          <h2>张小文</h2>
          <StatusTag tone="blue">Lv4 旅行达人</StatusTag>
          <div className="grid grid-3">
            {["12 收藏", "8 关注", "3 优惠券"].map((item) => <div className="empty-state" key={item}>{item}</div>)}
          </div>
        </div>
        <div className="grid" style={{ marginTop: 16 }}>
          {["我的行程", "订单管理", "我的收藏", "消息通知", "账户设置"].map((item) => <button className={item === "我的行程" ? "primary-btn" : "ghost-btn"} key={item}>{item}</button>)}
        </div>
      </aside>
      <main className="grid">
        <div className="dashboard-title">
          <div><h1>我的行程</h1><p className="muted">轻松管理你的出行计划、订单状态、电子凭证与出行提醒</p></div>
          <button className="primary-btn"><Plus size={16} /> 新建行程</button>
        </div>
        <div className="tab-strip">{["全部行程", "即将出行", "进行中", "已完成", "已取消"].map((item) => <button className={tab === item ? "primary-btn" : "ghost-btn"} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
        <Section title="即将出行（2）">
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
        <Section title="行程时间轴">
          {["06-06 09:00 杭州东站 已出票", "06-06 10:15 西湖景区 已预约", "06-06 18:30 灵隐寺 已预约", "06-08 15:20 杭州东站 已出票"].map((item) => <p key={item}><StatusTag tone="green">已同步</StatusTag> {item}</p>)}
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
  return (
    <div className="container split">
      <main className="grid">
        <section className="hero" style={{ margin: 0, borderRadius: 8, minHeight: 250, "--hero-image": `url(${spotImages.night})` } as React.CSSProperties}>
          <div className="hero-content hero-left">
            <StatusTag tone="blue">活动推荐</StatusTag>
            <h1>商旅联动 / 套餐推荐</h1>
            <p>一站式预订，多品类组合，可报销更省心。让景区 + 餐饮 + 酒店 + 交通形成联动消费。</p>
          </div>
        </section>
        <Section title="精选套餐推荐" action={<div className="filters"><button className="ghost-btn">门票+酒店</button><button className="ghost-btn">演出+夜游</button><button className="ghost-btn">出行日期</button></div>}>
          <div className="grid grid-2">
            {packages.map((pack) => (
              <article className="card spot-card" key={pack.name}>
                <img src={pack.image} alt={pack.name} />
                <div>
                  <StatusTag tone="blue">{pack.type}</StatusTag>
                  <h3>{pack.name}</h3>
                  <p className="muted">{pack.desc}</p>
                  <div className="filters tiny-gap">{pack.tags.map((tag) => <StatusTag key={tag} tone="slate">{tag}</StatusTag>)}</div>
                  <p><strong style={{ color: "var(--red)", fontSize: 22 }}>￥{pack.price}</strong> <span className="muted">起 省￥{pack.save}</span></p>
                  <button className="ghost-btn" onClick={() => setCart(cart + 1)}>加入清单</button>
                </div>
              </article>
            ))}
          </div>
        </Section>
      </main>
      <aside className="grid">
        <Section title="我的行程清单" action={<button className="subtle-link">清空</button>}>
          {packages.slice(0, cart).map((pack) => (
            <div className="spot-card compact" key={pack.name}>
              <img src={pack.image} alt={pack.name} />
              <div><strong>{pack.name}</strong><p className="muted">出行日期：2026-06-07</p><h3 style={{ color: "var(--red)" }}>￥{pack.price}</h3></div>
            </div>
          ))}
          <p>商品总额 <b style={{ float: "right" }}>￥1,586</b></p>
          <p>优惠券 <b style={{ float: "right", color: "var(--red)" }}>-￥120</b></p>
          <h2 style={{ color: "var(--red)" }}>￥1,466</h2>
          <Link className="primary-btn" to="/pay">去结算（{cart}）</Link>
        </Section>
        <Section title="发票信息">
          <p>增值税电子普通发票（个人/单位），支持订单完成后在线申请。</p>
        </Section>
      </aside>
    </div>
  );
}

export function ImmersivePage() {
  const [scene, setScene] = useState("雷峰塔");
  return (
    <div className="container wide-split">
      <aside className="grid">
        <Section title="选择场景">
          {["雷峰塔", "宋城", "灵隐寺", "西湖夜游"].map((item, index) => (
            <button key={item} className={scene === item ? "primary-btn" : "ghost-btn"} onClick={() => setScene(item)}>{index + 1}. {item}</button>
          ))}
        </Section>
      </aside>
      <main className="grid">
        <div className="dashboard-title">
          <div><h1>沉浸式体验</h1><p className="muted">AR/VR 全景导览、历史场景复原、数字讲解与互动打卡</p></div>
          <div className="filters"><button className="ghost-btn"><Search size={16} /> 搜索故事</button><button className="ghost-btn">热门景点</button><button className="ghost-btn">夜游灯光秀</button></div>
        </div>
        <div className="ar-stage">
          {[
            ["塔顶风光", "重高远迈", 48, 18],
            ["白蛇子传说", "历史典故", 18, 38],
            ["历史复原", "重看南宋晚韵", 76, 35],
            ["雷峰夕照", "西湖十景之一", 36, 72],
            ["佛教文化", "佛塔历史与建筑", 70, 68]
          ].map(([title, desc, x, y]) => <span className="ar-hotspot" key={title as string} style={{ left: `${x}%`, top: `${y}%` }}>{title}<small>{desc}</small></span>)}
        </div>
        <Section title="推荐体验场景 / 故事">
          <div className="grid grid-5">
            {scenicSpots.slice(0, 5).map((spot) => <SpotCard key={spot.name} spot={spot} compact />)}
          </div>
        </Section>
      </main>
      <aside className="grid">
        <Section title={scene}>
          <StatusTag tone="blue">5A景区</StatusTag>
          <p>雷峰塔又名皇妃塔，位于西湖南岸夕照山的雷峰上，是西湖十景之一。</p>
          <div className="timeline" style={{ paddingLeft: 24 }}>
            {["塔顶风光", "白蛇子传说", "历史复原", "佛教文化"].map((item, i) => <div className="timeline-item" key={item}><strong>{i + 1}</strong><div>{item}<button className="icon-btn" style={{ width: 34, height: 34 }}><Headphones size={15} /></button></div></div>)}
          </div>
          <Link className="primary-btn" to="/spot/lingyin">进入全景</Link>
          <div className="grid grid-2"><button className="ghost-btn">AR导览</button><button className="ghost-btn">加入行程</button><button className="ghost-btn">分享</button><button className="ghost-btn">收藏</button></div>
        </Section>
      </aside>
    </div>
  );
}

export function MapPage() {
  const [mode, setMode] = useState("最短路");
  const [pois, setPois] = useState<Poi[]>([]);
  const [route, setRoute] = useState<RouteResult | undefined>();

  useEffect(() => {
    fetchPois({ cityId: "hangzhou", category: "景点", limit: 5 }).then(setPois);
  }, []);

  useEffect(() => {
    const routeMode = mode === "最短路" || mode === "轻松走" || mode === "亲子游" || mode === "文化深读" || mode === "无障碍" ? "walking" : "walking";
    fetchRoute({ mode: routeMode, preferences: [mode] }).then(setRoute).catch(() => setRoute(undefined));
  }, [mode]);

  const routePois = pois.length ? pois : [];
  return (
    <div className="container wide-split map-layout">
      <aside className="grid map-rail">
        <Section title="路线模式" className="rail-section">
          <div className="grid grid-2">
            {["最短路", "轻松走", "亲子游", "文化深读", "无障碍"].map((item) => <button className={mode === item ? "primary-btn" : "ghost-btn"} key={item} onClick={() => setMode(item)}>{item}</button>)}
          </div>
        </Section>
        <Section title="地图图层" className="rail-section">
          {["景点", "卫生间", "母婴室", "停车场", "无障碍设施", "餐饮"].map((item) => <p key={item}><StatusTag tone="blue">开</StatusTag> {item}</p>)}
        </Section>
        <Section title="客流拥堵预警" className="rail-section alert-section">
          <p><StatusTag tone="red">较拥挤 76%</StatusTag> 西湖景区核心区预计 10:00-13:00 进入高峰。</p>
          <button className="ghost-btn">查看实时客流</button>
        </Section>
      </aside>
      <main className="grid map-main">
        <div className="dashboard-title">
          <div><h1>智能导览</h1><p className="muted">AI 伴你游，畅玩每一步。当前模式：{mode}</p></div>
          <div className="search-pill compact-input"><Search size={18} /><input placeholder="搜索景点、服务、设施（如：灵隐寺、卫生间、停车场）" /><Mic color="var(--blue)" /></div>
        </div>
        <MapPanel scenic pois={pois} route={route} />
        <Section title={`推荐路线（${mode}）`} subtitle={route ? `全程约 ${(route.distanceMeters / 1000).toFixed(1)} 公里 · ${route.durationMinutes} 分钟 · ${route.provider}${route.fallback ? " fallback" : ""}` : "路线服务加载中"}>
          {route?.failureReason ? <p className="muted">{route.failureReason}</p> : null}
          <div className="grid grid-5">
            {(route?.waypointNames.length ? route.waypointNames : routePois.length ? routePois.map((poi) => poi.name) : ["雷峰塔", "苏堤春晓", "三潭印月", "断桥残雪", "白堤"]).map((item, index) => <div className="empty-state" key={item}><StatusTag>{index + 1}</StatusTag><strong>{item}</strong><p className="muted">预计停留 {20 + index * 5} 分钟</p></div>)}
          </div>
        </Section>
      </main>
      <aside className="grid map-rail">
        <Section title="雷峰塔" className="rail-section scenic-callout-card">
          <img src={spotImages.leifeng} alt="雷峰塔" style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 8 }} />
          <div className="filters"><StatusTag>历史文化</StatusTag><StatusTag tone="orange">热门景点</StatusTag></div>
          <p>票务信息：成人票 ￥40，学生票 ￥20。</p>
          <p><StatusTag tone="orange">较拥挤 76%</StatusTag> 距当前位置 1.2 公里，步行约 18 分钟。</p>
          <Link className="primary-btn" to="/ticket/leifeng">去这里</Link>
          <button className="ghost-btn"><Headphones size={16} />语音讲解</button>
        </Section>
        <Section title="附近推荐" className="rail-section">
          {(routePois.length ? routePois.slice(1, 4).map(poiToScenicSpot) : scenicSpots.slice(1, 4)).map((spot) => <SpotCard key={spot.name} spot={spot} compact />)}
        </Section>
      </aside>
    </div>
  );
}
