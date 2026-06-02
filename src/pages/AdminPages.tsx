import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  DatabaseZap,
  Download,
  Eye,
  FileText,
  Filter,
  Megaphone,
  PackageOpen,
  Plus,
  Save,
  Send,
  Settings2,
  ShieldAlert,
  Store,
  Trash2,
  UploadCloud
} from "lucide-react";
import {
  ChartCard,
  Donut,
  Drawer,
  FunnelPanel,
  MapPanel,
  MetricCard,
  PageHeader,
  ReviewTable,
  Section,
  StatusTag,
  TrafficChart,
  WorkflowCanvas
} from "../components/common";
import {
  campaignRows,
  channelData,
  kpis,
  knowledgeRows,
  merchants,
  reviewRows,
  spotImages,
  workflowNodes
} from "../data/mockData";
import type { MetricItem } from "../types";
import { createMerchant, decideReview, fetchAdminMetrics, fetchMerchants, fetchReviews, syncMerchantInventory } from "../services/apiClient";
import { nextPublishStatus, validateRequired } from "../services/adminService";

const merchantColumns = ["商户名称", "类别", "营业状态", "库存同步", "评分", "近7日订单", "审核状态"];
const knowledgeColumns = ["问题标题", "分类", "来源", "更新时间", "状态", "命中次数"];
const campaignColumns = ["专题名称", "标签", "状态", "PV", "UV", "CTR"];
const reviewColumns = ["名称", "提交人", "类型", "风险提示", "审核状态", "提交时间"];

function FilterBar({ dense = false }: { dense?: boolean }) {
  return (
    <div className={`card card-pad admin-filter ${dense ? "dense" : ""}`}>
      <div className="filters">
        <input className="field" placeholder="请输入关键词" />
        <select className="field"><option>全部景区</option><option>西湖风景区</option><option>灵隐飞来峰</option></select>
        <select className="field"><option>全部状态</option><option>已发布</option><option>待审核</option></select>
        {!dense ? <input className="field" type="date" defaultValue="2026-06-02" /> : null}
        <button className="primary-btn"><Filter size={16} /> 查询</button>
        <button className="ghost-btn">重置</button>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("line");
  const [metrics, setMetrics] = useState({
    kpis,
    alerts: [
      ["拥堵预警", "光明顶区域密度已达 4.2 人/㎡", "高"],
      ["库存预警", "玉屏索道票库存不足，剩余 368 张", "中"],
      ["经营异常", "云上餐厅订单取消率异常偏高", "中"],
      ["设备提醒", "南大门闸机 3 号通道离线", "低"]
    ],
    hotspots: [
      ["门票预约", "5,842", "24.21%", "+12.35%"],
      ["索道运营时间", "3,276", "13.57%", "+5.21%"],
      ["停车场位置", "2,915", "12.07%", "+1.84%"],
      ["天气查询", "2,104", "8.72%", "-3.12%"],
      ["景点介绍", "1,876", "7.77%", "+2.05%"]
    ]
  });

  useEffect(() => {
    fetchAdminMetrics().then((data) => {
      setMetrics({
        kpis: data.kpis,
        alerts: data.alerts.map((alert) => [alert.title, alert.desc, alert.level]),
        hotspots: data.hotspots
      });
    });
  }, []);

  return (
    <div className="admin-dashboard">
      <PageHeader
        eyebrow="智慧文旅运营平台"
        title="运营看板"
        subtitle="客流、咨询、转化、订单、投诉、商户表现和活动效果实时联动"
        actions={<><button className="ghost-btn"><Download size={16} /> 导出数据</button><button className="primary-btn"><FileText size={16} /> 生成日报</button></>}
      />
      <FilterBar />
      <div className="grid grid-3 admin-metrics" style={{ margin: "18px 0" }}>
        {metrics.kpis.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>
      <div className="grid grid-3 admin-chart-grid">
        <ChartCard title="景区客流热力分布" action={<StatusTag tone="green">实时</StatusTag>}>
          <MapPanel compact scenic />
        </ChartCard>
        <ChartCard title="实时客流趋势" action={<div className="filters">{["line", "area", "bar"].map((type) => <button key={type} className={chartType === type ? "primary-btn" : "ghost-btn"} onClick={() => setChartType(type as typeof chartType)}>{type}</button>)}</div>}>
          <TrafficChart type={chartType} />
        </ChartCard>
        <ChartCard title="预约到游览转化漏斗" action={<StatusTag tone="blue">今日</StatusTag>}>
          <FunnelPanel />
        </ChartCard>
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <Section title="咨询热点 TOP5">
          <ReviewTable columns={["咨询主题", "咨询量", "占比", "较昨日"]} rows={metrics.hotspots} />
        </Section>
        <Section title="告警中心" className="alert-center" action={<StatusTag tone="red">18</StatusTag>}>
          {metrics.alerts.map(([title, desc, level]) => (
            <div className="reason-row" key={title}>
              <span style={{ background: level === "高" ? "var(--red)" : level === "中" ? "var(--orange)" : "var(--blue)" }}><AlertTriangle size={15} /></span>
              <div><strong>{title}</strong><p className="muted">{desc}</p></div>
            </div>
          ))}
        </Section>
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <Section title="商户经营排行 TOP5">
          <ReviewTable columns={["商户名称", "交易额", "订单量", "好评率"]} rows={[
            ["光明顶酒店", "128,635", "1,246", "98.35%"],
            ["云上餐厅", "96,542", "1,102", "96.12%"],
            ["北海咖啡厅", "72,318", "876", "97.45%"],
            ["玉屏候车站", "68,947", "654", "95.21%"]
          ]} />
        </Section>
        <Section title="运营任务工单">
          <ReviewTable columns={["工单编号", "工单类型", "工单标题", "紧急程度"]} rows={[
            ["WO202606020001", "客诉处理", "游客反馈排队时间过长", "高"],
            ["WO202606020002", "设备维护", "南大门闸机故障", "中"],
            ["WO202606020003", "内容审核", "活动页面信息更新审核", "低"],
            ["WO202606020004", "商户协助", "商户咨询分账周期问题", "低"]
          ]} action="处理" />
        </Section>
      </div>
    </div>
  );
}

export function ContentPage() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(merchants);
  const [merchantIds, setMerchantIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", category: "住宿", phone: "", desc: "" });

  useEffect(() => {
    fetchMerchants().then((items) => {
      setMerchantIds(items.map((item) => item.id));
      setRows(items.map((item) => [item.name, item.category, item.status, item.inventoryStatus, item.rating, String(item.orderCount), item.reviewStatus]));
    }).catch(() => undefined);
  }, []);

  const saveMerchant = async () => {
    const validation = validateRequired({ 商户名称: form.name, 联系人手机号: form.phone, 商户介绍: form.desc });
    if (!validation.ok) {
      setNotice(validation.message);
      return;
    }
    try {
      const created = await createMerchant(form);
      setMerchantIds((prev) => [created.id, ...prev]);
      setRows((prev) => [[created.name, created.category, created.status, created.inventoryStatus, created.rating, String(created.orderCount), created.reviewStatus], ...prev]);
      setNotice("已创建商户并发起审核，记录已落库。");
    } catch {
      setRows((prev) => [[form.name, form.category, "营业中", "待同步", "暂无", "0", "待审核"], ...prev]);
      setNotice("服务端不可用，已创建本地演示商户。");
    }
    setOpen(false);
    setForm({ name: "", category: "住宿", phone: "", desc: "" });
  };

  return (
    <>
      <PageHeader
        title="内容与商户管理"
        subtitle="管理平台内容资源、商户信息及审核流程，保障信息质量与用户体验"
        actions={<><button className="primary-btn" onClick={() => setOpen(true)}><Plus size={16} /> 新增商户</button><button className="ghost-btn"><Download size={16} /> 导出数据</button></>}
      />
      <div className="tab-strip" style={{ marginBottom: 16 }}>
        {["商户管理", "景点内容管理", "活动专题管理", "FAQ知识库", "标签管理", "审核中心", "工作流配置"].map((item) => <button className={item === "商户管理" ? "primary-btn" : "ghost-btn"} key={item}>{item}</button>)}
      </div>
      <FilterBar />
      <Section title="商户列表" action={<StatusTag tone="blue">共 128 条</StatusTag>} className="card-pad" >
        <div className="filters" style={{ marginBottom: 12 }}>
          <button className="ghost-btn">批量启用</button>
          <button className="ghost-btn">批量同步库存</button>
          <button className="ghost-btn">批量设置标签</button>
          <button className="ghost-btn" style={{ color: "var(--red)" }}>批量删除</button>
        </div>
        {notice ? <p className="muted">{notice}</p> : null}
        <ReviewTable
          columns={merchantColumns}
          rows={rows}
          action="同步库存"
          onAction={async (_, index) => {
            try {
              const id = merchantIds[index];
              if (id) await syncMerchantInventory(id);
              setRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? [...row.slice(0, 3), "已同步", ...row.slice(4)] : row));
              setNotice("库存同步状态已通过服务端更新。");
            } catch {
              setRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? [...row.slice(0, 3), row[3] === "已同步" ? "同步失败" : "已同步", ...row.slice(4)] : row));
              setNotice("服务端不可用，已切换本地演示同步。");
            }
          }}
        />
      </Section>
      <div className="grid grid-3" style={{ marginTop: 18 }}>
        <Section title="审核中心" action={<StatusTag tone="red">12</StatusTag>}>
          {["待审核商户 5", "待审核内容 7", "即将过期内容 3", "驳回待处理 0"].map((item) => <p key={item}><StatusTag tone="orange">待办</StatusTag> {item}</p>)}
        </Section>
        <Section title="内容与商户工作流">
          {["商户入驻审核流程：提交 → 资料初审 → 资质审核 → 上线", "内容发布审核流程：提交 → 内容审核 → 合规审核 → 发布"].map((item) => <p key={item}>{item}</p>)}
        </Section>
        <Section title="策略配置">
          {["推荐策略 已启用 3 个策略", "券包投放 已启用 2 个活动", "活动排期 下次发布 06-03 10:00"].map((item) => <p key={item}><StatusTag tone="green">启用中</StatusTag> {item}</p>)}
        </Section>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="新增商户">
        <div className="grid">
          <input className="field" placeholder="商户名称" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <select className="field" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>住宿</option><option>餐饮</option><option>交通</option><option>文创</option></select>
          <input className="field" placeholder="联系人手机号" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <textarea className="field" placeholder="商户介绍与主要服务能力" value={form.desc} onChange={(event) => setForm({ ...form, desc: event.target.value })} />
          {notice ? <p className="muted">{notice}</p> : null}
          <button className="primary-btn" onClick={saveMerchant}>保存并发起审核</button>
        </div>
      </Drawer>
    </>
  );
}

export function KnowledgePage() {
  const [rows, setRows] = useState(knowledgeRows);
  const [notice, setNotice] = useState("");
  const metrics: MetricItem[] = [
    { label: "总FAQ数", value: "1,248", delta: "较昨日 +28", tone: "blue", icon: BookOpenCheck },
    { label: "已发布", value: "1,036", delta: "较昨日 +21", tone: "green", icon: CheckCircle2 },
    { label: "待更新", value: "132", delta: "较昨日 +7", tone: "orange", icon: UploadCloud },
    { label: "命中次数", value: "638,245", delta: "较昨日 +12,845", tone: "purple", icon: DatabaseZap }
  ];
  return (
    <>
      <PageHeader title="FAQ知识库管理" subtitle="管理旅行相关 FAQ 与知识内容，支持多语言、版本管理与数据溯源" actions={<button className="primary-btn" onClick={() => setNotice("索引重建任务已进入演示队列。")}><DatabaseZap size={16} /> 重新构建索引</button>} />
      <div className="tab-strip" style={{ marginBottom: 16 }}>{["FAQ列表", "分类管理", "知识导入", "版本记录"].map((item) => <button className={item === "FAQ列表" ? "primary-btn" : "ghost-btn"} key={item}>{item}</button>)}</div>
      <div className="grid grid-4">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>
      <div className="wide-split" style={{ gridTemplateColumns: "minmax(0,1fr) 380px", marginTop: 18 }}>
        <main className="grid">
          <FilterBar dense />
          <Section title="知识条目">
            {notice ? <p className="muted">{notice}</p> : null}
            <ReviewTable
              columns={knowledgeColumns}
              rows={rows}
              action="切换发布"
              onAction={(_, index) => {
                setRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? [...row.slice(0, 4), row[4] === "已发布" ? "待更新" : "已发布", row[5]] : row));
                setNotice("知识条目状态已更新。");
              }}
            />
          </Section>
        </main>
        <Section title="编辑 FAQ" action={<Settings2 size={18} />}>
          <div className="grid">
            <label>问题标题</label><input className="field" value="黄山景区门票多少钱？" readOnly />
            <label>分类</label><select className="field"><option>门票政策</option></select>
            <label>答案内容</label><textarea className="field" value={"黄山风景区门票价格如下：\n旺季（3月1日-11月30日）：190元/人\n淡季（12月1日-次年2月28日）：150元/人"} readOnly />
            <label>多语言状态</label>
            <div className="filters"><StatusTag tone="green">简体中文 已完成</StatusTag><StatusTag tone="green">English 已完成</StatusTag><StatusTag tone="orange">日本語 待翻译</StatusTag></div>
            <button className="primary-btn" onClick={() => setNotice("FAQ 更新已发布。")}>发布更新</button>
          </div>
        </Section>
      </div>
    </>
  );
}

export function MerchantPage() {
  const [openForBusiness, setOpenForBusiness] = useState(true);
  const [inventoryNotice, setInventoryNotice] = useState("库存数据为演示状态。");
  const metrics: MetricItem[] = [
    { label: "今日订单金额", value: "￥18,752", delta: "较昨日 +12.45%", tone: "blue", icon: Store },
    { label: "今日订单数", value: "128", delta: "较昨日 +15.23%", tone: "purple", icon: PackageOpen },
    { label: "今日核销数", value: "116", delta: "较昨日 +11.11%", tone: "green", icon: CheckCircle2 },
    { label: "今日访客数", value: "2,846", delta: "较昨日 +8.32%", tone: "orange", icon: Eye },
    { label: "好评率", value: "98.2%", delta: "较昨日 +0.8%", tone: "red", icon: Bell }
  ];
  return (
    <>
      <PageHeader title="商户工作台" subtitle={`下午好，云谷客栈。当前营业状态：${openForBusiness ? "营业中" : "暂停营业"}`} actions={<><button className="ghost-btn"><Eye size={16} /> 店铺预览</button><button className="ghost-btn"><QrIcon /> 扫码核销</button><button className="primary-btn" onClick={() => setOpenForBusiness((value) => !value)}>{openForBusiness ? "暂停营业" : "恢复营业"}</button></>} />
      <div className="grid grid-5">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>
      <div className="grid grid-3" style={{ marginTop: 18 }}>
        <ChartCard title="营业概况" action={<div className="filters"><button className="ghost-btn">今日</button><button className="primary-btn">近7日</button></div>}>
          <TrafficChart type="area" />
        </ChartCard>
        <Section title="今日订单" action={<button className="subtle-link">查看更多</button>}>
          <ReviewTable columns={["时间", "商品", "游客", "金额", "状态"]} rows={[
            ["15:25", "云谷客栈·家庭房1间", "张**", "￥680", "待核销"],
            ["14:48", "云谷客栈·山景大床房1间", "李**", "￥580", "已核销"],
            ["14:03", "云谷客栈·双床房1间", "王**", "￥480", "已核销"],
            ["13:37", "黄山门票+云谷客栈套餐", "陈**", "￥899", "待核销"]
          ]} action="核销" />
        </Section>
        <Section title="库存同步">
          <p className="muted">{inventoryNotice}</p>
          {["山景大床房 剩余3间 库存紧张", "家庭套房 剩余1间 库存紧张", "标准双床房 剩余8间 正常", "亲子房 剩余5间 正常", "待售大床房 剩余0间 已售罄"].map((item) => <p key={item}>{item.includes("紧张") ? <StatusTag tone="orange">紧张</StatusTag> : item.includes("售罄") ? <StatusTag tone="red">售罄</StatusTag> : <StatusTag tone="green">正常</StatusTag>} {item}</p>)}
          <button className="ghost-btn" onClick={() => setInventoryNotice("已触发演示库存同步，低库存商品保持预警。")}>同步库存</button>
        </Section>
      </div>
      <div className="grid grid-3" style={{ marginTop: 18 }}>
        <Section title="待处理事项">
          {["待核销订单 23", "待处理退款 5", "库存预警 3", "客户咨询未回复 12"].map((item) => <p key={item}><StatusTag tone="orange">待办</StatusTag> {item}</p>)}
        </Section>
        <Section title="用户评价">
          <h2>4.8 ★★★★★</h2>
          {["房间干净舒适，老板服务热情。", "位置很好，出门就是景区入口。"].map((item) => <p key={item}>{item}</p>)}
        </Section>
        <Section title="营销工具">
          {["优惠券 已创建 8 张", "套餐管理 已创建 5 个", "活动投放 可报名 3 个活动"].map((item) => <p key={item}><StatusTag tone="blue">工具</StatusTag> {item}</p>)}
          <button className="primary-btn">营销中心</button>
        </Section>
      </div>
    </>
  );
}

function QrIcon() {
  return <span style={{ fontWeight: 950 }}>⌗</span>;
}

export function CampaignsPage() {
  const [rows, setRows] = useState(campaignRows);
  const [notice, setNotice] = useState("");
  return (
    <>
      <PageHeader title="活动专题管理" subtitle="管理平台活动专题与营销活动，提升内容曝光与转化效果" actions={<><button className="primary-btn"><Plus size={16} /> 新建专题</button><button className="ghost-btn"><Download size={16} /> 导出数据</button></>} />
      <div className="grid grid-4">
        {[
          { label: "专题总数", value: "128", delta: "较昨日 +3", tone: "blue" },
          { label: "进行中活动", value: "34", delta: "较昨日 +2", tone: "green" },
          { label: "本周新增", value: "6", delta: "较上周 +2", tone: "purple" },
          { label: "活动转化率", value: "4.62%", delta: "较昨日 +0.38%", tone: "orange" }
        ].map((metric) => <MetricCard key={metric.label} metric={metric as MetricItem} />)}
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        <FilterBar />
        <Section title="专题列表" action={<StatusTag tone="blue">共 128 条</StatusTag>}>
          {notice ? <p className="muted">{notice}</p> : null}
          <ReviewTable
            columns={campaignColumns}
            rows={rows}
            action="上下架"
            onAction={(_, index) => {
              setRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? [row[0], row[1], nextPublishStatus(row[2]), row[3], row[4], row[5]] : row));
              setNotice("活动专题状态已更新。");
            }}
          />
        </Section>
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <ChartCard title="活动转化趋势"><TrafficChart type="bar" /></ChartCard>
        <Section title="近期上线日程">
          {["06-03 晚美乡村周末游 待上线", "06-05 端午民俗文化节 待上线", "06-09 亲子研学季 待上线"].map((item) => <p key={item}><CalendarDays size={16} color="var(--blue)" /> {item}</p>)}
        </Section>
      </div>
    </>
  );
}

export function ReviewPage() {
  const [rows, setRows] = useState(reviewRows);
  const [selected, setSelected] = useState(reviewRows[0]);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [remark, setRemark] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetchReviews().then((items) => {
      const nextRows = items.map((item) => [item.subjectName, item.submitter, item.type, item.riskNote, item.status, item.submittedAt]);
      setReviewIds(items.map((item) => item.id));
      setRows(nextRows);
      if (nextRows[0]) setSelected(nextRows[0]);
    }).catch(() => undefined);
  }, []);

  const applyReview = async (status: "已通过" | "已驳回") => {
    if (status === "已驳回" && !remark.trim()) {
      setNotice("驳回必须填写审核备注。");
      return;
    }
    const index = rows.findIndex((row) => row[0] === selected[0]);
    try {
      const id = reviewIds[index];
      if (id) await decideReview(id, status, remark);
      setNotice(`已通过服务端${status === "已通过" ? "通过" : "驳回"}：${selected[0]}`);
    } catch {
      setNotice(`服务端不可用，已本地演示${status === "已通过" ? "通过" : "驳回"}：${selected[0]}`);
    } finally {
      setRows((prev) => prev.map((row) => row[0] === selected[0] ? [row[0], row[1], row[2], row[3], status, row[5]] : row));
      setSelected((prev) => [prev[0], prev[1], prev[2], prev[3], status, prev[5]]);
      setRemark("");
    }
  };

  return (
    <>
      <PageHeader title="审核中心" subtitle="商户审核、内容审核、活动审核与风险复核统一处理" actions={<><button className="primary-btn"><Send size={16} /> 批量通过</button><button className="ghost-btn" style={{ color: "var(--red)" }}>批量驳回</button></>} />
      <div className="grid grid-5">
        {[
          { label: "待审核", value: "128", delta: "较昨日 +18", tone: "blue" },
          { label: "审核中", value: "36", delta: "较昨日 -6", tone: "purple" },
          { label: "已通过", value: "1,248", delta: "较昨日 +132", tone: "green" },
          { label: "已驳回", value: "214", delta: "较昨日 +21", tone: "red" },
          { label: "驳回率", value: "14.63%", delta: "较昨日 +1.28%", tone: "orange" }
        ].map((metric) => <MetricCard key={metric.label} metric={metric as MetricItem} />)}
      </div>
      <div className="wide-split" style={{ gridTemplateColumns: "minmax(0,1fr) 380px", marginTop: 18 }}>
        <main className="grid">
          <FilterBar dense />
          <Section title="审核列表">
            <ReviewTable columns={reviewColumns} rows={rows} action="查看" onAction={(row) => setSelected(row)} />
          </Section>
          <div className="grid grid-2">
            <Section title="审核日志">
              <ReviewTable columns={["时间", "操作人", "操作类型", "结果"]} rows={[
                ["2026-06-02 10:12", "张景区", "通过", "通过"],
                ["2026-06-02 09:48", "王思语", "驳回", "驳回"],
                ["2026-06-02 09:32", "陈梦", "通过", "通过"]
              ]} />
            </Section>
            <ChartCard title="审核趋势（7日）"><TrafficChart type="line" /></ChartCard>
          </div>
        </main>
        <Section title="审核详情" action={<button className="ghost-btn">收起</button>}>
          <div className="grid">
            <div className="spot-card compact">
              <img src={spotImages.food} alt="审核材料" />
              <div><StatusTag tone="orange">待审核</StatusTag><h3>{selected[0]}</h3><p className="muted">提交人：{selected[1]} · 类型：{selected[2]}</p></div>
            </div>
            <p><StatusTag tone="orange">风险提示</StatusTag> {selected[3]}</p>
            <p>提交时间：{selected[5]}</p>
            {notice ? <p className="muted">{notice}</p> : null}
            <label>审核结果</label>
            <select className="field"><option>请选择审核结果</option><option>通过</option><option>驳回</option><option>转人工复核</option></select>
            <label>审核备注</label>
            <textarea className="field" placeholder="请填写审核备注" value={remark} onChange={(event) => setRemark(event.target.value)} />
            <div className="filters"><button className="ghost-btn" onClick={() => setRemark("")}>取消</button><button className="ghost-btn" style={{ color: "var(--red)" }} onClick={() => applyReview("已驳回")}><Trash2 size={15} /> 驳回</button><button className="primary-btn" onClick={() => applyReview("已通过")}>通过</button></div>
          </div>
        </Section>
      </div>
    </>
  );
}

export function WorkflowPage() {
  const [node, setNode] = useState(workflowNodes[1]);
  const logs = useMemo(() => [
    ["2026-06-02 14:35", "张景区", "更新节点", `修改了「${node.title}」的 SLA 配置`],
    ["2026-06-02 11:20", "李运营", "新增节点", "在资质审核后新增实地核验节点"],
    ["2026-06-01 18:10", "王法务", "发布流程", "发布流程版本 v1.2.0"]
  ], [node.title]);
  return (
    <>
      <PageHeader
        title="工作流配置"
        subtitle="可视化配置平台各类内容与业务流程，支持条件分支、并行会签、自动化触发与通知"
        actions={<><button className="ghost-btn"><Plus size={16} /> 新建流程</button><button className="ghost-btn"><Save size={16} /> 保存草稿</button><button className="primary-btn">发布配置</button></>}
      />
      <div className="tab-strip" style={{ marginBottom: 16 }}>{["商户入驻审核流程", "内容发布审核流程", "活动上线流程", "工单升级规则"].map((item) => <button className={item === "商户入驻审核流程" ? "primary-btn" : "ghost-btn"} key={item}>{item}</button>)}</div>
      <div className="wide-split">
        <Section title="流程步骤">
          <div className="grid">
            {workflowNodes.map((item, index) => (
              <button key={item.id} className={node.id === item.id ? "primary-btn" : "ghost-btn"} style={{ justifyContent: "flex-start" }} onClick={() => setNode(item)}>
                {index + 1}. {item.title}
              </button>
            ))}
          </div>
        </Section>
        <WorkflowCanvas selected={node} onSelect={setNode} />
        <Section title="节点配置" action={<Settings2 size={18} />}>
          <div className="grid">
            <StatusTag tone={node.tone}>{node.type}</StatusTag>
            <h2>{node.title}</h2>
            <p className="muted">{node.description}</p>
            <label>节点名称</label><input className="field" value={node.title} readOnly />
            <label>SLA 设置</label><input className="field" value={node.sla} readOnly />
            <label>处理方式</label><div className="filters"><StatusTag>单人处理</StatusTag><StatusTag tone="slate">多人会签</StatusTag></div>
            <label>工具能力</label>
            {["知识库检索", "票务库存接口", "地图路线服务", "安全审核日志"].map((item) => <p key={item}><StatusTag tone="blue">已启用</StatusTag> {item}</p>)}
            <button className="primary-btn">保存配置</button>
          </div>
        </Section>
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <Section title="最近变更">
          <ReviewTable columns={["时间", "操作人", "操作", "变更内容"]} rows={logs} />
        </Section>
        <Section title="流程概览">
          <p>当前版本：v1.2.0 <StatusTag tone="green">已发布</StatusTag></p>
          <p>流程状态：<StatusTag tone="green">启用中</StatusTag></p>
          <Donut data={channelData.slice(0, 4).map((item) => ({ name: item.name, value: item.value, fill: item.fill }))} />
        </Section>
      </div>
    </>
  );
}
