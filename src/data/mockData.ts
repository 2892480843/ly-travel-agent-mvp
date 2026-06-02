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

export const routes: AppRoute[] = [
  { path: "/", label: "游客端首页", group: "游客端", icon: Home },
  { path: "/assistant", label: "AI旅行助手", group: "游客端", icon: Bot },
  { path: "/recommend", label: "个性化推荐", group: "游客端", icon: Sparkles },
  { path: "/plan", label: "杭州三日游规划", group: "游客端", icon: Route },
  { path: "/spot/lingyin", label: "灵隐寺详情", group: "游客端", icon: Compass },
  { path: "/ticket/leifeng", label: "雷峰塔预约", group: "游客端", icon: Ticket },
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
  westLake: "https://store.is.autonavi.com/showpic/44a8bfa45e118d5e37adf558bfcf0d82",
  lingyin: "https://store.is.autonavi.com/showpic/4aa0a6a1b6ee72c9833441f363cbb43a",
  leifeng: "https://store.is.autonavi.com/showpic/478ddbbf592df9e88466a3e10c5d6b70",
  taiziwan: "https://store.is.autonavi.com/showpic/b7fdcef220d9434e6b0dfee47340ecfe",
  xixi: "https://store.is.autonavi.com/showpic/ee8ba4fd213aa0ee5605e41415921500",
  hefang: "https://store.is.autonavi.com/showpic/e7a956f2beba64afa31364a6858dac82",
  museum: "https://aos-comment.amap.com/comment/content_service_f80d44e15d6520ed26e149c270468752_1767723337112_98447265.jpg",
  food: "https://store.is.autonavi.com/showpic/41d656b9d4bb0eef5b94ca5faac97e87",
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  night: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  mountain: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
  ar: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?auto=format&fit=crop&w=1600&q=85"
};

export const heroImage =
  "https://store.is.autonavi.com/showpic/478ddbbf592df9e88466a3e10c5d6b70";

export const cityStats = [
  { label: "今日可预约产品", value: "426", hint: "景点/演出/餐饮" },
  { label: "AI 已服务游客", value: "18.2万", hint: "本周 +21.6%" },
  { label: "平均省下排队", value: "32分钟", hint: "基于实时客流" },
  { label: "联单转化", value: "18.74%", hint: "票务到消费" }
];

export const scenicSpots: ScenicSpot[] = [
  {
    name: "西湖经典环线",
    image: spotImages.westLake,
    rating: 4.9,
    crowd: "舒适",
    tags: ["5A景区", "亲子友好", "免费"],
    reason: "你偏好低强度文化游，当前湖滨客流较低，适合先走断桥到苏堤。",
    duration: "2.5小时",
    location: "西湖区",
    weather: "晴 26℃",
    distance: "距你 1.2km"
  },
  {
    name: "灵隐寺",
    image: spotImages.lingyin,
    rating: 4.9,
    crowd: "较少",
    tags: ["禅意", "文化深读", "可预约"],
    reason: "你收藏过古寺与石刻，AI 已避开 11:00 高峰，推荐上午入园。",
    price: "45起",
    duration: "2小时",
    location: "灵隐街道",
    weather: "多云 25℃",
    distance: "距你 5.3km"
  },
  {
    name: "雷峰塔",
    image: spotImages.leifeng,
    rating: 4.8,
    crowd: "适中",
    tags: ["西湖十景", "夜景", "电子票"],
    reason: "今日 16:00 后能见度好，登塔可看到南屏晚钟与湖面落日。",
    price: "40起",
    duration: "70分钟",
    location: "南山路",
    weather: "晴 26℃",
    distance: "距你 2.6km"
  },
  {
    name: "太子湾公园",
    image: spotImages.taiziwan,
    rating: 4.8,
    crowd: "舒适",
    tags: ["自然风光", "拍照", "亲子"],
    reason: "你选择了亲子标签，园内坡度平缓，附近有休息区和轻餐饮。",
    duration: "90分钟",
    location: "南山路",
    weather: "晴 26℃",
    distance: "距你 2.1km"
  },
  {
    name: "西溪湿地",
    image: spotImages.xixi,
    rating: 4.7,
    crowd: "较少",
    tags: ["自然风光", "游船", "银发友好"],
    reason: "今日湿地西区人流低于均值 18%，适合慢游与摄影。",
    price: "80起",
    duration: "3小时",
    location: "余杭区",
    weather: "晴 27℃",
    distance: "距你 9.4km"
  },
  {
    name: "清河坊历史街区",
    image: spotImages.hefang,
    rating: 4.6,
    crowd: "适中",
    tags: ["宋韵文化", "美食", "夜游"],
    reason: "你对非遗与小吃有收藏记录，晚间灯光与商户营业更完整。",
    duration: "2小时",
    location: "上城区",
    weather: "晴 26℃",
    distance: "距你 3.8km"
  }
];

export const foods = [
  { name: "知味观·味庄", image: spotImages.food, tags: ["杭帮菜", "老字号"], price: 68, rating: 4.6, reason: "你偏好本地特色，距雷峰塔 1.2km，当前排队 6 分钟。" },
  { name: "外婆家（湖滨店）", image: spotImages.food, tags: ["亲子友好", "小排队"], price: 66, rating: 4.4, reason: "适合家庭快速午餐，AI 预测 12:40 后排队下降。" },
  { name: "猫的天空之城", image: spotImages.food, tags: ["甜品", "文创"], price: 45, rating: 4.7, reason: "适合亲子休闲和雨天备选，附近有文创打卡点。" }
];

export const timelineDays: Record<string, TimelineItem[]> = {
  "Day 1": [
    { time: "09:00", title: "酒店出发", subtitle: "湖滨银泰步行集结，AI 已同步天气与限行", type: "hotel", tags: ["步行10分钟"], meta: "空气优", traffic: "步行" },
    { time: "09:30-11:00", title: "西湖游船（湖滨三公园码头）", subtitle: "泛舟湖上，远看三潭印月，避开断桥早高峰", image: spotImages.westLake, type: "spot", tags: ["必玩", "亲子友好"], meta: "90分钟", open: "08:00-17:30" },
    { time: "11:20-12:20", title: "雷峰塔", subtitle: "登塔远眺西湖全景，了解白蛇传说", image: spotImages.leifeng, type: "spot", tags: ["历史文化", "人气热门"], meta: "余票充足", open: "08:00-18:00" },
    { time: "12:30-13:30", title: "外婆家（湖滨店）", subtitle: "杭帮菜午餐，已预估排队 8 分钟", image: spotImages.food, type: "food", tags: ["推荐午餐", "人均110"], meta: "可取号", traffic: "步行8分钟" },
    { time: "13:50-15:20", title: "苏堤春晓", subtitle: "慢步苏堤，拍摄湖面与柳岸", image: spotImages.taiziwan, type: "spot", tags: ["经典景点"], meta: "90分钟" },
    { time: "15:40-17:00", title: "浙江省博物馆（武林馆区）", subtitle: "了解浙江历史与文化精华，雨天可替换", image: spotImages.museum, type: "spot", tags: ["文化体验"], meta: "需预约", open: "09:00-17:00" },
    { time: "19:30", title: "返回酒店休息", subtitle: "自动同步明日灵隐寺预约和交通提醒", type: "traffic", tags: ["地铁优先"], meta: "12分钟" }
  ],
  "Day 2": [
    { time: "08:40-11:20", title: "灵隐寺与飞来峰", subtitle: "AI讲解石窟造像与禅宗故事", image: spotImages.lingyin, type: "spot", tags: ["文化深读", "已预约"], meta: "2.5小时", open: "07:00-18:30" },
    { time: "12:10-13:30", title: "桂语山房", subtitle: "满觉陇茶香午餐，预算偏高提醒", image: spotImages.food, type: "food", tags: ["杭帮菜"], meta: "人均260" },
    { time: "15:00-17:40", title: "西溪湿地", subtitle: "乘船进入湿地，避开主入口排队", image: spotImages.xixi, type: "spot", tags: ["自然风光"], meta: "舒适" }
  ],
  "Day 3": [
    { time: "09:30-11:30", title: "清河坊历史街区", subtitle: "非遗小吃、南宋街巷与伴手礼", image: spotImages.hefang, type: "spot", tags: ["宋韵文化"], meta: "免费" },
    { time: "14:00-16:20", title: "杭州亚运会博物馆", subtitle: "体育文旅专题路线收尾", image: spotImages.museum, type: "spot", tags: ["亲子", "室内"], meta: "需预约" }
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
  { name: "访问人数", value: 129842, fill: "#1d7cf8" },
  { name: "进入预约", value: 78635, fill: "#16c7c7" },
  { name: "预约成功", value: 36824, fill: "#2ecb72" },
  { name: "入园核销", value: 32165, fill: "#ff9f32" },
  { name: "二次消费", value: 12478, fill: "#ff5d62" }
];

export const orders = [
  { id: "T20260602001", title: "雷峰塔成人票 x2", status: "待出行", amount: 110, date: "2026-06-06 08:00-10:00", image: spotImages.leifeng },
  { id: "P20260602018", title: "西湖文化深度游三日行程", status: "已确认", amount: 2680, date: "2026-06-06 至 06-08", image: spotImages.westLake },
  { id: "M20260602033", title: "宋韵夜游套餐", status: "待支付", amount: 398, date: "支付剩余 14:56", image: spotImages.hefang }
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
  { name: "杭州西湖 + 君悦酒店 2天1晚套餐", image: spotImages.hotel, type: "门票+酒店", desc: "西湖风景区 + 杭州君悦酒店", price: 988, origin: 1286, save: 298, tags: ["适合周末", "可报销", "官方库存"] },
  { name: "成都大熊猫基地 + 川味美食套餐", image: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?auto=format&fit=crop&w=1200&q=80", type: "门票+餐饮", desc: "熊猫基地门票 + 特色川菜双人餐", price: 368, origin: 486, save: 118, tags: ["亲子优选", "含纪念品"] },
  { name: "黄山风景区 + 往返接驳套餐", image: spotImages.mountain, type: "门票+接驳", desc: "黄山门票 + 杭州/黄山往返接驳", price: 658, origin: 856, save: 198, tags: ["2天1晚", "可撤销"] },
  { name: "宋城千古情 + 夜游西湖套餐", image: spotImages.night, type: "演出+夜游", desc: "宋城演出票 + 西湖夜游船票", price: 598, origin: 796, save: 198, tags: ["夜间打卡", "沉浸体验"] }
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
  ["西湖饭店（黄山风景区）", "住宿", "营业中", "已同步", "4.6", "1,248", "已通过"],
  ["云谷索道", "交通", "营业中", "已同步", "4.8", "3,652", "已通过"],
  ["光明顶山庄", "住宿", "营业中", "同步失败", "4.2", "856", "待审核"],
  ["黄山景区官方旗舰店", "文创", "营业中", "已同步", "4.9", "2,158", "已通过"],
  ["汤口镇游客中心餐厅", "餐饮", "暂停营业", "已同步", "4.1", "312", "已通过"],
  ["太平湖游船票务", "景区服务", "营业中", "同步失败", "4.3", "645", "驳回"]
];

export const knowledgeRows = [
  ["黄山景区门票多少钱？", "门票政策", "官方整理", "2026-05-24 10:15", "已发布", "8,752"],
  ["雷峰塔开放时间是什么时候？", "景区开放", "官方整理", "2026-05-23 09:50", "已发布", "6,128"],
  ["西湖景区如何预约门票？", "预订购票", "官方整理", "2026-05-22 16:32", "已发布", "5,642"],
  ["灵隐寺交通运营时间多久？", "交通指南", "官方整理", "2026-05-21 14:18", "已发布", "4,315"],
  ["下雨天可以去哪里玩？", "游玩建议", "用户反馈", "2026-05-16 15:05", "待更新", "1,652"]
];

export const campaignRows = [
  ["晚美乡村周末游", "本地游/山野季", "进行中", "128,764", "36,215", "4.82%"],
  ["端午民俗文化节", "节庆/热门", "待上线", "-", "-", "-"],
  ["亲子研学季", "亲子/研学", "待上线", "-", "-", "-"],
  ["黄山云海观景季", "主题/摄影", "已结束", "96,532", "27,184", "3.61%"],
  ["不夜黄山·夜游计划", "夜游/演出", "已结束", "152,893", "42,901", "5.12%"]
];

export const reviewRows = [
  ["西湖饭店（黄山风景区）", "李小雨", "商户入驻", "证照模糊", "待审核", "2026-05-29 09:21"],
  ["云谷索道夜展产品", "王思语", "内容发布", "无风险", "待审核", "2026-05-25 08:44"],
  ["夜游蜀山光影秀", "陈梦", "活动发布", "敏感词疑似", "待审核", "2026-05-24 22:17"],
  ["太平烟车体验攻略", "周子恒", "内容发布", "无风险", "审核中", "2026-05-24 20:03"],
  ["西湖地轩酒店", "孙悦", "商户入驻", "地址异常", "已驳回", "2026-05-24 14:05"]
];
