import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./security";
import { DEFAULT_TICKET_DEMO_POI_ID } from "./config/city";
import { addDaysISO, todayISO, upcomingDatesISO } from "./demoDates";

let db: DatabaseSync | undefined;

export function getDatabasePath() {
  const configured = process.env.DATABASE_URL ?? "file:./data/ly.sqlite";
  if (configured === ":memory:") return configured;
  const filePath = configured.startsWith("file:") ? configured.slice("file:".length) : configured;
  return isAbsolute(filePath) ? filePath : join(process.cwd(), filePath);
}

export function getDb() {
  if (!db) {
    const databasePath = getDatabasePath();
    if (databasePath !== ":memory:") {
      const directory = dirname(databasePath);
      if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    }
    db = new DatabaseSync(databasePath);
    db.exec("PRAGMA foreign_keys = ON;");
    if (databasePath !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  }
  return db;
}

export function initializeDatabase() {
  const database = getDb();
  database.exec(schemaSql);
  seedDatabase();
}

export function seedDatabase() {
  const database = getDb();
  const now = new Date().toISOString();
  const passwordHash = hashPassword("sandbox", "ly-sandbox-seed");

  const insertUser = database.prepare(`
    INSERT OR IGNORE INTO users (id, name, role, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    ["visitor", "游客小陈", "visitor"],
    ["operator", "张运营", "operator"],
    ["reviewer", "王审核", "reviewer"],
    ["merchant", "武昌商户", "merchant"],
    ["admin", "系统管理员", "admin"]
  ].forEach(([id, name, role]) => insertUser.run(id, name, role, passwordHash, now, now));
  database.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?").run("武昌商户", now, "merchant");

  database.prepare(`
    INSERT OR REPLACE INTO poi_cache_metadata
      (id, source, poi_count, city_count, coordinate_system, updated_at)
    VALUES ('default', 'poi-data/usable-pois.json', 11616, 337, 'GCJ-02', ?)
  `).run(now);

  const insertMerchant = database.prepare(`
    INSERT INTO merchants
      (id, name, category, status, inventory_status, rating, order_count, review_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      status = excluded.status,
      inventory_status = excluded.inventory_status,
      rating = excluded.rating,
      order_count = excluded.order_count,
      review_status = excluded.review_status,
      updated_at = excluded.updated_at
  `);
  database.prepare("DELETE FROM merchants WHERE id IN ('m-yungu', 'm-leifeng', 'm-xihu-boat')").run();
  [
    ["m-wuchang-hotel", "武昌城市酒店", "住宿", "营业中", "已同步", "4.8", 128, "已通过"],
    ["m-yellow-crane-ticket", "黄鹤楼演示票务", "门票", "营业中", "已同步", "4.7", 5842, "已通过"],
    ["m-jianghan-tour", "江汉关夜游服务", "交通", "营业中", "待同步", "4.6", 936, "待审核"]
  ].forEach((merchant) => insertMerchant.run(...merchant, now, now));

  const insertReview = database.prepare(`
    INSERT INTO review_records
      (id, subject_name, submitter, type, risk_note, status, submitted_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      subject_name = excluded.subject_name,
      submitter = excluded.submitter,
      type = excluded.type,
      risk_note = excluded.risk_note,
      status = excluded.status,
      submitted_at = excluded.submitted_at,
      updated_at = excluded.updated_at
  `);
  database.prepare("DELETE FROM review_records WHERE id IN ('rv-merchant-yungu', 'rv-content-leifeng', 'rv-campaign-night')").run();
  [
    ["rv-merchant-wuchang", "武昌城市酒店入驻", "武昌城市酒店", "商户入驻", "资质材料需复核", "待审核", `${todayISO()} 10:18`],
    ["rv-content-yellow-crane", "黄鹤楼演示票务活动页", "张运营", "内容发布", "需标注 sandbox 非真实库存/支付", "待审核", `${todayISO()} 09:42`],
    ["rv-campaign-riverfront", "江滩夜游专题", "李运营", "活动专题", "营销权益待确认", "审核中", `${addDaysISO(-1)} 18:20`]
  ].forEach((review) => insertReview.run(...review, now));

  seedTickets(database, now);
}

export function withTransaction<T>(work: () => T): T {
  const database = getDb();
  database.exec("BEGIN IMMEDIATE;");
  try {
    const result = work();
    database.exec("COMMIT;");
    return result;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function closeDb() {
  db?.close();
  db = undefined;
}

function seedTickets(database: DatabaseSync, now: string) {
  const legacyPoiId = "ticket-leifeng-demo";
  const poiId = DEFAULT_TICKET_DEMO_POI_ID;
  database.prepare("UPDATE ticket_products SET poi_id = ?, updated_at = ? WHERE poi_id = ?").run(poiId, now, legacyPoiId);
  database.prepare("UPDATE ticket_slots SET poi_id = ?, updated_at = ? WHERE poi_id = ?").run(poiId, now, legacyPoiId);

  const insertProduct = database.prepare(`
    INSERT INTO ticket_products (id, poi_id, name, description, price, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      poi_id = excluded.poi_id,
      name = excluded.name,
      description = excluded.description,
      price = excluded.price,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);
  [
    ["adult", "成人票", "18-60周岁游客", 40, "available"],
    ["student", "学生票", "全日制在校学生", 20, "available"],
    ["child", "儿童票", "6-18周岁未成年人", 20, "available"],
    ["senior", "老人票", "60-70周岁老人", 20, "low"],
    ["care", "优待票", "残疾人/现役军人", 0, "verify"]
  ].forEach(([id, name, description, price, status]) => {
    insertProduct.run(id, poiId, name, description, price, status, now, now);
  });

  const insertSlot = database.prepare(`
    INSERT INTO ticket_slots (id, poi_id, start_time, end_time, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      poi_id = excluded.poi_id,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);
  [
    ["08-10", "08:00", "10:00", "available"],
    ["10-12", "10:00", "12:00", "available"],
    ["12-14", "12:00", "14:00", "low"],
    ["14-16", "14:00", "16:00", "low"],
    ["16-1730", "16:00", "17:30", "available"]
  ].forEach(([id, start, end, status]) => insertSlot.run(id, poiId, start, end, status, now, now));

  const insertInventory = database.prepare(`
    INSERT OR IGNORE INTO ticket_inventory
      (product_id, slot_id, visit_date, total_stock, available_stock, locked_stock, sold_stock, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
  `);
  const stockByProduct: Record<string, number> = { adult: 180, student: 120, child: 80, senior: 18, care: 999 };
  const stockBySlot: Record<string, number> = { "08-10": 120, "10-12": 92, "12-14": 16, "14-16": 22, "16-1730": 80 };
  const dates = upcomingDatesISO(9);
  Object.keys(stockByProduct).forEach((productId) => {
    Object.keys(stockBySlot).forEach((slotId) => {
      dates.forEach((date) => {
        insertInventory.run(productId, slotId, date, Math.min(stockByProduct[productId], stockBySlot[slotId]), Math.min(stockByProduct[productId], stockBySlot[slotId]), now, now);
      });
    });
  });
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('visitor', 'operator', 'reviewer', 'merchant', 'admin')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poi_cache_metadata (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  poi_count INTEGER NOT NULL,
  city_count INTEGER NOT NULL,
  coordinate_system TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  inventory_status TEXT NOT NULL,
  rating TEXT NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_records (
  id TEXT PRIMARY KEY,
  subject_name TEXT NOT NULL,
  submitter TEXT NOT NULL,
  type TEXT NOT NULL,
  risk_note TEXT NOT NULL,
  status TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  reviewed_by TEXT,
  remark TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_products (
  id TEXT PRIMARY KEY,
  poi_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL CHECK (status IN ('available', 'low', 'soldOut', 'verify')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (poi_id, name)
);

CREATE TABLE IF NOT EXISTS ticket_slots (
  id TEXT PRIMARY KEY,
  poi_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'low', 'soldOut', 'verify')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (poi_id, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS ticket_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES ticket_products(id),
  slot_id TEXT NOT NULL REFERENCES ticket_slots(id),
  visit_date TEXT NOT NULL,
  total_stock INTEGER NOT NULL CHECK (total_stock >= 0),
  available_stock INTEGER NOT NULL CHECK (available_stock >= 0),
  locked_stock INTEGER NOT NULL CHECK (locked_stock >= 0),
  sold_stock INTEGER NOT NULL CHECK (sold_stock >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (product_id, slot_id, visit_date)
);

CREATE TABLE IF NOT EXISTS ticket_locks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES ticket_products(id),
  slot_id TEXT NOT NULL REFERENCES ticket_slots(id),
  visit_date TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'released', 'confirmed', 'expired')),
  order_id TEXT UNIQUE,
  user_id TEXT REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  poi_id TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  ticket_name TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL,
  payment_provider TEXT NOT NULL,
  lock_id TEXT UNIQUE REFERENCES ticket_locks(id),
  visitor_info_json TEXT NOT NULL,
  voucher_code TEXT UNIQUE,
  image TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('created', 'pending', 'paid', 'failed', 'cancelled', 'expired', 'refunding', 'refunded')),
  external_payment_id TEXT UNIQUE,
  checkout_url TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  signature_valid INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS ticket_vouchers (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'verified', 'refunded', 'cancelled')),
  visit_date TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  verified_at TEXT,
  verified_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS map_provider_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_records (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id),
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '新对话',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  ui_message_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ticket_locks_status_expires ON ticket_locks(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_operation_records_scope_type ON operation_records(scope, type, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at);
`;
