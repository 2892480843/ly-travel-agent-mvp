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
import type { MetricItem, Order } from "../types";
import { createMerchant, decideReview, fetchAdminMetrics, fetchMerchants, fetchOrders, fetchReviews, syncMerchantInventory, verifyTicketVoucher } from "../services/apiClient";
import { describeAdminFilterScope, filterAdminRows, filterReviewRows, nextPublishStatus, validateRequired, type AdminFilterState } from "../services/adminService";
import { triggerOperation } from "../services/operationService";
import { addDaysISO, monthDay, todayISO } from "../utils/demoDates";

const merchantColumns = ["商户名称", "类别", "营业状态", "库存同步", "评分", "近7日订单", "审核状态", "标签"];
const knowledgeColumns = ["问题标题", "分类", "来源", "更新时间", "状态", "命中次数"];
const campaignColumns = ["专题名称", "标签", "状态", "PV", "UV", "CTR"];
const reviewColumns = ["名称", "提交人", "类型", "风险提示", "审核状态", "提交时间"];
const defaultFilterState: AdminFilterState = {
  keyword: "",
  scenic: "全部景区",
  status: "全部状态",
  date: todayISO()
};
const dashboardFilterState: AdminFilterState = {
  keyword: "",
  scenic: "全部景区",
  status: "全部状态"
};
const reviewStatusOptions = ["全部状态", "待审核", "审核中", "已通过", "已驳回"];
const reviewScenicOptions = ["全部景区", "黄鹤楼", "湖北省博物馆", "江汉关博物馆", "武昌城市酒店"];
const dashboardStatusOptions = ["全部状态", "已支付", "待出行", "已核销", "活跃锁票", "待审核", "审核中"];
const defaultDashboardHotspots = [
  ["门票预约", "5,842", "24.21%", "+12.35%"],
  ["索道运营时间", "3,276", "13.57%", "+5.21%"],
  ["停车场位置", "2,915", "12.07%", "+1.84%"],
  ["天气查询", "2,104", "8.72%", "-3.12%"],
  ["景点介绍", "1,876", "7.77%", "+2.05%"]
];
type ReviewListItem = {
  id?: string;
  row: string[];
};

function sameReviewRow(left: string[], right: string[]) {
  return left[0] === right[0] && left[5] === right[5];
}

function merchantRowKey(row: string[]) {
  return row[0];
}

function reviewRowKey(row: string[]) {
  return `${row[0]}-${row[5]}`;
}

function ensureMerchantTag(row: string[]) {
  return row.length >= merchantColumns.length ? row : [...row, "未设置"];
}

function operationTime() {
  return new Date().toISOString().replace("T", " ").slice(0, 16);
}

function normalizeHotspots(rows: string[][], kpiRows = kpis, scopeLabel = "") {
  const normalizedRows = rows.slice(0, 5).map((row) => [row[0] ?? "-", row[1] ?? "-", row[2] ?? "-", row[3] ?? "-"]);
  const existingNames = new Set(normalizedRows.map((row) => row[0]));
  const paymentMetric = kpiRows.find((item) => item.label === "支付收入");
  const supplementRows = [
    paymentMetric ? ["支付收入", paymentMetric.value, "paid orders", paymentMetric.delta] : undefined,
    scopeLabel ? ["筛选口径", scopeLabel.includes("全部关键词 / 全部景区 / 全部状态") ? "全量" : "已应用", "scope", scopeLabel] : undefined,
    ...defaultDashboardHotspots
  ].filter((row): row is string[] => Array.isArray(row));

  for (const row of supplementRows) {
    if (normalizedRows.length >= 5) break;
    if (existingNames.has(row[0])) continue;
    normalizedRows.push(row);
    existingNames.add(row[0]);
  }

  return normalizedRows;
}

function FilterBar({
  dense = false,
  statusOptions = ["全部状态", "已发布", "待审核"],
  scenicOptions = ["全部景区", "黄鹤楼", "湖北省博物馆", "江汉关博物馆"],
  keywordPlaceholder = "请输入关键词",
  scopeTitle,
  scopeNote,
  onQuery,
  onReset
}: {
  dense?: boolean;
  statusOptions?: string[];
  scenicOptions?: string[];
  keywordPlaceholder?: string;
  scopeTitle?: string;
  scopeNote?: string;
  onQuery?: (filters: AdminFilterState) => void;
  onReset?: () => void;
}) {
  const [keyword, setKeyword] = useState(defaultFilterState.keyword);
  const [scenic, setScenic] = useState(defaultFilterState.scenic);
  const [status, setStatus] = useState(defaultFilterState.status);
  const [date, setDate] = useState(defaultFilterState.date ?? "");
  const [notice, setNotice] = useState("");
  const query = () => {
    const filters = { keyword, scenic, status, date: dense ? undefined : date };
    setNotice(`已按 ${describeAdminFilterScope(filters, { includeDate: !dense })} 查询。`);
    onQuery?.(filters);
  };
  const reset = () => {
    setKeyword(defaultFilterState.keyword);
    setScenic(defaultFilterState.scenic);
    setStatus(defaultFilterState.status);
    setDate(defaultFilterState.date ?? "");
    setNotice("筛选条件已重置。");
    onReset?.();
  };
  return (
    <div className={`card card-pad admin-filter ${dense ? "dense" : ""}`}>
      {scopeTitle || scopeNote ? (
        <div className="filter-scope-note">
          {scopeTitle ? <strong>{scopeTitle}</strong> : null}
          {scopeNote ? <span>{scopeNote}</span> : null}
        </div>
      ) : null}
      <div className="filters">
        <input className="field" placeholder={keywordPlaceholder} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <select className="field" value={scenic} onChange={(event) => setScenic(event.target.value)}>
          {scenicOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
        <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
          {statusOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
        {!dense ? <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} /> : null}
        <button className="primary-btn" onClick={query}><Filter size={16} /> 查询</button>
        <button className="ghost-btn" onClick={reset}>重置</button>
      </div>
      {notice ? <p className="muted">{notice}</p> : null}
    </div>
  );
}

export function DashboardPage() {
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("line");
  const [filters, setFilters] = useState<AdminFilterState>(dashboardFilterState);
  const [operationNotice, setOperationNotice] = useState("");
  const [metrics, setMetrics] = useState({
    kpis,
    hotspots: defaultDashboardHotspots,
    scopeLabel: "全部关键词 / 全部景区 / 全部状态 / 实时总览",
    sourceNote: "服务端统计 orders、ticket_locks、review_records；游客数为真实 POI + sandbox 演示基准，不作为筛选结果。"
  });

  useEffect(() => {
    fetchAdminMetrics(filters).then((data) => {
      setMetrics({
        kpis: data.kpis,
        hotspots: normalizeHotspots(data.hotspots, data.kpis, data.scopeLabel),
        scopeLabel: data.scopeLabel ?? describeAdminFilterScope(filters),
        sourceNote: data.sourceNote ?? "服务端统计 orders、ticket_locks、review_records。"
      });
    });
  }, [filters]);

  const dashboardOperationMetadata = {
    filters,
    scopeLabel: metrics.scopeLabel,
    sourceNote: metrics.sourceNote
  };

  const exportDashboardData = () => {
    triggerOperation({
      scope: "admin",
      type: "admin.dashboard.export",
      label: "导出运营看板数据",
      metadata: dashboardOperationMetadata,
      openDownload: true
    });
    setOperationNotice(`已发起导出：${metrics.scopeLabel}`);
  };

  const generateDashboardReport = () => {
    triggerOperation({
      scope: "admin",
      type: "admin.dashboard.report",
      label: "生成运营日报",
      metadata: dashboardOperationMetadata,
      openDownload: true
    });
    setOperationNotice(`已发起日报生成：${metrics.scopeLabel}`);
  };

  return (
    <div className="admin-dashboard">
      <section className="admin-dashboard-hero">
        <PageHeader
          eyebrow="智慧文旅运营平台"
          title="运营看板"
          subtitle="客流、咨询、转化、订单、投诉、商户表现和活动效果实时联动"
          actions={<><button className="ghost-btn" onClick={exportDashboardData}><Download size={16} /> 导出数据</button><button className="primary-btn" onClick={generateDashboardReport}><FileText size={16} /> 生成日报</button></>}
        />
        <div className="admin-control-row">
          <FilterBar
            dense
            scenicOptions={reviewScenicOptions}
            statusOptions={dashboardStatusOptions}
            keywordPlaceholder="搜订单、锁票、审核、商户"
            scopeTitle="筛选范围：运营看板服务端数据"
            scopeNote="作用于订单、支付、锁票、待审核与咨询热点；游客数为 POI + sandbox 演示基准。"
            onQuery={setFilters}
            onReset={() => setFilters(dashboardFilterState)}
          />
          <div className="ops-clock">
            <span>今日运营窗口</span>
            <strong>06:00 - 23:00</strong>
            <StatusTag tone="green">数据延迟 &lt; 45s</StatusTag>
          </div>
        </div>
        <div className="dashboard-source-strip" aria-live="polite">
          <span>当前筛选</span>
          <strong>{metrics.scopeLabel}</strong>
          <p>{metrics.sourceNote}</p>
        </div>
        {operationNotice ? <p className="muted dashboard-operation-notice">{operationNotice}</p> : null}
      </section>
      <div className="grid admin-kpi-grid admin-metrics">
        {metrics.kpis.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>
      <div className="admin-chart-grid">
        <ChartCard title="预约到游览转化漏斗" action={<StatusTag tone="blue">今日</StatusTag>} className="funnel-chart-card">
          <FunnelPanel />
        </ChartCard>
        <ChartCard title="景区客流热力分布" action={<StatusTag tone="green">实时</StatusTag>}>
          <MapPanel compact scenic />
        </ChartCard>
        <ChartCard title="实时客流趋势" action={
          <div className="chart-type-switch" aria-label="切换客流趋势图表类型">
            {(["line", "area", "bar"] as const).map((type) => (
              <button key={type} className={chartType === type ? "active" : ""} onClick={() => setChartType(type)}>
                {type}
              </button>
            ))}
          </div>
        }>
          <TrafficChart type={chartType} />
        </ChartCard>
      </div>
      <div className="grid admin-row">
        <Section title="咨询热点 TOP5" className="consultation-hotspots" action={<StatusTag tone="blue">共 {metrics.hotspots.length} 条</StatusTag>}>
          <HotspotTable rows={metrics.hotspots} />
        </Section>
      </div>
      <div className="grid grid-2 admin-row">
        <Section title="商户经营排行 TOP5">
          <ReviewTable columns={["商户名称", "交易额", "订单量", "好评率"]} rows={[
            ["武昌城市酒店", "128,635", "1,246", "98.35%"],
            ["肥肥虾庄江汉路店", "96,542", "1,102", "96.12%"],
            ["江汉关咖啡厅", "72,318", "876", "97.45%"],
            ["黄鹤楼游客中心", "68,947", "654", "95.21%"],
            ["黄鹤楼文创旗舰店", "52,486", "518", "94.88%"]
          ]} />
        </Section>
        <Section title="运营任务工单">
          <ReviewTable columns={["工单编号", "工单类型", "工单标题", "紧急程度"]} rows={[
            ["WO202606020001", "客诉处理", "游客反馈排队时间过长", "高"],
            ["WO202606020002", "设备维护", "黄鹤楼西门闸机故障", "中"],
            ["WO202606020003", "内容审核", "活动页面信息更新审核", "低"],
            ["WO202606020004", "商户协助", "商户咨询分账周期问题", "低"]
          ]} action="处理" />
        </Section>
      </div>
    </div>
  );
}

function HotspotTable({ rows }: { rows: string[][] }) {
  const columns = ["咨询主题", "咨询量", "占比", "较昨日"];
  return (
    <div className="table-wrap">
      <table className="table dashboard-hotspot-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="muted">暂无匹配数据</td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {columns.map((_, cellIndex) => <td key={cellIndex}>{row[cellIndex] ?? "-"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContentPage() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => merchants.map(ensureMerchantTag));
  const [filters, setFilters] = useState<AdminFilterState>(defaultFilterState);
  const [merchantIds, setMerchantIds] = useState<string[]>([]);
  const [selectedMerchantNames, setSelectedMerchantNames] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", category: "住宿", phone: "", desc: "" });
  const contentTabs = ["商户管理", "景点内容管理", "活动专题管理", "FAQ知识库", "标签管理", "审核中心", "工作流配置"];
  const [activeTab, setActiveTab] = useState(contentTabs[0]);
  const visibleRows = useMemo(() => filterAdminRows(rows, filters), [filters, rows]);
  const selectedVisibleRows = visibleRows.filter((row) => selectedMerchantNames.includes(merchantRowKey(row)));

  useEffect(() => {
    fetchMerchants().then((items) => {
      setMerchantIds(items.map((item) => item.id));
      setRows(items.map((item) => [item.name, item.category, item.status, item.inventoryStatus, item.rating, String(item.orderCount), item.reviewStatus, "未设置"]));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const visibleKeys = visibleRows.map(merchantRowKey);
    setSelectedMerchantNames((current) => {
      const next = current.filter((key) => visibleKeys.includes(key));
      if (next.length) return next;
      return visibleKeys[0] ? [visibleKeys[0]] : [];
    });
  }, [visibleRows]);

  const saveMerchant = async () => {
    const validation = validateRequired({ 商户名称: form.name, 联系人手机号: form.phone, 商户介绍: form.desc });
    if (!validation.ok) {
      setNotice(validation.message);
      return;
    }
    try {
      const created = await createMerchant(form);
      setMerchantIds((prev) => [created.id, ...prev]);
      setRows((prev) => [[created.name, created.category, created.status, created.inventoryStatus, created.rating, String(created.orderCount), created.reviewStatus, "未设置"], ...prev]);
      setSelectedMerchantNames([created.name]);
      setNotice("已创建商户并发起审核，记录已落库。");
    } catch {
      setRows((prev) => [[form.name, form.category, "营业中", "待同步", "暂无", "0", "待审核", "未设置"], ...prev]);
      setSelectedMerchantNames([form.name]);
      setNotice("服务端不可用，已创建本地演示商户。");
    }
    setOpen(false);
    setForm({ name: "", category: "住宿", phone: "", desc: "" });
  };

  const requireSelectedMerchants = () => {
    if (selectedVisibleRows.length) return selectedVisibleRows;
    setNotice("请先勾选至少一条商户记录。");
    return [];
  };

  const batchEnableMerchants = () => {
    const selected = requireSelectedMerchants();
    if (!selected.length) return;
    const selectedKeys = new Set(selected.map(merchantRowKey));
    setRows((prev) => prev.map((row) => selectedKeys.has(merchantRowKey(row)) ? [row[0], row[1], "营业中", row[3], row[4], row[5], row[6], row[7] ?? "未设置"] : row));
    setNotice(`已批量启用 ${selected.length} 个商户，营业状态已更新。`);
  };

  const batchSyncMerchants = async () => {
    const selected = requireSelectedMerchants();
    if (!selected.length) return;
    const selectedKeys = new Set(selected.map(merchantRowKey));
    const selectedIndexes = rows.map((row, index) => selectedKeys.has(merchantRowKey(row)) ? index : -1).filter((index) => index >= 0);
    setNotice(`正在批量同步 ${selected.length} 个商户库存...`);
    try {
      await Promise.allSettled(selectedIndexes.map((index) => merchantIds[index] ? syncMerchantInventory(merchantIds[index]) : Promise.resolve()));
      setNotice(`已批量同步 ${selected.length} 个商户库存，库存状态已更新。`);
    } catch {
      setNotice(`服务端不可用，已本地演示同步 ${selected.length} 个商户库存。`);
    } finally {
      setRows((prev) => prev.map((row) => selectedKeys.has(merchantRowKey(row)) ? [row[0], row[1], row[2], "已同步", row[4], row[5], row[6], row[7] ?? "未设置"] : row));
    }
  };

  const batchTagMerchants = () => {
    const selected = requireSelectedMerchants();
    if (!selected.length) return;
    const selectedKeys = new Set(selected.map(merchantRowKey));
    setRows((prev) => prev.map((row) => selectedKeys.has(merchantRowKey(row)) ? [row[0], row[1], row[2], row[3], row[4], row[5], row[6], "优先推荐"] : row));
    setNotice(`已为 ${selected.length} 个商户设置「优先推荐」标签。`);
  };

  const batchDeleteMerchants = () => {
    const selected = requireSelectedMerchants();
    if (!selected.length) return;
    const selectedKeys = new Set(selected.map(merchantRowKey));
    setRows((prev) => prev.filter((row) => !selectedKeys.has(merchantRowKey(row))));
    setMerchantIds((prev) => prev.filter((_, index) => !selectedKeys.has(merchantRowKey(rows[index] ?? []))));
    setSelectedMerchantNames([]);
    setNotice(`已删除 ${selected.length} 个演示商户记录。`);
  };

  return (
    <>
      <PageHeader
        title="内容与商户管理"
        subtitle="管理平台内容资源、商户信息及审核流程，保障信息质量与用户体验"
        actions={<><button className="primary-btn" onClick={() => setOpen(true)}><Plus size={16} /> 新增商户</button><button className="ghost-btn"><Download size={16} /> 导出数据</button></>}
      />
      <div className="tab-strip" style={{ marginBottom: 16 }}>
        {contentTabs.map((item) => <button className={activeTab === item ? "primary-btn" : "ghost-btn"} onClick={() => { setActiveTab(item); setNotice(`${item}视图已打开。`); }} key={item}>{item}</button>)}
      </div>
      <FilterBar onQuery={setFilters} onReset={() => setFilters(defaultFilterState)} />
      {activeTab === "商户管理" ? <Section title="商户列表" action={<StatusTag tone="blue">共 {visibleRows.length} 条 · 已选 {selectedVisibleRows.length}</StatusTag>} className="card-pad" >
        <div className="filters" style={{ marginBottom: 12 }}>
          <button className="ghost-btn" onClick={batchEnableMerchants}>批量启用</button>
          <button className="ghost-btn" onClick={() => void batchSyncMerchants()}>批量同步库存</button>
          <button className="ghost-btn" onClick={batchTagMerchants}>批量设置标签</button>
          <button className="ghost-btn" style={{ color: "var(--red)" }} onClick={batchDeleteMerchants}>批量删除</button>
        </div>
        {notice ? <p className="muted">{notice}</p> : null}
        <ReviewTable
          columns={merchantColumns}
          rows={visibleRows}
          action="同步库存"
          getRowKey={merchantRowKey}
          selectedRowKeys={selectedMerchantNames}
          onRowCheckedChange={(row, _index, checked) => {
            const key = merchantRowKey(row);
            setSelectedMerchantNames((current) => checked ? Array.from(new Set([...current, key])) : current.filter((item) => item !== key));
          }}
          onAllCheckedChange={(checked, nextRows) => setSelectedMerchantNames(checked ? nextRows.map(merchantRowKey) : [])}
          onAction={async (row) => {
            const rowIndex = rows.findIndex((item) => merchantRowKey(item) === merchantRowKey(row));
            if (rowIndex < 0) return;
            try {
              const id = merchantIds[rowIndex];
              if (id) await syncMerchantInventory(id);
              setRows((prev) => prev.map((item, index) => index === rowIndex ? [...item.slice(0, 3), "已同步", ...item.slice(4)] : item));
              setNotice("库存同步状态已通过服务端更新。");
            } catch {
              setRows((prev) => prev.map((item, index) => index === rowIndex ? [...item.slice(0, 3), item[3] === "已同步" ? "同步失败" : "已同步", ...item.slice(4)] : item));
              setNotice("服务端不可用，已切换本地演示同步。");
            }
          }}
        />
      </Section> : <Section title={activeTab} action={<StatusTag tone="blue">演示视图</StatusTag>} className="card-pad">
        {notice ? <p className="muted">{notice}</p> : null}
        <p className="muted">当前已切换到{activeTab}，可通过左侧运营导航进入对应完整页面。</p>
      </Section>}
      <div className="grid grid-3" style={{ marginTop: 18 }}>
        <Section title="审核中心" action={<StatusTag tone="red">12</StatusTag>}>
          {["待审核商户 5", "待审核内容 7", "即将过期内容 3", "驳回待处理 0"].map((item) => <p key={item}><StatusTag tone="orange">待办</StatusTag> {item}</p>)}
        </Section>
        <Section title="内容与商户工作流">
          {["商户入驻审核流程：提交 → 资料初审 → 资质审核 → 上线", "内容发布审核流程：提交 → 内容审核 → 合规审核 → 发布"].map((item) => <p key={item}>{item}</p>)}
        </Section>
        <Section title="策略配置">
          {["推荐策略 已启用 3 个策略", "券包投放 已启用 2 个活动", `活动排期 下次发布 ${monthDay(addDaysISO(1))} 10:00`].map((item) => <p key={item}><StatusTag tone="green">启用中</StatusTag> {item}</p>)}
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
  const [filters, setFilters] = useState<AdminFilterState>(defaultFilterState);
  const [notice, setNotice] = useState("");
  const knowledgeTabs = ["FAQ列表", "分类管理", "知识导入", "版本记录"];
  const [activeTab, setActiveTab] = useState(knowledgeTabs[0]);
  const visibleRows = useMemo(() => filterAdminRows(rows, filters), [filters, rows]);
  const metrics: MetricItem[] = [
    { label: "总FAQ数", value: "1,248", delta: "较昨日 +28", tone: "blue", icon: BookOpenCheck },
    { label: "已发布", value: "1,036", delta: "较昨日 +21", tone: "green", icon: CheckCircle2 },
    { label: "待更新", value: "132", delta: "较昨日 +7", tone: "orange", icon: UploadCloud },
    { label: "命中次数", value: "638,245", delta: "较昨日 +12,845", tone: "purple", icon: DatabaseZap }
  ];
  return (
    <>
      <PageHeader title="FAQ知识库管理" subtitle="管理旅行相关 FAQ 与知识内容，支持多语言、版本管理与数据溯源" actions={<button className="primary-btn" onClick={() => setNotice("索引重建任务已进入演示队列。")}><DatabaseZap size={16} /> 重新构建索引</button>} />
      <div className="tab-strip" style={{ marginBottom: 16 }}>{knowledgeTabs.map((item) => <button className={activeTab === item ? "primary-btn" : "ghost-btn"} onClick={() => { setActiveTab(item); setNotice(`${item}视图已打开。`); }} key={item}>{item}</button>)}</div>
      <div className="grid grid-4">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>
      <div className="wide-split knowledge-layout">
        <main className="grid">
          <FilterBar
            dense
            statusOptions={["全部状态", "已发布", "待更新"]}
            onQuery={setFilters}
            onReset={() => setFilters(defaultFilterState)}
          />
          <Section title="知识条目" className="knowledge-table-section">
            {notice ? <p className="muted">{notice}</p> : null}
            <ReviewTable
              columns={knowledgeColumns}
              rows={visibleRows}
              action="切换发布"
              onAction={(row) => {
                const rowIndex = rows.findIndex((item) => item === row);
                if (rowIndex < 0) return;
                setRows((prev) => prev.map((item, index) => index === rowIndex ? [...item.slice(0, 4), item[4] === "已发布" ? "待更新" : "已发布", item[5]] : item));
                setNotice("知识条目状态已更新。");
              }}
            />
          </Section>
        </main>
        <Section title="编辑 FAQ" className="faq-editor-panel" action={<Settings2 size={18} />}>
          <div className="faq-editor-form">
            <label className="faq-field">
              <span>问题标题</span>
              <input className="field" value="黄鹤楼演示票务多少钱？" readOnly />
            </label>
            <label className="faq-field">
              <span>分类</span>
              <select className="field"><option>门票政策</option></select>
            </label>
            <label className="faq-field">
              <span>答案内容</span>
              <textarea className="field" rows={6} value={"当前系统仅提供黄鹤楼 sandbox 票务演示：\n成人票候选：40元/人\n学生/儿童票候选：20元/人\n真实票价、库存和支付以官方渠道为准。"} readOnly />
            </label>
            <div className="faq-locale-block">
              <div className="faq-locale-head">
                <span>多语言状态</span>
                <small>3 个语种</small>
              </div>
              <div className="faq-locale-tags">
                <StatusTag tone="green">简体中文 已完成</StatusTag>
                <StatusTag tone="green">English 已完成</StatusTag>
                <StatusTag tone="orange">日本語 待翻译</StatusTag>
              </div>
            </div>
            <button className="primary-btn" onClick={() => setNotice("FAQ 更新已发布。")}><Save size={17} />发布更新</button>
          </div>
        </Section>
      </div>
    </>
  );
}

export function MerchantPage() {
  const [openForBusiness, setOpenForBusiness] = useState(true);
  const [inventoryNotice, setInventoryNotice] = useState("库存数据为演示状态。");
  const [merchantOrders, setMerchantOrders] = useState<Order[]>([]);
  const [merchantNotice, setMerchantNotice] = useState("");
  const [merchantPanel, setMerchantPanel] = useState<"overview" | "preview" | "marketing">("overview");
  const [showAllOrders, setShowAllOrders] = useState(false);
  const metrics: MetricItem[] = [
    { label: "今日订单金额", value: "￥18,752", delta: "较昨日 +12.45%", tone: "blue", icon: Store },
    { label: "今日订单数", value: "128", delta: "较昨日 +15.23%", tone: "purple", icon: PackageOpen },
    { label: "今日核销数", value: "116", delta: "较昨日 +11.11%", tone: "green", icon: CheckCircle2 },
    { label: "今日访客数", value: "2,846", delta: "较昨日 +8.32%", tone: "orange", icon: Eye },
    { label: "好评率", value: "98.2%", delta: "较昨日 +0.8%", tone: "red", icon: Bell }
  ];

  useEffect(() => {
    fetchOrders().then((items) => setMerchantOrders(items.slice(0, 8))).catch(() => undefined);
  }, []);

  const visibleMerchantOrders = showAllOrders ? merchantOrders : merchantOrders.slice(0, 4);
  const fallbackOrderRows = [
    ["15:25", "武昌城市酒店·家庭房1间", "张**", "￥680", "待核销"],
    ["14:48", "武昌城市酒店·江景大床房1间", "李**", "￥580", "已核销"],
    ["14:03", "武昌城市酒店·双床房1间", "王**", "￥480", "已核销"],
    ["13:37", "黄鹤楼演示票+武昌城市酒店套餐", "陈**", "￥899", "待核销"]
  ];
  const orderRows = merchantOrders.length ? visibleMerchantOrders.map((order) => [
    order.createdAt.slice(11, 16),
    order.title,
    order.visitorInfo[0]?.name ?? "游客",
    `￥${order.amount}`,
    order.status === "verified" ? "已核销" : order.status === "paid" || order.status === "ready_to_visit" ? "待核销" : "待支付"
  ]) : fallbackOrderRows;

  const verifyOrder = async (index: number) => {
    const order = merchantOrders[index];
    if (!order?.voucherCode) {
      triggerOperation({ scope: "merchant", type: "ticket.verify", label: "核销", metadata: { index } });
      return;
    }
    try {
      const voucher = await verifyTicketVoucher({ voucherCode: order.voucherCode, visitDate: order.visitDate, slotId: order.slotId });
      setMerchantOrders((prev) => prev.map((item) => item.id === order.id ? { ...item, status: "verified" } : item));
      setMerchantNotice(`凭证 ${voucher.code} 已完成服务端核销。`);
    } catch (error) {
      setMerchantNotice(error instanceof Error ? `核销失败：${error.message}` : "核销失败。");
    }
  };

  const verifyLatest = () => {
    const index = merchantOrders.findIndex((order) => order.voucherCode && order.status !== "verified");
    if (index < 0) {
      triggerOperation({ scope: "merchant", type: "ticket.verify", label: "扫码核销", metadata: { source: "merchant-page" } });
      return;
    }
    void verifyOrder(index);
  };

  const toggleBusiness = () => {
    const nextOpen = !openForBusiness;
    setOpenForBusiness(nextOpen);
    triggerOperation({ scope: "merchant", type: "merchant.status", label: nextOpen ? "恢复营业" : "暂停营业" });
  };

  const openMerchantPanel = (panel: "preview" | "marketing") => {
    setMerchantPanel(panel);
    setMerchantNotice(panel === "preview"
      ? "店铺预览已打开：游客端将展示门店简介、在售房型与 sandbox 套餐入口。"
      : "营销中心已打开：优惠券、套餐和活动投放均为演示配置，不会触达真实渠道。");
    triggerOperation({ scope: "merchant", type: panel === "preview" ? "merchant.preview" : "merchant.marketing", label: panel === "preview" ? "店铺预览" : "营销中心" });
  };

  return (
    <>
      <PageHeader title="商户工作台" subtitle={`下午好，武昌城市酒店。当前营业状态：${openForBusiness ? "营业中" : "暂停营业"}`} actions={<><button className="ghost-btn" onClick={() => openMerchantPanel("preview")}><Eye size={16} /> 店铺预览</button><button className="ghost-btn" onClick={verifyLatest}><QrIcon /> 扫码核销</button><button className="primary-btn" onClick={toggleBusiness}>{openForBusiness ? "暂停营业" : "恢复营业"}</button></>} />
      <div className="grid grid-5">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>
      {merchantNotice ? <p className="audit-notice">{merchantNotice}</p> : null}
      {merchantPanel === "preview" ? (
        <Section title="店铺预览" className="card-pad" action={<StatusTag tone="blue">游客端演示</StatusTag>}>
          <div className="spot-card compact">
            <img src={spotImages.hotel} alt="武昌城市酒店预览" />
            <div>
              <strong>武昌城市酒店</strong>
              <p className="muted">展示门店简介、房型库存、套餐入口与 sandbox 票务联动，不代表真实上架。</p>
              <StatusTag tone={openForBusiness ? "green" : "orange"}>{openForBusiness ? "营业中" : "暂停营业"}</StatusTag>
            </div>
          </div>
        </Section>
      ) : null}
      {merchantPanel === "marketing" ? (
        <Section title="营销中心" className="card-pad" action={<StatusTag tone="orange">演示配置</StatusTag>}>
          <div className="grid grid-3">
            {["优惠券 8 张 · 可编辑", "套餐 5 个 · sandbox 联动", "活动投放 3 个 · 待报名"].map((item) => <div className="empty-state" key={item}>{item}</div>)}
          </div>
        </Section>
      ) : null}
      <div className="grid grid-3" style={{ marginTop: 18 }}>
        <ChartCard title="营业概况" action={<div className="filters"><button className="ghost-btn">今日</button><button className="primary-btn">近7日</button></div>}>
          <TrafficChart type="area" />
        </ChartCard>
        <Section title={`今日订单${showAllOrders ? "（全部）" : ""}`} action={<button className="subtle-link" onClick={() => { setShowAllOrders(true); setMerchantNotice(`已展开更多订单，当前显示 ${orderRows.length} 条。`); }}>查看更多</button>}>
          {merchantNotice ? <p className="muted">{merchantNotice}</p> : null}
          <ReviewTable columns={["时间", "商品", "游客", "金额", "状态"]} rows={orderRows} action="核销" onAction={(_, index) => void verifyOrder(index)} />
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
          <button className="primary-btn" onClick={() => openMerchantPanel("marketing")}>营销中心</button>
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
  const [filters, setFilters] = useState<AdminFilterState>(defaultFilterState);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", tag: "节庆/热门" });
  const visibleRows = useMemo(() => filterAdminRows(rows, filters), [filters, rows]);

  const saveCampaign = () => {
    const validation = validateRequired({ 专题名称: form.name, 专题标签: form.tag });
    if (!validation.ok) {
      setNotice(validation.message);
      return;
    }
    setRows((prev) => [[form.name, form.tag, "待上线", "-", "-", "-"], ...prev]);
    setNotice(`已新建专题「${form.name}」，状态为待上线。`);
    setForm({ name: "", tag: "节庆/热门" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader title="活动专题管理" subtitle="管理平台活动专题与营销活动，提升内容曝光与转化效果" actions={<><button className="primary-btn" onClick={() => setOpen(true)}><Plus size={16} /> 新建专题</button><button className="ghost-btn"><Download size={16} /> 导出数据</button></>} />
      <div className="grid grid-4">
        {[
          { label: "专题总数", value: "128", delta: "较昨日 +3", tone: "blue" },
          { label: "进行中活动", value: "34", delta: "较昨日 +2", tone: "green" },
          { label: "本周新增", value: "6", delta: "较上周 +2", tone: "purple" },
          { label: "活动转化率", value: "4.62%", delta: "较昨日 +0.38%", tone: "orange" }
        ].map((metric) => <MetricCard key={metric.label} metric={metric as MetricItem} />)}
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        <FilterBar
          statusOptions={["全部状态", "进行中", "待上线", "已结束", "已下架"]}
          onQuery={setFilters}
          onReset={() => setFilters(defaultFilterState)}
        />
        <Section title="专题列表" action={<StatusTag tone="blue">共 128 条</StatusTag>}>
          {notice ? <p className="muted">{notice}</p> : null}
          <ReviewTable
            columns={campaignColumns}
            rows={visibleRows}
            action="上下架"
            onAction={(row) => {
              const rowIndex = rows.findIndex((item) => item === row);
              if (rowIndex < 0) return;
              setRows((prev) => prev.map((item, index) => index === rowIndex ? [item[0], item[1], nextPublishStatus(item[2]), item[3], item[4], item[5]] : item));
              setNotice("活动专题状态已更新。");
            }}
          />
        </Section>
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <ChartCard title="活动转化趋势"><TrafficChart type="bar" /></ChartCard>
        <Section title="近期上线日程">
          {[`${monthDay(addDaysISO(1))} 江滩夜游周末线 待上线`, `${monthDay(addDaysISO(3))} 端午民俗文化节 待上线`, `${monthDay(addDaysISO(7))} 亲子研学季 待上线`].map((item) => <p key={item}><CalendarDays size={16} color="var(--blue)" /> {item}</p>)}
        </Section>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="新建专题">
        <div className="grid">
          <input className="field" placeholder="专题名称" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <select className="field" value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })}>
            <option>节庆/热门</option>
            <option>本地游/夜游季</option>
            <option>亲子/研学</option>
            <option>主题/摄影</option>
          </select>
          {notice ? <p className="muted">{notice}</p> : null}
          <div className="filters">
            <button className="primary-btn" onClick={saveCampaign}>保存专题</button>
            <button className="ghost-btn" onClick={() => setOpen(false)}>取消</button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function ReviewPage() {
  const [reviewItems, setReviewItems] = useState<ReviewListItem[]>(reviewRows.map((row) => ({ row })));
  const [filters, setFilters] = useState<AdminFilterState>(defaultFilterState);
  const [selected, setSelected] = useState(reviewRows[0]);
  const [selectedReviewKeys, setSelectedReviewKeys] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(true);
  const [remark, setRemark] = useState("");
  const [notice, setNotice] = useState("");
  const rows = useMemo(() => filterReviewRows(reviewItems.map((item) => item.row), filters), [filters, reviewItems]);

  useEffect(() => {
    fetchReviews().then((items) => {
      const nextItems = items.map((item) => ({
        id: item.id,
        row: [item.subjectName, item.submitter, item.type, item.riskNote, item.status, item.submittedAt]
      }));
      const nextRows = nextItems.map((item) => item.row);
      setReviewItems(nextItems);
      if (nextRows[0]) setSelected(nextRows[0]);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!rows.length || rows.some((row) => sameReviewRow(row, selected))) return;
    setSelected(rows[0]);
    setRemark("");
  }, [rows, selected]);

  useEffect(() => {
    const visibleKeys = rows.map(reviewRowKey);
    setSelectedReviewKeys((current) => {
      const next = current.filter((key) => visibleKeys.includes(key));
      if (next.length) return next;
      return visibleKeys[0] ? [visibleKeys[0]] : [];
    });
  }, [rows]);

  const applyReview = async (status: "已通过" | "已驳回") => {
    if (status === "已驳回" && !remark.trim()) {
      setNotice("驳回必须填写审核备注。");
      return;
    }
    const selectedItem = reviewItems.find((item) => sameReviewRow(item.row, selected));
    try {
      if (selectedItem?.id) await decideReview(selectedItem.id, status, remark);
      setNotice(`已通过服务端${status === "已通过" ? "通过" : "驳回"}：${selected[0]}`);
    } catch {
      setNotice(`服务端不可用，已本地演示${status === "已通过" ? "通过" : "驳回"}：${selected[0]}`);
    } finally {
      setReviewItems((prev) => prev.map((item) => sameReviewRow(item.row, selected) ? { ...item, row: [item.row[0], item.row[1], item.row[2], item.row[3], status, item.row[5]] } : item));
      setSelected((prev) => [prev[0], prev[1], prev[2], prev[3], status, prev[5]]);
      setRemark("");
    }
  };

  const applyBatchReview = async (status: "已通过" | "已驳回") => {
    const selectedRows = rows.filter((row) => selectedReviewKeys.includes(reviewRowKey(row)));
    if (!selectedRows.length) {
      setNotice("请先勾选至少一条审核记录。");
      return;
    }
    if (status === "已驳回" && !remark.trim()) {
      setNotice("批量驳回必须填写审核备注。");
      return;
    }
    const selectedKeys = new Set(selectedRows.map(reviewRowKey));
    const selectedItems = reviewItems.filter((item) => selectedKeys.has(reviewRowKey(item.row)));
    try {
      await Promise.allSettled(selectedItems.map((item) => item.id ? decideReview(item.id, status, remark) : Promise.resolve()));
      setNotice(`已批量${status === "已通过" ? "通过" : "驳回"} ${selectedRows.length} 条审核记录。`);
    } catch {
      setNotice(`服务端不可用，已本地演示批量${status === "已通过" ? "通过" : "驳回"} ${selectedRows.length} 条审核记录。`);
    } finally {
      setReviewItems((prev) => prev.map((item) => selectedKeys.has(reviewRowKey(item.row)) ? { ...item, row: [item.row[0], item.row[1], item.row[2], item.row[3], status, item.row[5]] } : item));
      if (selectedKeys.has(reviewRowKey(selected))) {
        setSelected((prev) => [prev[0], prev[1], prev[2], prev[3], status, prev[5]]);
      }
      setRemark("");
    }
  };

  return (
    <>
      <PageHeader title="审核中心" subtitle="商户审核、内容审核、活动审核与风险复核统一处理" actions={<><button className="primary-btn" onClick={() => void applyBatchReview("已通过")}><Send size={16} /> 批量通过</button><button className="ghost-btn" style={{ color: "var(--red)" }} onClick={() => void applyBatchReview("已驳回")}>批量驳回</button></>} />
      <div className="grid grid-5">
        {[
          { label: "待审核", value: "128", delta: "较昨日 +18", tone: "blue" },
          { label: "审核中", value: "36", delta: "较昨日 -6", tone: "purple" },
          { label: "已通过", value: "1,248", delta: "较昨日 +132", tone: "green" },
          { label: "已驳回", value: "214", delta: "较昨日 +21", tone: "red" },
          { label: "驳回率", value: "14.63%", delta: "较昨日 +1.28%", tone: "orange" }
        ].map((metric) => <MetricCard key={metric.label} metric={metric as MetricItem} />)}
      </div>
      <div className="wide-split review-layout" style={{ marginTop: 18 }}>
        <main className="grid">
          <FilterBar
            dense
            scenicOptions={reviewScenicOptions}
            statusOptions={reviewStatusOptions}
            onQuery={setFilters}
            onReset={() => setFilters(defaultFilterState)}
          />
          <Section title="审核列表">
            <ReviewTable
              columns={reviewColumns}
              rows={rows}
              action="查看"
              getRowKey={reviewRowKey}
              selectedRowKeys={selectedReviewKeys}
              onRowCheckedChange={(row, _index, checked) => {
                const key = reviewRowKey(row);
                setSelectedReviewKeys((current) => checked ? Array.from(new Set([...current, key])) : current.filter((item) => item !== key));
              }}
              onAllCheckedChange={(checked, nextRows) => setSelectedReviewKeys(checked ? nextRows.map(reviewRowKey) : [])}
              onAction={(row) => {
                setSelected(row);
                setDetailOpen(true);
              }}
            />
          </Section>
          <div className="grid grid-2">
            <Section title="审核日志">
              <ReviewTable columns={["时间", "操作人", "操作类型", "结果"]} rows={[
                [`${todayISO()} 10:12`, "张景区", "通过", "通过"],
                [`${todayISO()} 09:48`, "王思语", "驳回", "驳回"],
                [`${todayISO()} 09:32`, "陈梦", "通过", "通过"]
              ]} />
            </Section>
            <ChartCard title="审核趋势（7日）"><TrafficChart type="line" /></ChartCard>
          </div>
        </main>
        <Section title="审核详情" className="audit-detail-panel" action={<button className="ghost-btn" onClick={() => setDetailOpen((open) => !open)}>{detailOpen ? "收起" : "展开"}</button>}>
          {detailOpen ? <div className="audit-detail-body">
            <div className="audit-summary-card">
              <img src={spotImages.food} alt="审核材料" />
              <div className="audit-summary-main">
                <div className="audit-status-row">
                  <StatusTag tone={selected[4] === "已通过" ? "green" : selected[4] === "已驳回" ? "red" : "orange"}>{selected[4]}</StatusTag>
                  <span>{selected[2]}</span>
                </div>
                <h3>{selected[0]}</h3>
                <div className="audit-meta-grid">
                  <span><b>提交人</b>{selected[1]}</span>
                  <span><b>提交时间</b>{selected[5]}</span>
                </div>
              </div>
            </div>
            <div className="audit-risk-card">
              <AlertTriangle size={18} />
              <div>
                <strong>风险提示</strong>
                <p>{selected[3]}</p>
              </div>
            </div>
            {notice ? <p className="audit-notice">{notice}</p> : null}
            <div className="audit-form-grid">
              <label>审核结果</label>
              <select className="field"><option>请选择审核结果</option><option>通过</option><option>驳回</option><option>转人工复核</option></select>
              <label>审核备注</label>
              <textarea className="field" placeholder="请填写审核备注" value={remark} onChange={(event) => setRemark(event.target.value)} />
            </div>
            <div className="audit-action-row"><button className="ghost-btn" onClick={() => setRemark("")}>取消</button><button className="ghost-btn danger" onClick={() => applyReview("已驳回")}><Trash2 size={15} /> 驳回</button><button className="primary-btn" onClick={() => applyReview("已通过")}>通过</button></div>
          </div> : <p className="muted">审核详情已收起，当前选中：{selected[0]} · {selected[4]}。</p>}
        </Section>
      </div>
    </>
  );
}

export function WorkflowPage() {
  const baseWorkflowTabs = ["商户入驻审核流程", "内容发布审核流程", "活动上线流程", "工单升级规则"];
  const [node, setNode] = useState(workflowNodes[1]);
  const [customFlows, setCustomFlows] = useState<string[]>([]);
  const workflowTabs = [...baseWorkflowTabs, ...customFlows];
  const [activeFlow, setActiveFlow] = useState(baseWorkflowTabs[0]);
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState("v1.2.0");
  const [flowStatus, setFlowStatus] = useState("启用中");
  const [extraLogs, setExtraLogs] = useState<string[][]>([]);
  const logs = useMemo(() => [
    ...extraLogs,
    [`${todayISO()} 14:35`, "张景区", "更新节点", `修改了「${activeFlow} / ${node.title}」的 SLA 配置`],
    [`${todayISO()} 11:20`, "李运营", "新增节点", "在资质审核后新增实地核验节点"],
    [`${addDaysISO(-1)} 18:10`, "王法务", "发布流程", "发布流程版本 v1.2.0"]
  ], [activeFlow, extraLogs, node.title]);

  const addWorkflowLog = (action: string, detail: string) => {
    setExtraLogs((prev) => [[operationTime(), "张运营", action, detail], ...prev].slice(0, 6));
  };

  const createFlow = () => {
    const name = `新建演示流程 ${customFlows.length + 1}`;
    setCustomFlows((prev) => [...prev, name]);
    setActiveFlow(name);
    setFlowStatus("草稿已保存");
    setNotice(`已创建流程「${name}」，当前为演示草稿。`);
    addWorkflowLog("新建流程", `创建了「${name}」`);
  };

  const saveDraft = () => {
    setFlowStatus("草稿已保存");
    setNotice(`已保存「${activeFlow}」草稿，节点：${node.title}。`);
    addWorkflowLog("保存草稿", `保存了「${activeFlow} / ${node.title}」草稿配置`);
    triggerOperation({ scope: "admin", type: "workflow.save", label: "保存草稿", metadata: { activeFlow, nodeId: node.id } });
  };

  const publishConfig = () => {
    setVersion("v1.2.1");
    setFlowStatus("已发布");
    setNotice(`已发布「${activeFlow}」演示配置，版本更新为 v1.2.1。`);
    addWorkflowLog("发布配置", `发布了「${activeFlow}」版本 v1.2.1`);
    triggerOperation({ scope: "admin", type: "workflow.publish", label: "发布配置", metadata: { activeFlow, version: "v1.2.1" } });
  };

  const saveNodeConfig = () => {
    setNotice(`已保存节点「${node.title}」配置，SLA：${node.sla}。`);
    addWorkflowLog("保存配置", `保存了「${activeFlow} / ${node.title}」节点配置`);
    triggerOperation({ scope: "admin", type: "workflow.save", label: "保存配置", metadata: { activeFlow, nodeId: node.id } });
  };

  return (
    <>
      <PageHeader
        title="工作流配置"
        subtitle="可视化配置平台各类内容与业务流程，支持条件分支、并行会签、自动化触发与通知"
        actions={<><button className="ghost-btn" onClick={createFlow}><Plus size={16} /> 新建流程</button><button className="ghost-btn" onClick={saveDraft}><Save size={16} /> 保存草稿</button><button className="primary-btn" onClick={publishConfig}>发布配置</button></>}
      />
      {notice ? <p className="audit-notice">{notice}</p> : null}
      <div className="tab-strip" style={{ marginBottom: 16 }}>{workflowTabs.map((item) => <button className={activeFlow === item ? "primary-btn" : "ghost-btn"} onClick={() => setActiveFlow(item)} key={item}>{item}</button>)}</div>
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
            <button className="primary-btn" onClick={saveNodeConfig}>保存配置</button>
          </div>
        </Section>
      </div>
      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <Section title="最近变更">
          <ReviewTable columns={["时间", "操作人", "操作", "变更内容"]} rows={logs} />
        </Section>
        <Section title="流程概览">
          <p>当前版本：{version} <StatusTag tone={flowStatus === "草稿已保存" ? "orange" : "green"}>{flowStatus === "草稿已保存" ? "草稿" : "已发布"}</StatusTag></p>
          <p>流程状态：<StatusTag tone={flowStatus === "草稿已保存" ? "orange" : "green"}>{flowStatus}</StatusTag></p>
          <Donut data={channelData.slice(0, 4).map((item) => ({ name: item.name, value: item.value, fill: item.fill }))} />
        </Section>
      </div>
    </>
  );
}
