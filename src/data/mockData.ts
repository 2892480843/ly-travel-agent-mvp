import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Bot,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Compass,
  CreditCard,
  DatabaseZap,
  FileCheck2,
  Home,
  Map,
  PackageCheck,
  Route,
  Sparkles,
  Store,
  Ticket,
  UserRound,
  Workflow,
  UsersRound,
  WalletCards,
  WandSparkles,
  Clock3
} from "lucide-react";
import type { AppRoute, MetricItem, ScenicSpot, TimelineItem, WorkflowNode } from "../types";
import { DEFAULT_TICKET_ROUTE } from "../config/city";

export const routes: AppRoute[] = [
  { path: "/", label: "游客端首页", group: "游客端", icon: Home },
  { path: "/assistant", label: "AI旅行助手", group: "游客端", icon: Bot },
  { path: "/recommend", label: "个性化推荐", group: "游客端", icon: Sparkles },
  { path: "/plan", label: "武汉三日游规划", group: "游客端", icon: Route },
  { path: "/spot/yellow-crane-tower", label: "黄鹤楼详情", group: "游客端", icon: Compass },
  { path: DEFAULT_TICKET_ROUTE, label: "黄鹤楼预约", group: "游客端", icon: Ticket },
  { path: "/ticket/detail", label: "票务详情", group: "游客端", icon: FileCheck2 },
  { path: "/pay", label: "订单支付", group: "游客端", icon: CreditCard },
  { path: "/me", label: "行程与订单", group: "游客端", icon: UserRound },
  { path: "/packages", label: "智能套餐", group: "游客端", icon: PackageCheck },
  { path: "/immersive", label: "AR/VR体验", group: "游客端", icon: Activity },
  { path: "/map", label: "平台导航", group: "游客端", icon: Map },
  { path: "/admin/dashboard", label: "运营看板", group: "运营端", icon: BarChart3 },
  { path: "/admin/content", label: "内容与商户", group: "运营端", icon: Building2 },
  { path: "/admin/knowledge", label: "知识库管理", group: "运营端", icon: DatabaseZap },
  { path: "/merchant", label: "商户工作台", group: "商户端", icon: Store },
  { path: "/admin/campaigns", label: "活动专题", group: "运营端", icon: CalendarCheck },
  { path: "/admin/review", label: "审查处理", group: "运营端", icon: ClipboardCheck },
  { path: "/admin/workflow", label: "工作流配置", group: "运营端", icon: Workflow }
];

export const spotImages = {
  yellowCraneTower: "https://store.is.autonavi.com/showpic/42b23731ef5018c23ad9ff611e78747d",
  yellowCranePark: "https://store.is.autonavi.com/showpic/22cbbe3f04476d779a154637a4de5006",
  jianghanGuan: "https://store.is.autonavi.com/showpic/99a8ddea69655edf96b4b15961ee8241",
  hankouRiverfront: "https://aos-comment.amap.com/B0FFHTU92U/comment/bfd55c60a272ee9fc1997ac599a461f3_2048_2048_80.jpg",
  hubeiMuseum: "https://store.is.autonavi.com/showpic/3ff2a74321d3dc4cba39573752bfad60",
  wuhanMuseum: "https://store.is.autonavi.com/showpic/19ba7863e5341f39260bdb9945cee524",
  wuhanZoo: "https://store.is.autonavi.com/showpic/188b59f27a892caf0a2b082398d647bf",
  hefang: "https://store.is.autonavi.com/showpic/e7a956f2beba64afa31364a6858dac82",
  food: "https://store.is.autonavi.com/showpic/b435f423bd5669ee3efad16aa6808a94",
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  night: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  mountain: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
  ar: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?auto=format&fit=crop&w=1600&q=85"
};

export const heroImage =
  spotImages.yellowCraneTower;

export const cityStats = [
  { label: "今日可预约产品", value: "426", hint: "景点/演出/餐饮" },
  { label: "AI 已服务游客", value: "18.2万", hint: "本周 +21.6%" },
  { label: "平均省下排队", value: "32分钟", hint: "基于实时客流" },
  { label: "联单转化", value: "18.74%", hint: "票务到消费" }
];

export const scenicSpots: ScenicSpot[] = [
  {
    name: "黄鹤楼",
    image: spotImages.yellowCraneTower,
    rating: 4.8,
    crowd: "舒适",
    tags: ["国家级景点", "历史文化", "可预约"],
    reason: "你偏好低强度文化游，优先安排上午入园并避开午间高峰；票务仅为 sandbox/demo。",
    duration: "1.5-2小时",
    location: "武昌区",
    weather: "晴 26℃",
    distance: "距你 1.2km"
  },
  {
    name: "湖北省博物馆",
    image: spotImages.hubeiMuseum,
    rating: 4.9,
    crowd: "较少",
    tags: ["博物馆", "文化深读", "亲子"],
    reason: "你收藏过历史文化体验，室内展陈适合老人和亲子同行；开放时间以官方公告为准。",
    duration: "2小时",
    location: "武昌区",
    weather: "多云 25℃",
    distance: "距你 4.8km"
  },
  {
    name: "江汉关博物馆",
    image: spotImages.jianghanGuan,
    rating: 4.8,
    crowd: "适中",
    tags: ["博物馆", "江汉路", "历史建筑"],
    reason: "适合和江汉路、汉口江滩串联，步行强度可控。",
    duration: "1.5小时",
    location: "江汉区",
    weather: "晴 26℃",
    distance: "距你 2.6km"
  },
  {
    name: "汉口江滩-观江台",
    image: spotImages.hankouRiverfront,
    rating: 4.8,
    crowd: "舒适",
    tags: ["江滩", "拍照", "Citywalk"],
    reason: "你选择了少排队标签，江滩开阔，适合晚间慢游和拍照。",
    duration: "90分钟",
    location: "江岸区",
    weather: "晴 26℃",
    distance: "距你 2.1km"
  },
  {
    name: "武汉动物园",
    image: spotImages.wuhanZoo,
    rating: 4.7,
    crowd: "较少",
    tags: ["亲子游", "动物园", "家庭"],
    reason: "亲子出游优先推荐，可预留休息点并缩短连续步行时间。",
    duration: "3小时",
    location: "汉阳区",
    weather: "晴 27℃",
    distance: "距你 9.4km"
  },
  {
    name: "黄鹤楼公园",
    image: spotImages.yellowCranePark,
    rating: 4.7,
    crowd: "适中",
    tags: ["风景名胜", "夜场", "武昌区"],
    reason: "与黄鹤楼主景点同区域，可作为导览和拍照延展。",
    duration: "2小时",
    location: "武昌区",
    weather: "晴 26℃",
    distance: "距你 3.8km"
  }
];

export const foods = [
  { name: "肥肥虾庄(江汉路M+店)", image: spotImages.food, tags: ["湖北菜", "小龙虾"], price: 88, rating: 4.7, reason: "你偏好本地特色，距江汉关动线较近，当前仅展示演示排队状态。" },
  { name: "靓靓蒸虾(沙湖旗舰店)", image: spotImages.food, tags: ["海鲜", "夜宵"], price: 96, rating: 4.7, reason: "适合晚餐或夜宵，开放时间以官方渠道为准。" },
  { name: "金马门国际美食百汇(珞喻路店)", image: spotImages.food, tags: ["自助餐", "亲子友好"], price: 128, rating: 4.8, reason: "适合家庭快速就餐，预算较高时可作为备选。" }
];

export const timelineDays: Record<string, TimelineItem[]> = {
  "Day 1": [
    { time: "09:00", title: "酒店出发", subtitle: "司门口黄鹤楼站附近集结，AI 已同步天气与限行", type: "hotel", tags: ["步行10分钟"], meta: "空气优", traffic: "步行" },
    { time: "09:30-11:00", title: "黄鹤楼", subtitle: "登楼远眺长江与武昌城景，上午优先避开高峰", image: spotImages.yellowCraneTower, type: "spot", tags: ["必玩", "历史文化"], meta: "90分钟", open: "08:30-18:00" },
    { time: "11:20-12:20", title: "黄鹤楼公园", subtitle: "补充游览蛇山周边景观，按体力选择步行范围", image: spotImages.yellowCranePark, type: "spot", tags: ["风景名胜", "拍照"], meta: "60分钟", open: "08:30-18:00" },
    { time: "12:30-13:30", title: "肥肥虾庄(江汉路M+店)", subtitle: "武汉本地风味午餐，排队状态为演示估算", image: spotImages.food, type: "food", tags: ["推荐午餐", "湖北菜"], meta: "可取号", traffic: "地铁约20分钟" },
    { time: "13:50-15:20", title: "江汉关博物馆", subtitle: "了解汉口开埠和近代城市记忆", image: spotImages.jianghanGuan, type: "spot", tags: ["博物馆"], meta: "90分钟" },
    { time: "15:40-17:00", title: "汉口江滩-观江台", subtitle: "江滩散步与观江拍照，避开连续室内参观疲劳", image: spotImages.hankouRiverfront, type: "spot", tags: ["Citywalk"], meta: "舒适" },
    { time: "19:30", title: "返回酒店休息", subtitle: "自动同步明日湖北省博物馆预约提醒", type: "traffic", tags: ["地铁优先"], meta: "12分钟" }
  ],
  "Day 2": [
    { time: "08:40-11:20", title: "湖北省博物馆", subtitle: "AI讲解楚文化与馆藏重点，预约信息以官方为准", image: spotImages.hubeiMuseum, type: "spot", tags: ["文化深读", "室内"], meta: "2.5小时", open: "09:00-17:00" },
    { time: "12:10-13:30", title: "靓靓蒸虾(沙湖旗舰店)", subtitle: "湖北特色餐饮，预算偏高提醒", image: spotImages.food, type: "food", tags: ["湖北菜"], meta: "人均120" },
    { time: "15:00-17:40", title: "武汉博物馆", subtitle: "补充城市史脉络，作为雨天备选", image: spotImages.wuhanMuseum, type: "spot", tags: ["文化艺术"], meta: "舒适" }
  ],
  "Day 3": [
    { time: "09:30-11:30", title: "武汉动物园", subtitle: "亲子友好路线，预留休息和补给点", image: spotImages.wuhanZoo, type: "spot", tags: ["亲子"], meta: "需预约" },
    { time: "14:00-16:20", title: "解放公园", subtitle: "公园慢游收尾，步行强度低", image: spotImages.hankouRiverfront, type: "spot", tags: ["公园自然"], meta: "免费" }
  ]
};

export const kpis: MetricItem[] = [
  { label: "今日游客数", value: "36,824", delta: "较昨日 +12.45%", tone: "blue", icon: UsersRound },
  { label: "预约转化率", value: "28.35%", delta: "较昨日 +2.31%", tone: "green", icon: WandSparkles },
  { label: "AI分流率", value: "31.62%", delta: "较昨日 +3.08%", tone: "purple", icon: Bot },
  { label: "平均停留时长", value: "4.62h", delta: "较昨日 +0.35h", tone: "orange", icon: Clock3 },
  { label: "客诉率", value: "0.38%", delta: "较昨日 -0.12%", tone: "red", icon: ClipboardCheck },
  { label: "联单渗透率", value: "18.74%", delta: "较昨日 +1.91%", tone: "cyan", icon: WalletCards }
];

export const trafficData = [
  { time: "00:00", today: 2200, yesterday: 1800, ai: 620 },
  { time: "04:00", today: 9800, yesterday: 7600, ai: 1800 },
  { time: "08:00", today: 23800, yesterday: 19800, ai: 6800 },
  { time: "12:00", today: 38200, yesterday: 32600, ai: 12800 },
  { time: "16:00", today: 42100, yesterday: 36800, ai: 16200 },
  { time: "20:00", today: 36500, yesterday: 33100, ai: 14200 },
  { time: "24:00", today: 38900, yesterday: 34200, ai: 12200 }
];

export const channelData = [
  { name: "访问人数", value: 129842, fill: "#7ba7c8" },
  { name: "进入预约", value: 78635, fill: "#83b8ad" },
  { name: "预约成功", value: 36824, fill: "#6fa88a" },
  { name: "入园核销", value: 32165, fill: "#d8b96a" },
  { name: "二次消费", value: 12478, fill: "#c66d63" }
];

export const orders = [
  { id: "T20260602001", title: "黄鹤楼 sandbox 成人票 x2", status: "待出行", amount: 110, date: "2026-06-06 08:00-10:00", image: spotImages.yellowCraneTower },
  { id: "P20260602018", title: "武汉文化深度游三日行程", status: "已确认", amount: 2680, date: "2026-06-06 至 06-08", image: spotImages.hubeiMuseum },
  { id: "M20260602033", title: "江汉关夜游套餐", status: "待支付", amount: 398, date: "支付剩余 14:56", image: spotImages.jianghanGuan }
];

export const ticketOptions = [
  { name: "成人票", price: 40, desc: "18-60周岁游客", stock: "库存充足" },
  { name: "学生票", price: 20, desc: "全日制在校学生", stock: "库存充足" },
  { name: "儿童票", price: 20, desc: "6-18周岁未成年人", stock: "余票充足" },
  { name: "老人票", price: 20, desc: "60-70周岁老人", stock: "余票紧张" },
  { name: "优待票", price: 0, desc: "残疾人/现役军人", stock: "需核验" }
];

export const ticketSlots = [
  { time: "08:00-10:00", status: "余票充足", tone: "green" },
  { time: "10:00-12:00", status: "余票充足", tone: "green" },
  { time: "12:00-14:00", status: "余票紧张", tone: "orange" },
  { time: "14:00-16:00", status: "余票紧张", tone: "orange" },
  { time: "16:00-17:30", status: "余票充足", tone: "green" }
] as const;

export const packages = [
  { name: "黄鹤楼 + 武昌酒店 2天1晚套餐", image: spotImages.yellowCraneTower, type: "门票+酒店", desc: "黄鹤楼 sandbox 门票候选 + 武昌酒店演示房型", price: 988, origin: 1286, save: 298, tags: ["适合周末", "可报销", "sandbox票务"] },
  { name: "成都大熊猫基地 + 川味美食套餐", image: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?auto=format&fit=crop&w=1200&q=80", type: "门票+餐饮", desc: "熊猫基地门票 + 特色川菜双人餐", price: 368, origin: 486, save: 118, tags: ["亲子优选", "含纪念品"] },
  { name: "湖北省博物馆 + 江滩接驳套餐", image: spotImages.hubeiMuseum, type: "导览+接驳", desc: "博物馆导览演示 + 江滩接驳", price: 658, origin: 856, save: 198, tags: ["2天1晚", "可撤销"] },
  { name: "江汉关 + 保成路夜市套餐", image: spotImages.jianghanGuan, type: "夜游+餐饮", desc: "江汉关导览 + 夜市餐饮券演示", price: 598, origin: 796, save: 198, tags: ["夜间打卡", "沉浸体验"] }
];

export const workflowNodes: WorkflowNode[] = [
  { id: "start", x: 50, y: 8, title: "游客意图识别", type: "起始节点", tone: "green", description: "解析问、搜、订、游、评等任务意图", sla: "300ms" },
  { id: "profile", x: 50, y: 22, title: "画像与上下文", type: "Agent节点", tone: "blue", description: "读取同行人、预算、语言、历史收藏与实时位置", sla: "500ms" },
  { id: "kb", x: 22, y: 44, title: "知识库检索", type: "RAG工具", tone: "purple", description: "检索 POI、FAQ、导览词、退改规则和多语资料", sla: "1.2s" },
  { id: "ticket", x: 50, y: 44, title: "票务库存查询", type: "接口工具", tone: "orange", description: "调用官方库存、时段预约、价格和优惠券能力", sla: "800ms" },
  { id: "route", x: 78, y: 44, title: "路线求解", type: "地图工具", tone: "green", description: "结合拥堵、天气、交通方式与无障碍偏好求解路线", sla: "900ms" },
  { id: "compose", x: 50, y: 64, title: "行程生成与解释", type: "LLM编排", tone: "blue", description: "生成可订、可走、可解释的计划卡和推荐理由", sla: "4s" },
  { id: "audit", x: 50, y: 82, title: "安全校验与日志", type: "治理节点", tone: "red", description: "敏感信息脱敏、内容安全、工具调用审计和人工兜底", sla: "实时" }
];

export const merchants = [
  ["黄鹤楼文创旗舰店", "文创", "营业中", "已同步", "4.6", "1,248", "已通过"],
  ["黄鹤楼游客中心", "交通", "营业中", "已同步", "4.8", "3,652", "已通过"],
  ["武昌城市酒店", "住宿", "营业中", "同步失败", "4.2", "856", "待审核"],
  ["黄鹤楼文创旗舰店", "文创", "营业中", "已同步", "4.9", "2,158", "已通过"],
  ["汤口镇游客中心餐厅", "餐饮", "暂停营业", "已同步", "4.1", "312", "已通过"],
  ["太平湖游船票务", "景区服务", "营业中", "同步失败", "4.3", "645", "驳回"]
];

export const knowledgeRows = [
  ["黄鹤楼演示票务多少钱？", "门票政策", "演示整理", "2026-05-24 10:15", "已发布", "8,752"],
  ["黄鹤楼开放时间是什么时候？", "景区开放", "官方整理", "2026-05-23 09:50", "已发布", "6,128"],
  ["黄鹤楼 sandbox 票务如何预约？", "预订购票", "官方整理", "2026-05-22 16:32", "已发布", "5,642"],
  ["湖北省博物馆交通运营时间多久？", "交通指南", "官方整理", "2026-05-21 14:18", "已发布", "4,315"],
  ["下雨天可以去哪里玩？", "游玩建议", "用户反馈", "2026-05-16 15:05", "待更新", "1,652"]
];

export const campaignRows = [
  ["江滩夜游周末线", "本地游/夜游季", "进行中", "128,764", "36,215", "4.82%"],
  ["端午民俗文化节", "节庆/热门", "待上线", "-", "-", "-"],
  ["亲子研学季", "亲子/研学", "待上线", "-", "-", "-"],
  ["黄鹤楼观江打卡季", "主题/摄影", "已结束", "96,532", "27,184", "3.61%"],
  ["江汉关·夜游计划", "夜游/演出", "已结束", "152,893", "42,901", "5.12%"]
];

export const reviewRows = [
  ["黄鹤楼文创旗舰店", "李小雨", "商户入驻", "证照模糊", "待审核", "2026-05-29 09:21"],
  ["黄鹤楼夜游演示产品", "王思语", "内容发布", "无风险", "待审核", "2026-05-25 08:44"],
  ["夜游蜀山光影秀", "陈梦", "活动发布", "敏感词疑似", "待审核", "2026-05-24 22:17"],
  ["太平烟车体验攻略", "周子恒", "内容发布", "无风险", "审核中", "2026-05-24 20:03"],
  ["江汉关城市礼物店", "孙悦", "商户入驻", "地址异常", "已驳回", "2026-05-24 14:05"]
];
