import type { LucideIcon } from "lucide-react";

export type AppRoute = {
  path: string;
  label: string;
  group: "游客端" | "运营端" | "商户端";
  icon: LucideIcon;
};

export type StatusTone = "blue" | "green" | "orange" | "red" | "purple" | "slate" | "cyan" | "gold";

export type ScenicSpot = {
  name: string;
  image: string;
  rating: number;
  crowd: "舒适" | "较少" | "适中" | "较拥挤";
  tags: string[];
  reason: string;
  price?: string;
  duration?: string;
  location?: string;
  weather?: string;
  distance?: string;
};

export type TimelineItem = {
  time: string;
  title: string;
  subtitle: string;
  image?: string;
  type: "spot" | "food" | "hotel" | "traffic";
  tags: string[];
  meta: string;
  open?: string;
  traffic?: string;
};

export type GeneratedItineraryItem = TimelineItem & {
  day: string;
  poiId?: string;
  note?: string;
};

export type GeneratedItineraryResponse = {
  cityId: string;
  days: number;
  nights: number;
  title: string;
  preferences: string[];
  summary: string[];
  reasons: string[];
  constraints: Array<{ label: string; value: string; status: "通过" | "提醒"; tone: StatusTone }>;
  budget: {
    totalPerPerson: number;
    days: number;
    breakdown: Array<{ name: string; value: number; fill: string }>;
  };
  items: GeneratedItineraryItem[];
  sourceNote: string;
  toolCalls: AiToolCall[];
};

export type MetricItem = {
  label: string;
  value: string;
  delta: string;
  tone: StatusTone;
  icon?: LucideIcon;
};

export type WorkflowNode = {
  id: string;
  x: number;
  y: number;
  title: string;
  type: string;
  tone: StatusTone;
  description: string;
  sla?: string;
};

export type PoiCategory = "景点" | "美食" | "文化艺术" | "购物" | "亲子游" | "公园自然" | "历史遗迹" | "夜生活";

export type Poi = {
  id: string;
  name: string;
  cityId: string;
  category: PoiCategory;
  tags: string[];
  lng: number;
  lat: number;
  coordinateSystem: "GCJ-02";
  address?: string;
  rating?: number;
  openingHours?: string;
  cover?: string;
  images?: string[];
  imageSource?: string;
  imageVerifiedAt?: string;
  suggestedDuration?: string;
  suitableFor?: string;
  description?: string;
  source?: {
    provider?: string;
    endpoint?: string;
    amapId?: string;
    amapType?: string;
    amapAdcode?: string;
    collectedAt?: string;
  };
};

export type City = {
  id: string;
  name: string;
  officialName: string;
  pinyin: string;
  adcode: string;
  level: string;
};

export type PoiSearchParams = {
  keyword?: string;
  cityId?: string;
  category?: PoiCategory | "全部";
  tags?: string[];
  limit?: number;
};

export type TicketStockStatus = "available" | "low" | "soldOut" | "verify";

export type TicketProduct = {
  id: string;
  poiId: string;
  name: string;
  desc: string;
  price: number;
  stock: number;
  status: TicketStockStatus;
};

export type TicketSlot = {
  id: string;
  time: string;
  stock: number;
  status: TicketStockStatus;
};

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "ready_to_visit"
  | "verified"
  | "cancelled"
  | "expired"
  | "payment_failed"
  | "refunding"
  | "refunded";

export type VisitorInfo = {
  name: string;
  credentialType: "id-card" | "passport";
  credentialNo: string;
};

export type Order = {
  id: string;
  title: string;
  poiId: string;
  ticketId: string;
  ticketName: string;
  slotId: string;
  slotTime: string;
  visitDate: string;
  quantity: number;
  amount: number;
  status: OrderStatus;
  paymentProvider: "mock" | "sandbox" | string;
  lockId?: string;
  visitorInfo: VisitorInfo[];
  voucherCode?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
};

export type TicketLockStatus = "active" | "released" | "confirmed" | "expired";

export type TicketLock = {
  id: string;
  productId: string;
  slotId: string;
  visitDate: string;
  quantity: number;
  status: TicketLockStatus;
  orderId?: string;
  userId?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TicketVoucher = {
  id: string;
  orderId: string;
  code: string;
  status: "active" | "verified" | "refunded" | "cancelled";
  visitDate: string;
  slotId: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
};

export type PaymentStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunding"
  | "refunded";

export type PaymentRecord = {
  id: string;
  orderId: string;
  provider: string;
  amount: number;
  status: PaymentStatus;
  externalPaymentId?: string;
  checkoutUrl?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthState = {
  authenticated: boolean;
  user: DemoUser;
  expiresAt?: string;
};

export type RouteMode = "walking" | "driving" | "transit" | "bicycling";

export type MapPoint = {
  name?: string;
  lng: number;
  lat: number;
};

export type RouteResult = {
  provider: string;
  coordinateSystem: "GCJ-02";
  mode: RouteMode;
  distanceMeters: number;
  durationMinutes: number;
  points: MapPoint[];
  waypointNames: string[];
  preferences: string[];
  fallback: boolean;
  failureReason?: string;
};

export type AiToolCall = {
  name: string;
  status: "success" | "failed" | "skipped";
  summary: string;
};

export type AiRecommendationCard = {
  id: string;
  title: string;
  subtitle: string;
  image?: string;
  actionLabel?: string;
  href?: string;
};

export type AiResponse = {
  text: string;
  cards: AiRecommendationCard[];
  toolCalls: AiToolCall[];
  confidence: number;
  sourceNote: string;
};

export type AdminMetrics = {
  kpis: MetricItem[];
  alerts: Array<{ title: string; desc: string; level: "高" | "中" | "低" }>;
  hotspots: string[][];
  scopeLabel?: string;
  sourceNote?: string;
};

export type AdminMetricsFilter = {
  keyword?: string;
  scenic?: string;
  status?: string;
  date?: string;
};

export type OperationScope = "visitor" | "admin" | "merchant" | "system";

export type OperationResult = {
  id: string;
  scope: OperationScope;
  type: string;
  label: string;
  status: "completed" | "queued";
  message: string;
  downloadUrl?: string;
  createdAt: string;
};

export type Role = "visitor" | "operator" | "reviewer" | "merchant" | "admin";

export type DemoUser = {
  id: string;
  name: string;
  role: Role;
};
